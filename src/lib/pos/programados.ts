import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { clientes, movimientosCuenta, pagos, productos, ventaItems, ventas } from '@/db/schema';
import { siguienteNumeroOrdenDia } from '@/db/contadores';
import { calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';
import type { esquemaCrearProgramado, esquemaDespacharProgramado } from './esquemas';
import type { z } from 'zod';

export class ProgramadoError extends Error {}

type EntradaCrear = z.infer<typeof esquemaCrearProgramado>;
type EntradaDespacho = z.infer<typeof esquemaDespacharProgramado>;

/**
 * Crea un pedido programado (§3.5): sin pago todavía, porque se puede pedir días
 * antes del evento, cuando puede no haber ninguna caja abierta. El cargo o cobro
 * pasa hasta que se despacha (despacharDeProgramado), ya con una sesión real.
 */
export async function crearPedidoProgramado(entrada: EntradaCrear, usuarioId: string) {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, entrada.clienteId));
  if (!cliente) throw new ProgramadoError('Cliente no encontrado');

  const idsProductos = entrada.items.map((item) => item.productoId);
  const productosDb = await db.select().from(productos).where(inArray(productos.id, idsProductos));
  const productoPorId = new Map(productosDb.map((producto) => [producto.id, producto]));

  for (const item of entrada.items) {
    const producto = productoPorId.get(item.productoId);
    if (!producto) throw new ProgramadoError(`Producto ${item.productoId} no existe`);
    if (!producto.activo) throw new ProgramadoError(`"${producto.nombre}" no está activo`);
    // "agotado" es para el stock de hoy; un pedido para un día futuro no se bloquea por eso.
  }

  const total = entrada.items.reduce((suma, item) => {
    const producto = productoPorId.get(item.productoId)!;
    return suma + producto.precio * item.cantidad;
  }, 0);

  const ventaId = randomUUID();

  sqlite.transaction(() => {
    db.insert(ventas)
      .values({
        id: ventaId,
        tipo: 'programado',
        clienteId: entrada.clienteId,
        nombreReferencia: entrada.nombreReferencia,
        usuarioId,
        subtotal: total,
        descuento: 0,
        total,
        fechaProgramada: entrada.fechaProgramada,
        tiempoComida: entrada.tiempoComida,
        idempotencyKey: randomUUID(),
      })
      .run();

    for (const item of entrada.items) {
      const producto = productoPorId.get(item.productoId)!;
      db.insert(ventaItems)
        .values({
          id: randomUUID(),
          ventaId,
          productoId: producto.id,
          nombreSnapshot: producto.nombre,
          precioSnapshot: producto.precio,
          cantidad: item.cantidad,
          nota: item.nota,
          subtotal: producto.precio * item.cantidad,
        })
        .run();
    }
  })();

  const [venta] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  const items = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, ventaId));
  return { venta, items };
}

/** Lista de pedidos programados de un día (§3.5), para la pantalla de cola y el despacho. */
export async function listarProgramados(fecha: string, tiempoComida?: 'almuerzo' | 'cafe' | 'cena') {
  const todos = await db
    .select()
    .from(ventas)
    .where(and(eq(ventas.fechaProgramada, fecha), eq(ventas.tipo, 'programado')));
  const filtrados = tiempoComida ? todos.filter((venta) => venta.tiempoComida === tiempoComida) : todos;

  const resultado = [];
  for (const venta of filtrados) {
    const items = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, venta.id));
    const [cliente] = venta.clienteId
      ? await db.select().from(clientes).where(eq(clientes.id, venta.clienteId))
      : [undefined];
    // "Pendiente" es lo que todavía no se ha sacado del plan — es lo único que
    // se puede despachar, y lo que define si el pedido ya está completo.
    const pendiente = items.reduce(
      (suma, item) => suma + (item.cantidad - item.cantidadEntregada) * item.precioSnapshot,
      0,
    );
    resultado.push({ venta, items, cliente, pendiente });
  }
  return resultado;
}

/**
 * Despacha una parte de un pedido programado (§3.5). Crea una venta REAL solo
 * con lo que se saca ahora (más lo adicional que pidan en el momento) — con su
 * propio número de orden, que es lo que pasa a la cola de /pedidos y a cocina.
 *
 * El pedido programado se queda como el plan: acumula `cantidadEntregada` para
 * saber qué falta, pero nunca lleva pagos ni número de orden propios. Así, si de
 * 9 arroces se sacan 5, lo que entra a cocina y al cierre es una venta de 5, no
 * de 9 — y los otros 4 siguen disponibles para un despacho posterior.
 */
export async function despacharDeProgramado(
  entrada: EntradaDespacho,
  usuarioId: string,
  sesionCajaId: string,
  tipoCambioSesion: number,
) {
  const yaExiste = await db.select().from(ventas).where(eq(ventas.idempotencyKey, entrada.idempotencyKey));
  if (yaExiste.length > 0) {
    const items = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, yaExiste[0].id));
    return { venta: yaExiste[0], items, total: yaExiste[0].total };
  }

  const [programado] = await db.select().from(ventas).where(eq(ventas.id, entrada.programadoId));
  if (!programado) throw new ProgramadoError('Pedido programado no encontrado');
  if (programado.tipo !== 'programado') throw new ProgramadoError('Esa venta no es un pedido programado');
  if (programado.estadoPedido === 'anulado') throw new ProgramadoError('Este pedido está anulado');
  if (!programado.clienteId) throw new ProgramadoError('El pedido programado no tiene cliente');

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, programado.clienteId));
  if (!cliente) throw new ProgramadoError('Cliente no encontrado');
  if (entrada.pago.metodo === 'cuenta' && cliente.estado === 'bloqueado') {
    throw new ProgramadoError(`La cuenta ${cliente.numeroCuenta} está bloqueada`);
  }

  const itemsPlan = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, programado.id));
  const itemPlanPorId = new Map(itemsPlan.map((item) => [item.id, item]));

  // Lo que se saca del plan, validado contra lo que todavía queda pendiente.
  const sacadas = entrada.lineas.map((linea) => {
    const item = itemPlanPorId.get(linea.ventaItemId);
    if (!item) throw new ProgramadoError('Una de las líneas no pertenece a este pedido');
    const pendiente = item.cantidad - item.cantidadEntregada;
    if (linea.cantidad > pendiente) {
      throw new ProgramadoError(
        `De "${item.nombreSnapshot}" solo quedan ${pendiente} por entregar (se pidieron ${linea.cantidad})`,
      );
    }
    return { item, cantidad: linea.cantidad };
  });

  // Productos extra que no estaban en el pedido original.
  const idsAdicionales = entrada.adicionales.map((item) => item.productoId);
  const productosAdicionales = idsAdicionales.length
    ? await db.select().from(productos).where(inArray(productos.id, idsAdicionales))
    : [];
  const productoPorId = new Map(productosAdicionales.map((producto) => [producto.id, producto]));
  for (const adicional of entrada.adicionales) {
    const producto = productoPorId.get(adicional.productoId);
    if (!producto) throw new ProgramadoError(`Producto ${adicional.productoId} no existe`);
    if (!producto.activo) throw new ProgramadoError(`"${producto.nombre}" no está activo`);
    if (producto.agotado) throw new ProgramadoError(`"${producto.nombre}" está agotado`);
  }

  const totalSacado = sacadas.reduce((suma, s) => suma + s.item.precioSnapshot * s.cantidad, 0);
  const totalAdicional = entrada.adicionales.reduce(
    (suma, adicional) => suma + productoPorId.get(adicional.productoId)!.precio * adicional.cantidad,
    0,
  );
  const total = totalSacado + totalAdicional;
  if (total <= 0) throw new ProgramadoError('El despacho quedó en cero');

  const ventaId = randomUUID();

  sqlite.transaction(() => {
    db.insert(ventas)
      .values({
        id: ventaId,
        sesionCajaId,
        numeroOrdenDia: siguienteNumeroOrdenDia(),
        tipo: 'mostrador',
        clienteId: programado.clienteId,
        nombreReferencia: cliente.nombre,
        usuarioId,
        subtotal: total,
        descuento: 0,
        total,
        estadoPago: entrada.pago.metodo === 'cuenta' ? 'a_cuenta' : 'pagada',
        programadoOrigenId: programado.id,
        idempotencyKey: entrada.idempotencyKey,
      })
      .run();

    for (const sacada of sacadas) {
      db.insert(ventaItems)
        .values({
          id: randomUUID(),
          ventaId,
          productoId: sacada.item.productoId,
          nombreSnapshot: sacada.item.nombreSnapshot,
          precioSnapshot: sacada.item.precioSnapshot,
          cantidad: sacada.cantidad,
          cantidadEntregada: sacada.cantidad,
          nota: sacada.item.nota,
          subtotal: sacada.item.precioSnapshot * sacada.cantidad,
          planItemId: sacada.item.id,
        })
        .run();

      // El plan acumula lo ya sacado, para que no se pueda volver a despachar.
      db.update(ventaItems)
        .set({ cantidadEntregada: sacada.item.cantidadEntregada + sacada.cantidad })
        .where(eq(ventaItems.id, sacada.item.id))
        .run();
    }

    for (const adicional of entrada.adicionales) {
      const producto = productoPorId.get(adicional.productoId)!;
      db.insert(ventaItems)
        .values({
          id: randomUUID(),
          ventaId,
          productoId: producto.id,
          nombreSnapshot: producto.nombre,
          precioSnapshot: producto.precio,
          cantidad: adicional.cantidad,
          cantidadEntregada: adicional.cantidad,
          nota: adicional.nota,
          subtotal: producto.precio * adicional.cantidad,
        })
        .run();
    }

    const pagoId = randomUUID();
    if (entrada.pago.metodo === 'cuenta') {
      db.insert(pagos)
        .values({
          id: pagoId,
          sesionCajaId,
          ventaId,
          clienteId: cliente.id,
          metodo: 'cuenta',
          monto: total,
          verificado: true,
          usuarioId,
        })
        .run();
      db.insert(movimientosCuenta)
        .values({
          id: randomUUID(),
          clienteId: cliente.id,
          tipo: 'cargo',
          monto: total,
          ventaId,
          pagoId,
          usuarioId,
        })
        .run();
    } else {
      let recibido: number | undefined;
      let vuelto: number | undefined;
      let montoUsd: number | undefined;
      let tipoCambio: number | undefined;

      if (entrada.pago.metodo === 'efectivo') {
        recibido = entrada.pago.recibido ?? total;
        vuelto = calcularVueltoCrc(total, recibido);
      }
      if (entrada.pago.metodo === 'efectivo_usd' && entrada.pago.montoUsd !== undefined) {
        montoUsd = entrada.pago.montoUsd;
        tipoCambio = tipoCambioSesion;
        vuelto = calcularVueltoUsd(total, entrada.pago.montoUsd, tipoCambioSesion);
      }

      db.insert(pagos)
        .values({
          id: pagoId,
          sesionCajaId,
          ventaId,
          metodo: entrada.pago.metodo,
          monto: total,
          recibido,
          vuelto,
          montoUsd,
          tipoCambio,
          referencia: entrada.pago.referencia,
          verificado: entrada.pago.metodo !== 'sinpe',
          usuarioId,
        })
        .run();
    }

    // Estado del plan: completo cuando ya no queda nada pendiente.
    const itemsDespues = sqlite
      .prepare('SELECT cantidad, cantidad_entregada AS entregada FROM venta_items WHERE venta_id = ?')
      .all(programado.id) as { cantidad: number; entregada: number }[];
    const todoEntregado = itemsDespues.every((item) => item.entregada >= item.cantidad);
    const algoEntregado = itemsDespues.some((item) => item.entregada > 0);

    db.update(ventas)
      .set({
        estadoPedido: todoEntregado ? 'entregado' : algoEntregado ? 'preparacion' : 'pendiente',
        entregadoEn: todoEntregado ? new Date().toISOString() : programado.entregadoEn,
      })
      .where(eq(ventas.id, programado.id))
      .run();
  })();

  const [ventaCreada] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  const itemsCreados = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, ventaId));
  return { venta: ventaCreada, items: itemsCreados, total };
}
