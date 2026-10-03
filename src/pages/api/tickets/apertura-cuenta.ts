import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { clientes } from '@/db/schema';
import { emitirTicket } from '@/lib/tickets';
import { obtenerConfigImpresora } from '@/lib/pos/configuracionImpresora';
import { ticketAperturaCuenta } from '@/lib/tickets/templates';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { formatoFechaHora } from '@/lib/fecha';

const esquema = z.object({ clienteId: z.string().uuid() });

const NOMBRE_TIPO: Record<string, string> = {
  empresa: 'Empresa',
  personal_nunu: 'Personal NUNU',
  otro: 'Otro',
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), { status: 400 });
  }

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, resultado.data.clienteId));
  if (!cliente) return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), { status: 404 });

  const ticket = ticketAperturaCuenta({
    numeroCuenta: cliente.numeroCuenta,
    nombre: cliente.nombre,
    cedula: cliente.cedula,
    tipo: `${NOMBRE_TIPO[cliente.tipo]}${cliente.organizacion ? ` (${cliente.organizacion})` : ''}`,
    fechaHora: formatoFechaHora(cliente.creadoEn),
    abrioUsuario: usuario.nombre,
  });

  const emision = await emitirTicket(ticket, obtenerConfigImpresora());
  return new Response(JSON.stringify(emision), { status: 200 });
};
