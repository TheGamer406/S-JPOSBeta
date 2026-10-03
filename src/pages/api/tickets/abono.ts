import type { APIRoute } from 'astro';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { pagos } from '@/db/schema';
import { emitirTicket } from '@/lib/tickets';
import { obtenerConfigImpresora } from '@/lib/pos/configuracionImpresora';
import { ticketAbono, type MedioPago } from '@/lib/tickets/templates';
import { CuentaError, obtenerEstadoCuenta } from '@/lib/pos/cuentas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { formatoFechaHora } from '@/lib/fecha';

// Un abono puede quedar partido en varios pagos (§7, pago dividido) — el tiquete
// es uno solo con una línea por medio usado, por eso recibe la lista completa.
const esquema = z.object({ pagoIds: z.array(z.string().uuid()).min(1) });

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  const pagosAbono = await db.select().from(pagos).where(inArray(pagos.id, resultado.data.pagoIds));
  const clienteId = pagosAbono[0]?.clienteId;
  if (pagosAbono.length === 0 || !clienteId) {
    return new Response(JSON.stringify({ error: 'Abono no encontrado' }), { status: 404 });
  }

  let estado;
  try {
    estado = await obtenerEstadoCuenta(clienteId);
  } catch (error) {
    if (error instanceof CuentaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }

  const ticket = ticketAbono({
    numeroCuenta: estado.cliente.numeroCuenta,
    nombre: estado.cliente.nombre,
    pagos: pagosAbono.map((pago) => ({ metodo: pago.metodo as MedioPago, monto: pago.monto })),
    fechaHora: formatoFechaHora(pagosAbono[0].creadoEn),
    saldoPendiente: estado.saldo,
  });

  const emision = await emitirTicket(ticket, obtenerConfigImpresora());
  return new Response(JSON.stringify(emision), { status: 200 });
};
