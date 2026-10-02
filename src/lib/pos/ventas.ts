import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { clientes, movimientosCuenta, pagos, productos, ventaItems, ventas } from '@/db/schema';
import { siguienteNumeroOrdenDia } from '@/db/contadores';
import { calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';
import type { esquemaCrearVenta } from './esquemas';
import type { z } from 'zod';

export class VentaError extends Error {}

type EntradaVenta = z.infer<typeof esquemaCrearVenta>;

export interface SaldoClienteInfo {
  saldoAnterior: number;
  saldoNuevo: number;
  pasaLimite: boolean;
}

export interface ResultadoVenta {
  venta: typeof ventas.$inferSelect;
  items: (typeof ventaItems.$inferSelect)[];
  pagosCreados: (typeof pagos.$inferSelect)[];
  saldoCliente?: SaldoClienteInfo;
}

export function saldoActualCliente(clienteId: string): number {
  const movimientos = sqlite
    .prepare('SELECT tipo, monto FROM movimientos_cuenta WHERE cliente_id = ?')
    .all(clienteId) as { tipo: string; monto: number }[];

  return movimientos.reduce((saldo, movimiento) => {
    if (movimiento.tipo === 'abono') return saldo - movimiento.monto;
    return saldo + movimiento.monto; // cargo o ajuste positivo
  }, 0);
}

/**
 * Crea una venta con sus líneas y pagos en una sola transacción (§4, §6).
 * Idempotente por `idempotencyKey`: si ya existe, devuelve la venta existente en
 * vez de duplicarla (protección contra el doble toque al cobrar).
 */
export async function crearVenta(
  entrada: EntradaVenta,
  usuarioId: string,
  sesionCajaId: string,
  tipoCambioSesion: number,
): Promise<ResultadoVenta> {
  const existente = await db
    .select()
    .from(ventas)
    .where(eq(ventas.idempotencyKey, entrada.idempotencyKey));

  if (existente.length > 0) {
    const items = await db
      .select()
      .from(ventaItems)
      .where(eq(ventaItems.ventaId, existente[0].id));
    const pagosExistentes = await db.select().from(pagos).where(eq(pagos.ventaId, existente[0].id));
    return { venta: existente[0], items, pagosCreados: pagosExistentes };
  }

  const idsProductos = entrada.items.map((item) => item.productoId);
  const productosDb = await db.select().from(productos).where(inArray(productos.id, idsProductos));
  const productoPorId = new Map(productosDb.map((producto) => [producto.id, producto]));

  for (const item of entrada.items) {
    const producto = productoPorId.get(item.productoId);
    if (!producto) throw new VentaError(`Producto ${item.productoId} no existe`);
    if (!producto.activo) throw new VentaError(`"${producto.nombre}" no está activo`);
    if (producto.agotado) throw new VentaError(`"${producto.nombre}" está agotado`);
  }

  const total = entrada.items.reduce((suma, item) => {
    const producto = productoPorId.get(item.productoId)!;
    return suma + producto.precio * item.cantidad;
  }, 0);

  const sumaPagos = entrada.pagos.reduce((suma, pago) => suma + pago.monto, 0);
  if (sumaPagos !== total) {
    throw new VentaError(`Los pagos suman ${sumaPagos} pero el total es ${total}`);
  }

  const pagosCuenta = entrada.pagos.filter((pago) => pago.metodo === 'cuenta');
  if (pagosCuenta.length > 0 && !entrada.clienteId) {
    throw new VentaError('Una venta a cuenta debe tener un cliente registrado');
  }

  let cliente: typeof clientes.$inferSelect | undefined;
  if (entrada.clienteId) {
    const [filaCliente] = await db.select().from(clientes).where(eq(clientes.id, entrada.clienteId));
    if (!filaCliente) throw new VentaError('Cliente no encontrado');
    if (filaCliente.estado === 'bloqueado' && pagosCuenta.length > 0) {
      throw new VentaError(`La cuenta ${filaCliente.numeroCuenta} está bloqueada`);
    }
    cliente = filaCliente;
  }

  const montoCuenta = pagosCuenta.reduce((suma, pago) => suma + pago.monto, 0);
  const estadoPago =
    montoCuenta === 0 ? 'pagada' : montoCuenta === total ? 'a_cuenta' : 'parcial';

  const ventaId = randomUUID();
  const numeroOrdenDia = siguienteNumeroOrdenDia();

  const resultado = sqlite.transaction(() => {
    db.insert(ventas)
      .values({
        id: ventaId,
        sesionCajaId,
        numeroOrdenDia,
        tipo: 'mostrador',
        clienteId: entrada.clienteId,
        nombreReferencia: entrada.nombreReferencia,
        usuarioId,
        subtotal: total,
        descuento: 0,
        total,
        estadoPago,
        idempotencyKey: entrada.idempotencyKey,
      })
      .run();

    entrada.items.forEach((item) => {
      const producto = productoPorId.get(item.productoId)!;
      const fila = {
        id: randomUUID(),
        ventaId,
        productoId: producto.id,
        nombreSnapshot: producto.nombre,
        precioSnapshot: producto.precio,
        cantidad: item.cantidad,
        nota: item.nota,
        subtotal: producto.precio * item.cantidad,
      };
      db.insert(ventaItems).values(fila).run();
      return fila;
    });

    const pagosCreados = entrada.pagos.map((pago) => {
      let recibido: number | undefined;
      let vuelto: number | undefined;
      let montoUsd: number | undefined;
      let tipoCambio: number | undefined;

      if (pago.metodo === 'efectivo') {
        if (pago.recibido === undefined) {
          throw new VentaError('Falta el monto recibido en el pago en efectivo');
        }
        recibido = pago.recibido;
        vuelto = calcularVueltoCrc(pago.monto, pago.recibido);
      }

      if (pago.metodo === 'efectivo_usd') {
        if (pago.montoUsd === undefined) {
          throw new VentaError('Falta el monto en dólares recibido');
        }
        montoUsd = pago.montoUsd;
        tipoCambio = tipoCambioSesion;
        vuelto = calcularVueltoUsd(pago.monto, pago.montoUsd, tipoCambioSesion);
      }

      const filaPago = {
        id: randomUUID(),
        sesionCajaId,
        ventaId,
        clienteId: pago.metodo === 'cuenta' ? entrada.clienteId : undefined,
        metodo: pago.metodo,
        montoUsd,
        tipoCambio,
        monto: pago.monto,
        recibido,
        vuelto,
        referencia: pago.referencia,
        verificado: pago.metodo !== 'sinpe', // SINPE queda "por verificar" (§3.3)
        usuarioId,
      };
      db.insert(pagos).values(filaPago).run();
      return filaPago;
    });

    let saldoCliente: SaldoClienteInfo | undefined;
    if (cliente && montoCuenta > 0) {
      const saldoAnterior = saldoActualCliente(cliente.id);
      const pagoCuenta = pagosCreados.find((pago) => pago.metodo === 'cuenta')!;
      db.insert(movimientosCuenta)
        .values({
          id: randomUUID(),
          clienteId: cliente.id,
          tipo: 'cargo',
          monto: montoCuenta,
          ventaId,
          pagoId: pagoCuenta.id,
          usuarioId,
        })
        .run();
      const saldoNuevo = saldoAnterior + montoCuenta;
      saldoCliente = {
        saldoAnterior,
        saldoNuevo,
        pasaLimite: cliente.limiteCredito != null && saldoNuevo > cliente.limiteCredito,
      };
    }

    return { saldoCliente };
  })();

  const [ventaCreada] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  const itemsCreados = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, ventaId));
  const pagosCreados = await db.select().from(pagos).where(eq(pagos.ventaId, ventaId));
  return {
    venta: ventaCreada,
    items: itemsCreados,
    pagosCreados,
    saldoCliente: resultado.saldoCliente,
  };
}
