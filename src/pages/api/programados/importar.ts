import type { APIRoute } from 'astro';
import { z } from 'zod';
import { importarProgramadosCsv } from '@/lib/pos/importarProgramados';
import { obtenerUsuarioActual } from '@/lib/pos/sesionActual';

const esquema = z.object({
  csv: z.string().min(1),
  fechaProgramada: z.string().min(1),
  tiempoComida: z.enum(['almuerzo', 'cafe', 'cena']),
});

/** Importación desde Excel/CSV (§3.5), mismo formato de hoja que ya usan. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = await obtenerUsuarioActual(cookies);
  if (!usuario) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const resultado = esquema.safeParse(await request.json());
  if (!resultado.success) {
    return new Response(JSON.stringify({ error: resultado.error.issues.map((i) => i.message).join('; ') }), {
      status: 400,
    });
  }

  const reporte = await importarProgramadosCsv(
    resultado.data.csv,
    resultado.data.fechaProgramada,
    resultado.data.tiempoComida,
    usuario.id,
  );
  return new Response(JSON.stringify(reporte), { status: 200 });
};
