import type { AstroCookies } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { sesionesCaja, usuarios } from '@/db/schema';

export async function obtenerUsuarioActual(cookies: AstroCookies) {
  const idUsuario = cookies.get('sj_pos_usuario')?.value;
  if (!idUsuario) return null;

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, idUsuario));
  return usuario ?? null;
}

/** "Sin caja abierta no se puede vender" (§3.1). Una sola caja activa a la vez (§8, decisión 5). */
export async function obtenerSesionCajaActiva() {
  const [sesion] = await db
    .select()
    .from(sesionesCaja)
    .where(eq(sesionesCaja.estado, 'abierta'));
  return sesion ?? null;
}
