import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { categorias, productos } from '@/db/schema';

export const GET: APIRoute = async () => {
  const listaCategorias = await db.select().from(categorias).orderBy(asc(categorias.orden));
  const listaProductos = await db
    .select()
    .from(productos)
    .where(eq(productos.activo, true))
    .orderBy(asc(productos.orden));

  return new Response(JSON.stringify({ categorias: listaCategorias, productos: listaProductos }), {
    status: 200,
  });
};
