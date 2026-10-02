import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';

interface FilaReporte {
  etiqueta: string;
  cantidad: number;
  monto: number;
}

interface Reporte {
  porDia: FilaReporte[];
  porProducto: FilaReporte[];
  porMedioPago: FilaReporte[];
  porCajero: FilaReporte[];
  porEvento: FilaReporte[];
  totalVentas: number;
  totalMonto: number;
}

function TablaReporte({ titulo, columnaEtiqueta, filas }: { titulo: string; columnaEtiqueta: string; filas: FilaReporte[] }) {
  return (
    <div>
      <h2 class="mb-2 text-xl font-bold">{titulo}</h2>
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-[var(--background_color_2)] text-[var(--text_color_2)]">
            <th class="py-1 pr-4">{columnaEtiqueta}</th>
            <th class="py-1 pr-4">Cantidad</th>
            <th class="py-1">Monto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.etiqueta} class="border-b border-[var(--background_color_2)]">
              <td class="py-1 pr-4">{fila.etiqueta}</td>
              <td class="py-1 pr-4">{fila.cantidad}</td>
              <td class="monto py-1">{formatoCRC(fila.monto)}</td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={3} class="py-2 text-[var(--text_color_2)]">
                Sin datos para este filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Reportes de ventas (§3.9): por día, producto, medio de pago, cajero y evento. */
export default function PantallaReportes() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [reporte, setReporte] = useState<Reporte | null>(null);

  async function cargar() {
    const parametros = new URLSearchParams();
    if (fechaInicio) parametros.set('fechaInicio', fechaInicio);
    if (fechaFin) parametros.set('fechaFin', fechaFin);
    const respuesta = await fetch(`/api/admin/reportes?${parametros}`);
    setReporte(await respuesta.json());
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div class="flex flex-col gap-6 p-4">
      <h1 class="marca text-3xl">Reportes</h1>

      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1">
          <span class="text-sm text-[var(--text_color_2)]">Desde</span>
          <input type="date" value={fechaInicio} onInput={(e) => setFechaInicio((e.target as HTMLInputElement).value)} class="rounded bg-[var(--background_color_2)] px-3 py-2" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-[var(--text_color_2)]">Hasta</span>
          <input type="date" value={fechaFin} onInput={(e) => setFechaFin((e.target as HTMLInputElement).value)} class="rounded bg-[var(--background_color_2)] px-3 py-2" />
        </label>
        <button type="button" onClick={cargar} class="rounded bg-[var(--accent_color)] px-4 py-2 font-bold">
          Filtrar
        </button>
        <a
          href={`/api/admin/reportes-excel?${new URLSearchParams({ ...(fechaInicio && { fechaInicio }), ...(fechaFin && { fechaFin }) })}`}
          class="rounded bg-[var(--principal-color)] px-4 py-2 font-bold"
        >
          Descargar Excel
        </a>
      </div>

      {reporte && (
        <>
          <p class="monto text-2xl font-bold text-[var(--gold)]">
            {reporte.totalVentas} ventas · {formatoCRC(reporte.totalMonto)}
          </p>

          <TablaReporte titulo="Por día" columnaEtiqueta="Día" filas={reporte.porDia} />
          <TablaReporte titulo="Por producto" columnaEtiqueta="Producto" filas={reporte.porProducto} />
          <TablaReporte titulo="Por medio de pago" columnaEtiqueta="Medio" filas={reporte.porMedioPago} />
          <TablaReporte titulo="Por cajero" columnaEtiqueta="Cajero" filas={reporte.porCajero} />
          <TablaReporte titulo="Por evento" columnaEtiqueta="Evento" filas={reporte.porEvento} />
        </>
      )}
    </div>
  );
}
