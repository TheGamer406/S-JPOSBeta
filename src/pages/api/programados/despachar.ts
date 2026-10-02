import type { APIRoute } from 'astro';
import { despacharDeProgramado, ProgramadoError } from '@/lib/pos/programados';
import { esquemaDespacharProgramado } from '@/lib/pos/esquemas';
import { obtenerSesionCajaActiva, obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { puedeVender } from '@/lib/permisos';

/**
 * Despachar parte de un pedido programado (§3.5): crea una venta real con lo
 * que se saca ahora. Pide caja abierta porque es una venta como cualquier otra.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  if (!puedeVender(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso para vender' }), { status: 403 });
  }

  const sesion = await obtenerSesionCajaActiva();
  if (!sesion) return new Response(JSON.stringify({ error: 'No hay caja abierta' }), { status: 409 });

  const resultado = esquemaDespacharProgramado.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  try {
    const despacho = await despacharDeProgramado(resultado.data, usuario.id, sesion.id, sesion.tipoCambioUsd);
    return new Response(JSON.stringify(despacho), { status: 201 });
  } catch (error) {
    if (error instanceof ProgramadoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
