import type { APIRoute } from 'astro';
import { obtenerReporteVentas } from '@/lib/pos/reportes';
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

  return new Response(JSON.stringify(reporte), { status: 200 });
};
