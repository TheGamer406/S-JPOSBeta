import type { APIRoute } from 'astro';
import { crearPedidoProgramado, listarProgramados, ProgramadoError } from '@/lib/pos/programados';
import { esquemaCrearProgramado } from '@/lib/pos/esquemas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const GET: APIRoute = async ({ url, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const fecha = url.searchParams.get('fecha');
  if (!fecha) return new Response(JSON.stringify({ error: 'Falta fecha' }), { status: 400 });
  const tiempoComida = url.searchParams.get('tiempoComida') as 'almuerzo' | 'cafe' | 'cena' | null;

  const pedidos = await listarProgramados(fecha, tiempoComida ?? undefined);
  return new Response(JSON.stringify({ pedidos }), { status: 200 });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquemaCrearProgramado.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  try {
    const pedido = await crearPedidoProgramado(resultado.data, usuario.id);
    return new Response(JSON.stringify(pedido), { status: 201 });
  } catch (error) {
    if (error instanceof ProgramadoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }
};
