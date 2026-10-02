import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { productos } from '@/db/schema';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { puedeVender } from '@/lib/permisos';

const esquema = z.object({ productoId: z.string().uuid(), agotado: z.boolean() });

/** Botón de "producto agotado" (§3.2): cualquier cajero lo puede marcar en el momento. */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !puedeVender(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  await db
    .update(productos)
    .set({ agotado: resultado.data.agotado })
    .where(eq(productos.id, resultado.data.productoId))
    .run();

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
