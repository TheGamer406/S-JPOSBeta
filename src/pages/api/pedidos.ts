import type { APIRoute } from 'astro';
import { desc, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { ventaItems, ventas } from '@/db/schema';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { puedeVerCola } from '@/lib/permisos';

/** Cola de pedidos del día (§3.4), más recientes primero. */
export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !puedeVerCola(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const todasLasVentas = await db
    .select()
    .from(ventas)
    .where(ne(ventas.estadoPedido, 'anulado'))
    .orderBy(desc(ventas.creadoEn));

  // Un pedido programado (§3.5) es el plan, no un pedido de cocina: lo que entra
  // a esta cola son las ventas que salen al despacharlo en /programados (cada una
  // solo con lo que realmente se sacó), no el pedido completo del día.
  const ventasDelDia = todasLasVentas.filter((venta) => venta.tipo !== 'programado');

  // Se trae todo venta_items una sola vez y se agrupa en memoria (son pocos pedidos por evento).
  const todosLosItems = await db.select().from(ventaItems);
  const itemsPorVenta = new Map<string, (typeof ventaItems.$inferSelect)[]>();
  for (const item of todosLosItems) {
    const lista = itemsPorVenta.get(item.ventaId) ?? [];
    lista.push(item);
    itemsPorVenta.set(item.ventaId, lista);
  }

  const pedidos = ventasDelDia.map((venta) => ({
    venta,
    items: itemsPorVenta.get(venta.id) ?? [],
  }));

  return new Response(JSON.stringify({ pedidos }), { status: 200 });
};
