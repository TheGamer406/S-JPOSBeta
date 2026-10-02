import type { APIRoute } from 'astro';
import { obtenerAntiguedadSaldos } from '@/lib/pos/cuentas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

/** Reporte de antigüedad de saldos (§3.6): quién debe, cuánto y desde cuándo. */
export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const saldos = await obtenerAntiguedadSaldos();
  return new Response(JSON.stringify({ saldos }), { status: 200 });
};
