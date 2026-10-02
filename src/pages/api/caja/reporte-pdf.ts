import type { APIRoute } from 'astro';
import { CajaError } from '@/lib/pos/caja';
import { construirReporteCierre } from '@/lib/pos/reporteCierre';
import { generarPdfCierre } from '@/lib/pos/pdfCierre';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

/** PDF completo del cierre (§3.8), con el resumen de productos vendidos. */
export const GET: APIRoute = async ({ url, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const sesionCajaId = url.searchParams.get('sesionCajaId');
  if (!sesionCajaId) {
    return new Response(JSON.stringify({ error: 'Falta sesionCajaId' }), { status: 400 });
  }

  let reporte;
  try {
    reporte = await construirReporteCierre(sesionCajaId);
  } catch (error) {
    if (error instanceof CajaError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    throw error;
  }

  const doc = generarPdfCierre(reporte);
  const trozos: Buffer[] = [];
  doc.on('data', (trozo: Buffer) => trozos.push(trozo));

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.end();
  });

  const fecha = reporte.sesion.cerradaEn ?? reporte.sesion.abiertaEn;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cierre-${fecha.replace(/[:\s]/g, '-')}.pdf"`,
    },
  });
};
