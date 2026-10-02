import type { APIRoute } from 'astro';
import { CuentaError, registrarAbono } from '@/lib/pos/cuentas';
import { esquemaRegistrarAbono } from '@/lib/pos/esquemas';
import { obtenerSesionCajaActiva, obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesion = await obtenerSesionCajaActiva();
  if (!sesion) return new Response(JSON.stringify({ error: 'No hay caja abierta' }), { status: 409 });

  const resultado = esquemaRegistrarAbono.safeParse({ ...(await request.json()), clienteId: params.id });
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  try {
    const abono = await registrarAbono(resultado.data, usuario.id, sesion.id, sesion.tipoCambioUsd);
    return new Response(JSON.stringify(abono), { status: 201 });
  } catch (error) {
    if (error instanceof CuentaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
