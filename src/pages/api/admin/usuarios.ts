import type { APIRoute } from 'astro';
import { crearUsuario, listarUsuarios, UsuarioError } from '@/lib/pos/usuarios';
import { esquemaCrearUsuario } from '@/lib/pos/esquemas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { esAdmin } from '@/lib/permisos';

export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !esAdmin(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const lista = (await listarUsuarios()).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    creadoEn: u.creadoEn,
  }));
  return new Response(JSON.stringify({ usuarios: lista }), { status: 200 });
};

/** Crear usuario (§3.9, §2: acción sensible, solo admin). */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !esAdmin(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const resultado = esquemaCrearUsuario.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  try {
    const nuevo = await crearUsuario(resultado.data);
    return new Response(JSON.stringify({ usuario: { id: nuevo.id, nombre: nuevo.nombre, rol: nuevo.rol } }), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof UsuarioError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
