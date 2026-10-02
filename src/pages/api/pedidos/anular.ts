import type { APIRoute } from 'astro';
import { esquemaAnularVenta } from '@/lib/pos/esquemas';
import { anularVenta, PedidoError, verificarPinAdmin } from '@/lib/pos/pedidos';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

/** Anular con PIN de admin (§2, §3.4) — aunque esté logueado un cajero. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquemaAnularVenta.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  const admin = await verificarPinAdmin(resultado.data.pinAdmin);
  if (!admin) {
    return new Response(JSON.stringify({ error: 'PIN de admin incorrecto' }), { status: 401 });
  }

  try {
    await anularVenta(resultado.data.ventaId, resultado.data.motivo, admin.id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    if (error instanceof PedidoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }
    throw error;
  }
};
