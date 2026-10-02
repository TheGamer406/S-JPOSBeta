import type { APIRoute } from 'astro';
import { actualizarUsuario, UsuarioError } from '@/lib/pos/usuarios';
import { esquemaActualizarUsuario } from '@/lib/pos/esquemas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { esAdmin } from '@/lib/permisos';

/** Activar/desactivar o cambiar el PIN de un usuario (§3.9, solo admin). */
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !esAdmin(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const resultado = esquemaActualizarUsuario.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  try {
    await actualizarUsuario(params.id!, resultado.data);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    if (error instanceof UsuarioError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
