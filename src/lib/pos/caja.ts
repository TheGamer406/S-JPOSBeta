import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { movimientosCaja, pagos, sesionesCaja } from '@/db/schema';
import { reiniciarNumeroOrdenDia } from '@/db/contadores';
import type { esquemaAbrirCaja, esquemaCerrarCaja } from './esquemas';
import type { z } from 'zod';

export class CajaError extends Error {}

/** Entradas/salidas de efectivo fuera de ventas (§3.7): hielo, gas, cambio agregado... */
export async function registrarMovimientoCaja(
  sesionCajaId: string,
  tipo: 'entrada' | 'salida',
  monto: number,
  motivo: string,
  usuarioId: string,
) {
  const [sesion] = await db.select().from(sesionesCaja).where(eq(sesionesCaja.id, sesionCajaId));
  if (!sesion) throw new CajaError('Sesión de caja no encontrada');
  if (sesion.estado !== 'abierta') throw new CajaError('La sesión ya está cerrada');

  const id = randomUUID();
  db.insert(movimientosCaja).values({ id, sesionCajaId, tipo, monto, motivo, usuarioId }).run();
  const [movimiento] = await db.select().from(movimientosCaja).where(eq(movimientosCaja.id, id));
  return movimiento;
}

/** "Sin caja abierta no se puede vender" (§3.1). */
export async function abrirCaja(input: z.infer<typeof esquemaAbrirCaja>, usuarioId: string) {
  const sesionExistente = await db
    .select()
    .from(sesionesCaja)
    .where(eq(sesionesCaja.estado, 'abierta'));

  if (sesionExistente.length > 0) {
    throw new CajaError('Ya hay una sesión de caja abierta');
  }

  reiniciarNumeroOrdenDia();

  const id = randomUUID();
  db.insert(sesionesCaja)
    .values({
      id,
      eventoId: input.eventoId,
      dispositivo: input.dispositivo,
      abiertaPor: usuarioId,
      fondoInicial: input.fondoInicial,
      tipoCambioUsd: input.tipoCambioUsd,
    })
    .run();

  const [sesion] = await db.select().from(sesionesCaja).where(eq(sesionesCaja.id, id));
  return sesion;
}

interface ResumenMedio {
  medio: string;
  cantidad: number;
  monto: number;
}

/** Arqueo del cierre (§3.8): suma por medio, efectivo esperado y diferencias. */
export async function calcularCierre(sesionCajaId: string) {
  const [sesion] = await db
    .select()
    .from(sesionesCaja)
    .where(eq(sesionesCaja.id, sesionCajaId));
  if (!sesion) throw new CajaError('Sesión de caja no encontrada');

  const pagosSesion = await db
    .select()
    .from(pagos)
    .where(and(eq(pagos.sesionCajaId, sesionCajaId), eq(pagos.anulado, false)));

  // Un pago con venta_id es una venta; sin venta_id es un abono a cuenta (§3.6).
  // El reporte (§3.8) los muestra separados: "TOTAL VENDIDO" vs. "ABONOS A CUENTAS
  // RECIBIDOS" — mezclarlos haría ver como venta algo que es cobro de una deuda vieja.
  const pagosVenta = pagosSesion.filter((pago) => pago.ventaId !== null);
  const pagosAbono = pagosSesion.filter((pago) => pago.ventaId === null);

  const totalesPorMedio: ResumenMedio[] = [];
  const porMetodoVenta = new Map<string, { cantidad: number; monto: number }>();
  for (const pago of pagosVenta) {
    const actual = porMetodoVenta.get(pago.metodo) ?? { cantidad: 0, monto: 0 };
    actual.cantidad += 1;
    actual.monto += pago.monto;
    porMetodoVenta.set(pago.metodo, actual);
  }
  for (const [medio, valores] of porMetodoVenta) {
    totalesPorMedio.push({ medio, ...valores });
  }

  const totalVendido = pagosVenta.reduce((suma, pago) => suma + pago.monto, 0);
  const abonosRecibidos = pagosAbono.reduce((suma, pago) => suma + pago.monto, 0);

  // El efectivo esperado en caja sí suma TODO el efectivo físico, venga de una
  // venta o de un abono — ambos agregan billetes a la gaveta.
  const vueltosUsd = pagosSesion
    .filter((pago) => pago.metodo === 'efectivo_usd')
    .reduce((suma, pago) => suma + (pago.vuelto ?? 0), 0);

  const efectivoCrc = pagosSesion
    .filter((pago) => pago.metodo === 'efectivo')
    .reduce((suma, pago) => suma + pago.monto, 0);
  const dolaresPagados = pagosSesion
    .filter((pago) => pago.metodo === 'efectivo_usd')
    .reduce((suma, pago) => suma + (pago.montoUsd ?? 0), 0);

  const movimientos = await db
    .select()
    .from(movimientosCaja)
    .where(eq(movimientosCaja.sesionCajaId, sesionCajaId));
  const entradas = movimientos
    .filter((movimiento) => movimiento.tipo === 'entrada')
    .reduce((suma, movimiento) => suma + movimiento.monto, 0);
  const salidas = movimientos
    .filter((movimiento) => movimiento.tipo === 'salida')
    .reduce((suma, movimiento) => suma + movimiento.monto, 0);

  const efectivoEsperado = sesion.fondoInicial + efectivoCrc - vueltosUsd - salidas + entradas;

  // El lote del datáfono cuadra contra TODO lo que pasó por él, venta o abono.
  const loteBac = pagosSesion
    .filter((pago) => pago.metodo === 'datafono_bac')
    .reduce((suma, pago) => suma + pago.monto, 0);
  const loteBn = pagosSesion
    .filter((pago) => pago.metodo === 'datafono_bn')
    .reduce((suma, pago) => suma + pago.monto, 0);

  return {
    sesion,
    totalesPorMedio,
    totalVendido,
    abonosRecibidos,
    efectivoEsperado,
    dolaresPagados,
    loteSistemaBac: loteBac,
    loteSistemaBn: loteBn,
  };
}

export async function cerrarCaja(input: z.infer<typeof esquemaCerrarCaja>, usuarioId: string) {
  const resumen = await calcularCierre(input.sesionCajaId);
  if (resumen.sesion.estado !== 'abierta') {
    throw new CajaError('Esta sesión ya está cerrada');
  }

  const diferenciaEfectivo = input.efectivoContado - resumen.efectivoEsperado;

  db.update(sesionesCaja)
    .set({
      cerradaPor: usuarioId,
      cerradaEn: sql`(current_timestamp)`,
      efectivoContado: input.efectivoContado,
      conteoDenominaciones: input.conteoDenominaciones,
      usdContado: input.usdContado,
      conteoUsd: input.conteoUsd,
      loteBac: input.loteBac,
      loteBn: input.loteBn,
      diferenciaEfectivo,
      notasCierre: input.notasCierre,
      estado: 'cerrada',
    })
    .where(eq(sesionesCaja.id, input.sesionCajaId))
    .run();

  return { ...resumen, efectivoContado: input.efectivoContado, diferenciaEfectivo };
}
