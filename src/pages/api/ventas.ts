import type { APIRoute } from 'astro';
import { esquemaCrearVenta } from '@/lib/pos/esquemas';
import { crearVenta, VentaError } from '@/lib/pos/ventas';
import { obtenerSesionCajaActiva, obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { puedeVender } from '@/lib/permisos';

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  if (!puedeVender(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso para vender' }), { status: 403 });
  }

  const sesion = await obtenerSesionCajaActiva();
  if (!sesion) {
    return new Response(JSON.stringify({ error: 'No hay caja abierta' }), { status: 409 });
  }

  const resultado = esquemaCrearVenta.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  try {
    const venta = await crearVenta(resultado.data, usuario.id, sesion.id, sesion.tipoCambioUsd);
    return new Response(JSON.stringify(venta), { status: 201 });
  } catch (error) {
    if (error instanceof VentaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
