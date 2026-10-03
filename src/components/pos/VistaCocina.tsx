import { useEffect, useState } from 'preact/hooks';
import { epochDeFechaSqlite } from '@/lib/fecha';

interface Item {
  nombreSnapshot: string;
  cantidad: number;
  nota: string | null;
}

interface Venta {
  id: string;
  numeroOrdenDia: number | null;
  nombreReferencia: string | null;
  estadoPedido: 'pendiente' | 'preparacion' | 'listo' | 'entregado' | 'anulado';
  creadoEn: string;
  enEspera: boolean;
  prioridad: boolean;
}

interface Pedido {
  venta: Venta;
  items: Item[];
}

const SIGUIENTE_ESTADO: Record<string, { estado: 'preparacion' | 'listo' | 'entregado'; etiqueta: string }> = {
  pendiente: { estado: 'preparacion', etiqueta: 'En preparación' },
  preparacion: { estado: 'listo', etiqueta: 'Listo' },
  listo: { estado: 'entregado', etiqueta: 'Entregado' },
};

const MINUTOS_ALERTA = 15;

/**
 * Pantalla de cocina (§2, §3.4): solo la cola de pedidos, sin montos ni medios de
 * pago — cocina no ve dinero. Pensada para quedarse abierta en una tablet o TV.
 */
export default function VistaCocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  async function cargar() {
    const respuesta = await fetch('/api/pedidos');
    const cuerpo = await respuesta.json();
    setPedidos(cuerpo.pedidos ?? []);
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 5000);
    return () => clearInterval(intervalo);
  }, []);

  async function avanzarEstado(ventaId: string, estado: 'preparacion' | 'listo' | 'entregado') {
    await fetch('/api/pedidos/estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventaId, estado }),
    });
    cargar();
  }

  const activos = pedidos
    .filter(({ venta }) => venta.estadoPedido !== 'entregado' && venta.estadoPedido !== 'anulado')
    .sort((a, b) => {
      if (a.venta.enEspera !== b.venta.enEspera) return a.venta.enEspera ? 1 : -1;
      if (a.venta.prioridad !== b.venta.prioridad) return a.venta.prioridad ? -1 : 1;
      return epochDeFechaSqlite(a.venta.creadoEn) - epochDeFechaSqlite(b.venta.creadoEn);
    });

  return (
    <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {activos.map(({ venta, items }) => {
        const minutos = (Date.now() - epochDeFechaSqlite(venta.creadoEn)) / 60000;
        const tarde = minutos > MINUTOS_ALERTA;
        const siguiente = SIGUIENTE_ESTADO[venta.estadoPedido];

        return (
          <div
            key={venta.id}
            class={`rounded-lg p-3 ${
              venta.enEspera
                ? 'bg-[var(--background_color_1)] opacity-60'
                : tarde
                  ? 'bg-[var(--principal-color)]'
                  : 'bg-[var(--background_color_2)]'
            }`}
          >
            <div class="flex items-center justify-between">
              <span class="text-xl font-bold">
                {venta.numeroOrdenDia ? `#${String(venta.numeroOrdenDia).padStart(3, '0')}` : 'Programado'}
              </span>
              <span class="text-base">{Math.round(minutos)} min</span>
            </div>
            <div class="flex gap-2">
              {venta.prioridad && !venta.enEspera && (
                <span class="rounded bg-[var(--gold)] px-2 text-xs font-bold text-black">⭐ PRIORIDAD</span>
              )}
              {venta.enEspera && <span class="rounded bg-black/40 px-2 text-xs font-bold">⏸ EN ESPERA</span>}
            </div>
            {venta.nombreReferencia && <p class="text-base">{venta.nombreReferencia}</p>}
            <ul class="mt-2 flex flex-col gap-1 text-lg">
              {items.map((item, indice) => (
                <li key={indice}>
                  {item.cantidad}x {item.nombreSnapshot}
                  {item.nota && <em class="block text-sm"> {item.nota}</em>}
                </li>
              ))}
            </ul>

            {!venta.enEspera && siguiente && (
              <button
                type="button"
                onClick={() => avanzarEstado(venta.id, siguiente.estado)}
                class="boton-pos mt-3 w-full rounded-lg bg-[var(--accent_color)] text-base font-bold"
              >
                {siguiente.etiqueta}
              </button>
            )}
          </div>
        );
      })}
      {activos.length === 0 && <p class="text-xl text-[var(--text_color_2)]">No hay pedidos pendientes.</p>}
    </div>
  );
}
