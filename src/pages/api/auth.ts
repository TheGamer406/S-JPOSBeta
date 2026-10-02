import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { usuarios } from '@/db/schema';

// Login con PIN (§2): se compara contra el pin_hash de cada usuario activo.
// Suficiente para una plantilla pequeña y uso 100% local (§8); no hay sesión en la nube.
export const POST: APIRoute = async ({ request, cookies }) => {
  const { pin } = await request.json();

  if (typeof pin !== 'string' || pin.length < 4 || pin.length > 6) {
    return new Response(JSON.stringify({ error: 'PIN inválido' }), { status: 400 });
  }

  const activos = await db.select().from(usuarios).where(eq(usuarios.activo, true));
  const coincidencia = activos.find((usuario) => bcrypt.compareSync(pin, usuario.pinHash));

  if (!coincidencia) {
    return new Response(JSON.stringify({ error: 'PIN incorrecto' }), { status: 401 });
  }

  cookies.set('sj_pos_usuario', coincidencia.id, { httpOnly: true, path: '/', sameSite: 'lax' });

  return new Response(
    JSON.stringify({ id: coincidencia.id, nombre: coincidencia.nombre, rol: coincidencia.rol }),
    { status: 200 },
  );
};
