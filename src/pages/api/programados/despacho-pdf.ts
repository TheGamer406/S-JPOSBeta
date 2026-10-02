import type { APIRoute } from 'astro';
import { listarProgramados } from '@/lib/pos/programados';
import { generarPdfDespacho } from '@/lib/pos/pdfDespacho';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

export const GET: APIRoute = async ({ url, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const fecha = url.searchParams.get('fecha');
  const tiempoComida = url.searchParams.get('tiempoComida') as 'almuerzo' | 'cafe' | 'cena' | null;
  if (!fecha || !tiempoComida) {
    return new Response(JSON.stringify({ error: 'Faltan fecha o tiempoComida' }), { status: 400 });
  }

  const pedidos = await listarProgramados(fecha, tiempoComida);
  const doc = generarPdfDespacho(fecha, tiempoComida, pedidos);

  const trozos: Buffer[] = [];
  doc.on('data', (trozo: Buffer) => trozos.push(trozo));
  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.end();
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="despacho-${fecha}-${tiempoComida}.pdf"`,
    },
  });
};
