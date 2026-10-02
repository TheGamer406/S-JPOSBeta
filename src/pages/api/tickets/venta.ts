import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { clientes, pagos, usuarios, ventaItems, ventas } from '@/db/schema';
import { emitirTicket } from '@/lib/tickets';
import { ticketCargoCuenta, ticketVenta, type PagoVenta } from '@/lib/tickets/templates';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { saldoActualCliente } from '@/lib/pos/ventas';

const esquema = z.object({ ventaId: z.string().uuid() });

/**
 * Construye e intenta imprimir el tiquete de una venta ya creada. Sin impresora
 * configurada todavía (§8, decisión pendiente 4), `emitirTicket` siempre cae a la
 * vista previa en pantalla — por eso esta ruta siempre responde con `html`.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuarioSesion = await obtenerUsuarioActual(cookies);
  if (!usuarioSesion) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  const [venta] = await db.select().from(ventas).where(eq(ventas.id, resultado.data.ventaId));
  if (!venta) return new Response(JSON.stringify({ error: 'Venta no encontrada' }), { status: 404 });

  const items = await db.select().from(ventaItems).where(eq(ventaItems.ventaId, venta.id));
  const pagosVenta = await db.select().from(pagos).where(eq(pagos.ventaId, venta.id));
  const [cajero] = await db.select().from(usuarios).where(eq(usuarios.id, venta.usuarioId));

  const pagosParaTicket: PagoVenta[] = pagosVenta.map((pago) => ({
    metodo: pago.metodo as PagoVenta['metodo'],
    monto: pago.monto,
    recibido: pago.recibido ?? undefined,
    vuelto: pago.vuelto ?? undefined,
    montoUsd: pago.montoUsd ?? undefined,
    tipoCambio: pago.tipoCambio ?? undefined,
  }));

  const itemsTicket = items.map((item) => ({
    nombre: item.nombreSnapshot,
    cantidad: item.cantidad,
    subtotal: item.subtotal,
    nota: item.nota ?? undefined,
  }));

  const esACuentaOParcial = venta.estadoPago === 'a_cuenta' || venta.estadoPago === 'parcial';

  let ticket;
  if (esACuentaOParcial && venta.clienteId) {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, venta.clienteId));
    const movimientoCargo = pagosVenta.find((pago) => pago.metodo === 'cuenta');
    const saldoActual = cliente ? saldoActualCliente(cliente.id) : 0;
    ticket = ticketCargoCuenta({
      numeroOrden: venta.numeroOrdenDia,
      fechaHora: venta.creadoEn,
      cajero: cajero?.nombre ?? '—',
      items: itemsTicket,
      total: venta.total,
      numeroCuenta: cliente?.numeroCuenta ?? '—',
      nombre: cliente?.nombre ?? '—',
      saldoAnterior: saldoActual - (movimientoCargo?.monto ?? 0),
      saldoNuevo: saldoActual,
    });
  } else {
    ticket = ticketVenta({
      numeroOrden: venta.numeroOrdenDia,
      fechaHora: venta.creadoEn,
      cajero: cajero?.nombre ?? '—',
      items: itemsTicket,
      total: venta.total,
      pagos: pagosParaTicket,
    });
  }

  const emision = await emitirTicket(ticket, null);
  return new Response(JSON.stringify(emision), { status: 200 });
};
