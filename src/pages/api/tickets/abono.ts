import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { pagos } from '@/db/schema';
import { emitirTicket } from '@/lib/tickets';
import { ticketAbono, type MedioPago } from '@/lib/tickets/templates';
import { CuentaError, obtenerEstadoCuenta } from '@/lib/pos/cuentas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

const esquema = z.object({ pagoId: z.string().uuid() });

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  const [pago] = await db.select().from(pagos).where(eq(pagos.id, resultado.data.pagoId));
  if (!pago || !pago.clienteId) {
    return new Response(JSON.stringify({ error: 'Abono no encontrado' }), { status: 404 });
  }

  let estado;
  try {
    estado = await obtenerEstadoCuenta(pago.clienteId);
  } catch (error) {
    if (error instanceof CuentaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }

  const ticket = ticketAbono({
    numeroCuenta: estado.cliente.numeroCuenta,
    nombre: estado.cliente.nombre,
    monto: pago.monto,
    medioPago: pago.metodo as MedioPago,
    fechaHora: pago.creadoEn,
    saldoPendiente: estado.saldo,
  });

  const emision = await emitirTicket(ticket, null);
  return new Response(JSON.stringify(emision), { status: 200 });
};
