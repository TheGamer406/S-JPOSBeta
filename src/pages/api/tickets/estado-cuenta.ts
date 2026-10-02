import type { APIRoute } from 'astro';
import { z } from 'zod';
import { emitirTicket } from '@/lib/tickets';
import { ticketEstadoCuenta } from '@/lib/tickets/templates';
import { CuentaError, obtenerEstadoCuenta } from '@/lib/pos/cuentas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

const esquema = z.object({ clienteId: z.string().uuid() });

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  let estado;
  try {
    estado = await obtenerEstadoCuenta(resultado.data.clienteId);
  } catch (error) {
    if (error instanceof CuentaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }

  const ticket = ticketEstadoCuenta({
    numeroCuenta: estado.cliente.numeroCuenta,
    nombre: estado.cliente.nombre,
    movimientos: estado.movimientos.map((movimiento) => ({
      fecha: movimiento.creadoEn,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
    })),
    saldoFinal: estado.saldo,
  });

  const emision = await emitirTicket(ticket, null);
  return new Response(JSON.stringify(emision), { status: 200 });
};
