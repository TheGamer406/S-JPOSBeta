import type { APIRoute } from 'astro';
import { cambiarEspera, PedidoError } from '@/lib/pos/pedidos';
import { esquemaCambiarEspera } from '@/lib/pos/esquemas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { puedeVender } from '@/lib/permisos';

/** Marcar/quitar "en espera" (ej. el cliente se fue) — lo decide el cajero. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !puedeVender(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const resultado = esquemaCambiarEspera.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  try {
    await cambiarEspera(resultado.data.ventaId, resultado.data.enEspera);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    if (error instanceof PedidoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }
    throw error;
  }
};
