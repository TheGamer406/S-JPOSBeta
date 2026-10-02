import type { APIRoute } from 'astro';
import { buscarClientes, ClienteError, crearCliente } from '@/lib/pos/clientes';
import { esquemaCrearCliente } from '@/lib/pos/esquemas';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const GET: APIRoute = async ({ url, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const consulta = url.searchParams.get('q') ?? '';
  const resultados = await buscarClientes(consulta);
  return new Response(JSON.stringify({ clientes: resultados }), { status: 200 });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquemaCrearCliente.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.message }), { status: 400 });
  }

  try {
    const cliente = await crearCliente(resultado.data);
    return new Response(JSON.stringify({ cliente }), { status: 201 });
  } catch (error) {
    if (error instanceof ClienteError) {
      return new Response(
        JSON.stringify({ error: error.message, clienteExistente: error.clienteExistente }),
        { status: 409 },
      );
    }
    throw error;
  }
};
