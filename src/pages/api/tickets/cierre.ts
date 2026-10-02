import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { sesionesCaja, usuarios } from '@/db/schema';
import { calcularCierre, CajaError } from '@/lib/pos/caja';
import { emitirTicket } from '@/lib/tickets';
import { ticketCierre } from '@/lib/tickets/templates';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

const esquema = z.object({ sesionCajaId: z.string().uuid() });

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  let resumen;
  try {
    resumen = await calcularCierre(resultado.data.sesionCajaId);
  } catch (error) {
    if (error instanceof CajaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }

  const [sesion] = await db
    .select()
    .from(sesionesCaja)
    .where(eq(sesionesCaja.id, resultado.data.sesionCajaId));
  const [abrio] = await db.select().from(usuarios).where(eq(usuarios.id, sesion.abiertaPor));
  const [cerro] = sesion.cerradaPor
    ? await db.select().from(usuarios).where(eq(usuarios.id, sesion.cerradaPor))
    : [usuario];

  const ticket = ticketCierre({
    dispositivo: sesion.dispositivo,
    abrioUsuario: abrio?.nombre ?? '—',
    cerroUsuario: cerro?.nombre ?? '—',
    totalesPorMedio: resumen.totalesPorMedio.map((fila) => ({
      medio: fila.medio as 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn' | 'cuenta',
      cantidad: fila.cantidad,
      monto: fila.monto,
    })),
    totalVendido: resumen.totalVendido,
    abonosRecibidos: resumen.abonosRecibidos,
    efectivoEsperado: resumen.efectivoEsperado,
    efectivoContado: sesion.efectivoContado ?? resumen.efectivoEsperado,
    diferenciaEfectivo: sesion.diferenciaEfectivo ?? 0,
  });

  const emision = await emitirTicket(ticket, null);
  return new Response(JSON.stringify(emision), { status: 200 });
};
