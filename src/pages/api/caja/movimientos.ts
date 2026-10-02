import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { movimientosCaja } from '@/db/schema';
import { CajaError, registrarMovimientoCaja } from '@/lib/pos/caja';
import { esquemaMovimientoCaja } from '@/lib/pos/esquemas';
import { obtenerSesionCajaActiva, obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesion = await obtenerSesionCajaActiva();
  if (!sesion) return new Response(JSON.stringify({ movimientos: [] }), { status: 200 });

  const movimientos = await db
    .select()
    .from(movimientosCaja)
    .where(eq(movimientosCaja.sesionCajaId, sesion.id));
  return new Response(JSON.stringify({ movimientos }), { status: 200 });
};

/** Entradas/salidas de efectivo fuera de ventas (§3.7). */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesion = await obtenerSesionCajaActiva();
  if (!sesion) return new Response(JSON.stringify({ error: 'No hay caja abierta' }), { status: 409 });

  const resultado = esquemaMovimientoCaja.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  try {
    const movimiento = await registrarMovimientoCaja(
      sesion.id,
      resultado.data.tipo,
      resultado.data.monto,
      resultado.data.motivo,
      usuario.id,
    );
    return new Response(JSON.stringify({ movimiento }), { status: 201 });
  } catch (error) {
    if (error instanceof CajaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }
    throw error;
  }
};
