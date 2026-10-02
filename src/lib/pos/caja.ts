import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { movimientosCaja, pagos, sesionesCaja } from '@/db/schema';
import { reiniciarNumeroOrdenDia } from '@/db/contadores';
import type { esquemaAbrirCaja, esquemaCerrarCaja } from './esquemas';
import type { z } from 'zod';

export class CajaError extends Error {}

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

  const totalesPorMedio: ResumenMedio[] = [];
  const porMetodo = new Map<string, { cantidad: number; monto: number }>();
  for (const pago of pagosSesion) {
    const actual = porMetodo.get(pago.metodo) ?? { cantidad: 0, monto: 0 };
    actual.cantidad += 1;
    actual.monto += pago.monto;
    porMetodo.set(pago.metodo, actual);
  }
  for (const [medio, valores] of porMetodo) {
    totalesPorMedio.push({ medio, ...valores });
  }

  const totalVendido = pagosSesion.reduce((suma, pago) => suma + pago.monto, 0);

  const vueltosUsd = pagosSesion
    .filter((pago) => pago.metodo === 'efectivo_usd')
    .reduce((suma, pago) => suma + (pago.vuelto ?? 0), 0);

  const efectivoCrc = porMetodo.get('efectivo')?.monto ?? 0;
  const dolaresPagados = porMetodo.get('efectivo_usd')
    ? pagosSesion
        .filter((pago) => pago.metodo === 'efectivo_usd')
        .reduce((suma, pago) => suma + (pago.montoUsd ?? 0), 0)
    : 0;

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

  const loteBac = porMetodo.get('datafono_bac')?.monto ?? 0;
  const loteBn = porMetodo.get('datafono_bn')?.monto ?? 0;

  return {
    sesion,
    totalesPorMedio,
    totalVendido,
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
