import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { clientes, movimientosCuenta, pagos, ventaItems } from '@/db/schema';
import { calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';
import { saldoActualCliente } from './ventas';

export class CuentaError extends Error {}

export interface PagoAbono {
  metodo: 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn';
  monto: number;
  recibido?: number; // solo efectivo
  montoUsd?: number; // solo efectivo_usd
  referencia?: string;
}

export interface EntradaAbono {
  clienteId: string;
  pagos: PagoAbono[];
}

/**
 * Registra un abono a cuenta (§3.6), que se puede pagar dividido entre varios
 * medios igual que una venta (§7). Cada medio entra como su propio pago (venta_id
 * = null, para distinguirlo de una venta) y su propio movimiento de tipo "abono"
 * en el libro mayor — así el estado de cuenta muestra una línea por medio usado.
 * Al ser efectivo, suma al efectivo esperado del cierre del día en que se recibe.
 */
export async function registrarAbono(
  entrada: EntradaAbono,
  usuarioId: string,
  sesionCajaId: string,
  tipoCambioSesion: number,
) {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, entrada.clienteId));
  if (!cliente) throw new CuentaError('Cliente no encontrado');

  const montoTotal = entrada.pagos.reduce((suma, pago) => suma + pago.monto, 0);

  const resultado = sqlite.transaction(() => {
    const saldoAnterior = saldoActualCliente(entrada.clienteId);

    const pagosCreados = entrada.pagos.map((pago) => {
      let recibido: number | undefined;
      let vuelto: number | undefined;
      let montoUsd: number | undefined;
      let tipoCambio: number | undefined;

      if (pago.metodo === 'efectivo') {
        if (pago.recibido === undefined) throw new CuentaError('Falta el monto recibido');
        recibido = pago.recibido;
        vuelto = calcularVueltoCrc(pago.monto, pago.recibido);
      }
      if (pago.metodo === 'efectivo_usd') {
        if (pago.montoUsd === undefined) throw new CuentaError('Falta el monto en dólares');
        montoUsd = pago.montoUsd;
        tipoCambio = tipoCambioSesion;
        vuelto = calcularVueltoUsd(pago.monto, pago.montoUsd, tipoCambioSesion);
      }

      const pagoId = randomUUID();
      db.insert(pagos)
        .values({
          id: pagoId,
          sesionCajaId,
          ventaId: undefined,
          clienteId: entrada.clienteId,
          metodo: pago.metodo,
          montoUsd,
          tipoCambio,
          monto: pago.monto,
          recibido,
          vuelto,
          referencia: pago.referencia,
          verificado: pago.metodo !== 'sinpe',
          usuarioId,
        })
        .run();

      db.insert(movimientosCuenta)
        .values({
          id: randomUUID(),
          clienteId: entrada.clienteId,
          tipo: 'abono',
          monto: pago.monto,
          pagoId,
          usuarioId,
        })
        .run();

      return { id: pagoId, metodo: pago.metodo, monto: pago.monto };
    });

    return { pagosCreados, saldoAnterior, saldoNuevo: saldoAnterior - montoTotal };
  })();

  return { cliente, ...resultado };
}

export interface MovimientoEstadoCuenta {
  id: string;
  tipo: 'cargo' | 'abono' | 'ajuste';
  monto: number;
  nota: string | null;
  creadoEn: string;
  /** Qué se compró (solo en un "cargo" que viene de una venta real). */
  items?: { nombre: string; cantidad: number }[];
}

/**
 * Estado de cuenta (§3.6): lista de cargos/abonos con el saldo final. Cada
 * "cargo" trae el detalle de qué productos lo generaron — el cliente debe poder
 * ver de qué es cada monto, no solo el total.
 */
export async function obtenerEstadoCuenta(clienteId: string) {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!cliente) throw new CuentaError('Cliente no encontrado');

  const movimientos = await db
    .select()
    .from(movimientosCuenta)
    .where(eq(movimientosCuenta.clienteId, clienteId))
    .orderBy(asc(movimientosCuenta.creadoEn));

  const movimientosConItems: MovimientoEstadoCuenta[] = [];
  for (const movimiento of movimientos) {
    let items: { nombre: string; cantidad: number }[] | undefined;
    if (movimiento.tipo === 'cargo' && movimiento.ventaId) {
      const filas = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, movimiento.ventaId));
      items = filas.map((fila) => ({ nombre: fila.nombreSnapshot, cantidad: fila.cantidad }));
    }
    movimientosConItems.push({
      id: movimiento.id,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      nota: movimiento.nota,
      creadoEn: movimiento.creadoEn,
      items,
    });
  }

  const saldo = movimientos.reduce(
    (acumulado, movimiento) => (movimiento.tipo === 'abono' ? acumulado - movimiento.monto : acumulado + movimiento.monto),
    0,
  );

  return { cliente, movimientos: movimientosConItems, saldo };
}

export interface SaldoAntiguo {
  cliente: typeof clientes.$inferSelect;
  saldo: number;
  cargoMasAntiguo: string | null;
}

/**
 * Antigüedad de saldos (§3.6): quién debe, cuánto y desde cuándo. Usa la fecha del
 * cargo más antiguo como aproximación de "desde cuándo debe" (no es FIFO exacto
 * contra los abonos parciales, pero es suficiente para priorizar cobros).
 */
export async function obtenerAntiguedadSaldos(): Promise<SaldoAntiguo[]> {
  const todosLosClientes = await db.select().from(clientes);
  const resultado: SaldoAntiguo[] = [];

  for (const cliente of todosLosClientes) {
    const saldo = saldoActualCliente(cliente.id);
    if (saldo <= 0) continue;

    const [cargoMasAntiguo] = await db
      .select()
      .from(movimientosCuenta)
      .where(eq(movimientosCuenta.clienteId, cliente.id))
      .orderBy(asc(movimientosCuenta.creadoEn))
      .limit(1);

    resultado.push({ cliente, saldo, cargoMasAntiguo: cargoMasAntiguo?.creadoEn ?? null });
  }

  return resultado.sort((a, b) => b.saldo - a.saldo);
}
