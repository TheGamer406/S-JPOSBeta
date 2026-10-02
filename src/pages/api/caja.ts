import type { APIRoute } from 'astro';
import { abrirCaja, CajaError } from '@/lib/pos/caja';
import { esquemaAbrirCaja } from '@/lib/pos/esquemas';
import { obtenerSesionCajaActiva, obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesion = await obtenerSesionCajaActiva();
  return new Response(JSON.stringify({ sesion }), { status: 200 });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquemaAbrirCaja.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  try {
    const sesion = await abrirCaja(resultado.data, usuario.id);
    return new Response(JSON.stringify({ sesion }), { status: 201 });
  } catch (error) {
    if (error instanceof CajaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }
    throw error;
  }
};
