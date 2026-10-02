import type { APIRoute } from 'astro';
import { CajaError, calcularCierre, cerrarCaja } from '@/lib/pos/caja';
import { esquemaCerrarCaja } from '@/lib/pos/esquemas';
import { esAdmin, puedeVender } from '@/lib/permisos';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { respaldarCierre } from '@/lib/pos/respaldos';

/** Corte parcial (X): ver cómo va la caja sin cerrarla (§3.8). */
export const GET: APIRoute = async ({ url, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesionCajaId = url.searchParams.get('sesionCajaId');
  if (!sesionCajaId) {
    return new Response(JSON.stringify({ error: 'Falta sesionCajaId' }), { status: 400 });
  }

  try {
    const resumen = await calcularCierre(sesionCajaId);
    return new Response(JSON.stringify(resumen), { status: 200 });
  } catch (error) {
    if (error instanceof CajaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  if (!puedeVender(usuario.rol) && !esAdmin(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const resultado = esquemaCerrarCaja.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  try {
    const cierre = await cerrarCaja(resultado.data, usuario.id);

    // El respaldo nunca debe tumbar el cierre: ya quedó guardado en la base de
    // datos. Si falla (ej. disco lleno, sin permisos), se avisa pero no se revierte.
    let respaldo: { dbPath: string; pdfPath: string } | undefined;
    let avisoRespaldo: string | undefined;
    try {
      respaldo = await respaldarCierre(resultado.data.sesionCajaId);
    } catch (error) {
      avisoRespaldo = `No se pudo guardar el respaldo automático: ${error instanceof Error ? error.message : error}`;
    }

    return new Response(JSON.stringify({ ...cierre, respaldo, avisoRespaldo }), { status: 200 });
  } catch (error) {
    if (error instanceof CajaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }
    throw error;
  }
};
