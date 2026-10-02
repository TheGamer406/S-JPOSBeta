import type { APIRoute } from 'astro';
import { esquemaCambiarEstadoPedido } from '@/lib/pos/esquemas';
import { cambiarEstadoPedido, PedidoError } from '@/lib/pos/pedidos';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { puedeVerCola } from '@/lib/permisos';

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !puedeVerCola(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const resultado = esquemaCambiarEstadoPedido.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  try {
    await cambiarEstadoPedido(resultado.data.ventaId, resultado.data.estado);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    if (error instanceof PedidoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }
    throw error;
  }
};
