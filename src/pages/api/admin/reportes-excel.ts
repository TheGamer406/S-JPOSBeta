import type { APIRoute } from 'astro';
import { obtenerReporteVentas } from '@/lib/pos/reportes';
import { generarExcelReporte } from '@/lib/pos/excelReportes';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';
import { esAdmin } from '@/lib/permisos';

export const GET: APIRoute = async ({ url, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario || !esAdmin(usuario.rol)) {
    return new Response(JSON.stringify({ error: 'Sin permiso' }), { status: 403 });
  }

  const reporte = await obtenerReporteVentas({
    fechaInicio: url.searchParams.get('fechaInicio') ?? undefined,
    fechaFin: url.searchParams.get('fechaFin') ?? undefined,
    eventoId: url.searchParams.get('eventoId') ?? undefined,
  });

  const libro = generarExcelReporte(reporte);
  const buffer = await libro.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="reporte-ventas.xlsx"',
    },
  });
};
