import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { clientes, movimientosCuenta, pagos } from '@/db/schema';
import { calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';
import { saldoActualCliente } from './ventas';

export class CuentaError extends Error {}

export interface EntradaAbono {
  clienteId: string;
  metodo: 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn';
  monto: number;
  recibido?: number; // solo efectivo
  montoUsd?: number; // solo efectivo_usd
  referencia?: string;
}

/**
 * Registra un abono a cuenta (§3.6): entra como pago (venta_id = null, para
 * distinguirlo de una venta) y como movimiento de tipo "abono" en el libro mayor.
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

  let recibido: number | undefined;
  let vuelto: number | undefined;
  let montoUsd: number | undefined;
  let tipoCambio: number | undefined;

  if (entrada.metodo === 'efectivo') {
    if (entrada.recibido === undefined) throw new CuentaError('Falta el monto recibido');
    recibido = entrada.recibido;
    vuelto = calcularVueltoCrc(entrada.monto, entrada.recibido);
  }
  if (entrada.metodo === 'efectivo_usd') {
    if (entrada.montoUsd === undefined) throw new CuentaError('Falta el monto en dólares');
    montoUsd = entrada.montoUsd;
    tipoCambio = tipoCambioSesion;
    vuelto = calcularVueltoUsd(entrada.monto, entrada.montoUsd, tipoCambioSesion);
  }

  const resultado = sqlite.transaction(() => {
    const pagoId = randomUUID();
    db.insert(pagos)
      .values({
        id: pagoId,
        sesionCajaId,
        ventaId: undefined,
        clienteId: entrada.clienteId,
        metodo: entrada.metodo,
        montoUsd,
        tipoCambio,
        monto: entrada.monto,
        recibido,
        vuelto,
        referencia: entrada.referencia,
        verificado: entrada.metodo !== 'sinpe',
        usuarioId,
      })
      .run();

    const saldoAnterior = saldoActualCliente(entrada.clienteId);
    db.insert(movimientosCuenta)
      .values({
        id: randomUUID(),
        clienteId: entrada.clienteId,
        tipo: 'abono',
        monto: entrada.monto,
        pagoId,
        usuarioId,
      })
      .run();

    return { pagoId, saldoAnterior, saldoNuevo: saldoAnterior - entrada.monto };
  })();

  return { cliente, ...resultado };
}

export interface MovimientoEstadoCuenta {
  id: string;
  tipo: 'cargo' | 'abono' | 'ajuste';
  monto: number;
  nota: string | null;
  creadoEn: string;
}

/** Estado de cuenta (§3.6): lista de cargos/abonos con el saldo final. */
export async function obtenerEstadoCuenta(clienteId: string) {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!cliente) throw new CuentaError('Cliente no encontrado');

  const movimientos = await db
    .select()
    .from(movimientosCuenta)
    .where(eq(movimientosCuenta.clienteId, clienteId))
    .orderBy(asc(movimientosCuenta.creadoEn));

  const saldo = movimientos.reduce(
    (acumulado, movimiento) => (movimiento.tipo === 'abono' ? acumulado - movimiento.monto : acumulado + movimiento.monto),
    0,
  );

  return { cliente, movimientos, saldo };
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
