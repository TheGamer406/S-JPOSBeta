import type { APIRoute } from 'astro';
import { CuentaError, obtenerEstadoCuenta } from '@/lib/pos/cuentas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const GET: APIRoute = async ({ params, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  try {
    const estado = await obtenerEstadoCuenta(params.id!);
    return new Response(JSON.stringify(estado), { status: 200 });
  } catch (error) {
    if (error instanceof CuentaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }
};
