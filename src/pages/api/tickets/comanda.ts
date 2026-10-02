import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { ventaItems, ventas } from '@/db/schema';
import { emitirTicket } from '@/lib/tickets';
import { ticketComandaCocina } from '@/lib/tickets/templates';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

const esquema = z.object({ ventaId: z.string().uuid() });

/** Comanda de cocina (§3.10, opcional): solo productos y notas, sin precios. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  const [venta] = await db.select().from(ventas).where(eq(ventas.id, resultado.data.ventaId));
  if (!venta) return new Response(JSON.stringify({ error: 'Venta no encontrada' }), { status: 404 });

  const items = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, venta.id));

  const ticket = ticketComandaCocina({
    numeroOrden: venta.numeroOrdenDia ?? 0,
    items: items.map((item) => ({
      nombre: item.nombreSnapshot,
      cantidad: item.cantidad,
      nota: item.nota ?? undefined,
    })),
  });

  const emision = await emitirTicket(ticket, null);
  return new Response(JSON.stringify(emision), { status: 200 });
};
