import type { APIRoute } from 'astro';
import { marcarEntregaParcial, ProgramadoError } from '@/lib/pos/programados';
import { esquemaEntregarProgramado } from '@/lib/pos/esquemas';
import { obtenerSesionCajaActiva, obtenerUsuarioActual } from '@/lib/pos/sesionActual';

/** Entrega total o parcial por línea (§3.5). Pide caja abierta: el cargo/cobro
 * de lo entregado hoy entra a la sesión del día, igual que una venta o un abono. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesion = await obtenerSesionCajaActiva();
  if (!sesion) return new Response(JSON.stringify({ error: 'No hay caja abierta' }), { status: 409 });

  const resultado = esquemaEntregarProgramado.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  try {
    const entrega = await marcarEntregaParcial(resultado.data, usuario.id, sesion.id, sesion.tipoCambioUsd);
    return new Response(JSON.stringify(entrega), { status: 200 });
  } catch (error) {
    if (error instanceof ProgramadoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
