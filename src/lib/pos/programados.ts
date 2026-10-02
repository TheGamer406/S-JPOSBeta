import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { clientes, movimientosCuenta, pagos, productos, ventaItems, ventas } from '@/db/schema';
import { siguienteNumeroOrdenDia } from '@/db/contadores';
import { calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';
import type { esquemaCrearProgramado, esquemaEntregarProgramado } from './esquemas';
import type { z } from 'zod';

export class ProgramadoError extends Error {}

type EntradaCrear = z.infer<typeof esquemaCrearProgramado>;
type EntradaEntrega = z.infer<typeof esquemaEntregarProgramado>;

/**
 * Crea un pedido programado (§3.5): sin pago todavía, porque se puede pedir días
 * antes del evento, cuando puede no haber ninguna caja abierta. El cargo o cobro
 * pasa hasta que se entrega (marcarEntregaParcial), ya con una sesión real.
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
  const todos = await db.select().from(ventas).where(eq(ventas.fechaProgramada, fecha));
  const filtrados = tiempoComida ? todos.filter((venta) => venta.tiempoComida === tiempoComida) : todos;

  const resultado = [];
  for (const venta of filtrados) {
    const items = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, venta.id));
    const [cliente] = venta.clienteId
      ? await db.select().from(clientes).where(eq(clientes.id, venta.clienteId))
      : [undefined];
    resultado.push({ venta, items, cliente });
  }
  return resultado;
}

function totalEntregado(items: { precioSnapshot: number; cantidadEntregada: number }[]): number {
  return items.reduce((suma, item) => suma + item.precioSnapshot * item.cantidadEntregada, 0);
}

/**
 * Marca entregas totales o parciales por línea (§3.5: "9 de 9 perros, faltan 2
 * arroces"). El cobro de lo entregado funciona igual que una venta normal: el
 * cajero elige en el momento si se paga ahora (cualquier medio) o se carga a la
 * cuenta — `modo_pago_default` del cliente ya no lo decide, es solo informativo.
 */
export async function marcarEntregaParcial(
  entrada: EntradaEntrega,
  usuarioId: string,
  sesionCajaId: string,
  tipoCambioSesion: number,
) {
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, entrada.ventaId));
  if (!venta) throw new ProgramadoError('Pedido no encontrado');
  if (venta.tipo !== 'programado') throw new ProgramadoError('Esta venta no es un pedido programado');
  if (venta.estadoPedido === 'anulado') throw new ProgramadoError('Este pedido está anulado');
  if (!venta.clienteId) throw new ProgramadoError('El pedido programado no tiene cliente');

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, venta.clienteId));
  if (!cliente) throw new ProgramadoError('Cliente no encontrado');

  const itemsActuales = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, venta.id));
  const itemPorId = new Map(itemsActuales.map((item) => [item.id, item]));

  for (const entrega of entrada.entregas) {
    const item = itemPorId.get(entrega.ventaItemId);
    if (!item) throw new ProgramadoError(`La línea ${entrega.ventaItemId} no pertenece a este pedido`);
    if (entrega.cantidadEntregada > item.cantidad) {
      throw new ProgramadoError(`No se puede entregar más de lo pedido en "${item.nombreSnapshot}"`);
    }
    if (entrega.cantidadEntregada < item.cantidadEntregada) {
      throw new ProgramadoError(`La entrega de "${item.nombreSnapshot}" no puede bajar de lo ya entregado`);
    }
  }

  const totalYaPagado = (
    sqlite.prepare('SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE venta_id = ? AND anulado = 0').get(venta.id) as {
      total: number;
    }
  ).total;

  const itemsActualizados = itemsActuales.map((item) => {
    const entrega = entrada.entregas.find((e) => e.ventaItemId === item.id);
    return entrega ? { ...item, cantidadEntregada: entrega.cantidadEntregada } : item;
  });
  const totalEntregadoNuevo = totalEntregado(itemsActualizados);
  const delta = totalEntregadoNuevo - totalYaPagado;

  if (delta > 0 && !entrada.pago) {
    throw new ProgramadoError(`Falta decidir cómo se cobra esta entrega (${delta} pendiente)`);
  }
  if (delta > 0 && entrada.pago!.metodo === 'cuenta' && cliente.estado === 'bloqueado') {
    throw new ProgramadoError(`La cuenta ${cliente.numeroCuenta} está bloqueada`);
  }

  const completo = itemsActualizados.every((item) => item.cantidadEntregada === item.cantidad);
  const algunaEntrega = itemsActualizados.some((item) => item.cantidadEntregada > 0);

  sqlite.transaction(() => {
    for (const entrega of entrada.entregas) {
      db.update(ventaItems)
        .set({ cantidadEntregada: entrega.cantidadEntregada })
        .where(eq(ventaItems.id, entrega.ventaItemId))
        .run();
    }

    if (delta > 0 && entrada.pago) {
      const pagoId = randomUUID();

      if (entrada.pago.metodo === 'cuenta') {
        db.insert(pagos)
          .values({
            id: pagoId,
            sesionCajaId,
            ventaId: venta.id,
            clienteId: cliente.id,
            metodo: 'cuenta',
            monto: delta,
            verificado: true,
            usuarioId,
          })
          .run();
        db.insert(movimientosCuenta)
          .values({
            id: randomUUID(),
            clienteId: cliente.id,
            tipo: 'cargo',
            monto: delta,
            ventaId: venta.id,
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
          recibido = entrada.pago.recibido ?? delta;
          vuelto = calcularVueltoCrc(delta, recibido);
        }
        if (entrada.pago.metodo === 'efectivo_usd' && entrada.pago.montoUsd !== undefined) {
          montoUsd = entrada.pago.montoUsd;
          tipoCambio = tipoCambioSesion;
          vuelto = calcularVueltoUsd(delta, entrada.pago.montoUsd, tipoCambioSesion);
        }

        db.insert(pagos)
          .values({
            id: pagoId,
            sesionCajaId,
            ventaId: venta.id,
            metodo: entrada.pago.metodo,
            monto: delta,
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
    }

    // El estado combina cuánto se ha entregado y cómo se pagó lo entregado hasta
    // ahora: si todo lo pagado fue "cuenta" se ve como a_cuenta, si todo fue pago
    // directo se ve como pagada; una mezcla (parte a cuenta, parte al contado)
    // también cae en "parcial" aunque la entrega esté completa — no hay un estado
    // más preciso para "completo pero con pago mixto" en el esquema actual.
    const pagosVenta = sqlite
      .prepare("SELECT metodo, monto FROM pagos WHERE venta_id = ? AND anulado = 0")
      .all(venta.id) as { metodo: string; monto: number }[];
    const totalCuenta = pagosVenta.filter((p) => p.metodo === 'cuenta').reduce((s, p) => s + p.monto, 0);
    const totalDirecto = pagosVenta.filter((p) => p.metodo !== 'cuenta').reduce((s, p) => s + p.monto, 0);

    let estadoPago: typeof venta.estadoPago;
    if (!algunaEntrega) estadoPago = 'pendiente';
    else if (!completo) estadoPago = 'parcial';
    else if (totalCuenta > 0 && totalDirecto > 0) estadoPago = 'parcial';
    else if (totalCuenta > 0) estadoPago = 'a_cuenta';
    else estadoPago = 'pagada';

    db.update(ventas)
      .set({
        sesionCajaId: venta.sesionCajaId ?? sesionCajaId,
        numeroOrdenDia: venta.numeroOrdenDia ?? siguienteNumeroOrdenDia(),
        estadoPedido: completo ? 'entregado' : algunaEntrega ? 'preparacion' : 'pendiente',
        estadoPago,
        entregadoEn: completo ? new Date().toISOString() : venta.entregadoEn,
      })
      .where(eq(ventas.id, venta.id))
      .run();
  })();

  const [ventaActualizada] = await db.select().from(ventas).where(eq(ventas.id, venta.id));
  const itemsFinal = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, venta.id));
  return { venta: ventaActualizada, items: itemsFinal, delta };
}
