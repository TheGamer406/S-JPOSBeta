import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import { epochDeFechaSqlite } from '@/lib/fecha';

interface Item {
  nombreSnapshot: string;
  cantidad: number;
  nota: string | null;
}

interface Venta {
  id: string;
  numeroOrdenDia: number;
  nombreReferencia: string | null;
  total: number;
  estadoPedido: 'pendiente' | 'preparacion' | 'listo' | 'entregado' | 'anulado';
  estadoPago: string;
  creadoEn: string;
  enEspera: boolean;
  prioridad: boolean;
}

interface Pedido {
  venta: Venta;
  items: Item[];
}

type Filtro = 'pendientes' | 'listos' | 'entregados' | 'todos';

const SIGUIENTE_ESTADO: Record<string, { estado: 'preparacion' | 'listo' | 'entregado'; etiqueta: string }> = {
  pendiente: { estado: 'preparacion', etiqueta: 'En preparación' },
  preparacion: { estado: 'listo', etiqueta: 'Marcar listo' },
  listo: { estado: 'entregado', etiqueta: 'Marcar entregado' },
};

const MINUTOS_ALERTA = 15;

export default function ColaPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [pinAdmin, setPinAdmin] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  async function cambiarEspera(ventaId: string, enEspera: boolean) {
    await fetch('/api/pedidos/espera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventaId, enEspera }),
    });
    cargar();
  }

  async function confirmarAnulacion() {
    setError(null);
    const respuesta = await fetch('/api/pedidos/anular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventaId: anulando, motivo, pinAdmin }),
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo anular');
      return;
    }
    setAnulando(null);
    setMotivo('');
    setPinAdmin('');
    cargar();
  }

  const visibles = pedidos
    .filter(({ venta }) => {
      if (filtro === 'todos') return true;
      if (filtro === 'pendientes') return venta.estadoPedido === 'pendiente' || venta.estadoPedido === 'preparacion';
      if (filtro === 'listos') return venta.estadoPedido === 'listo';
      return venta.estadoPedido === 'entregado';
    })
    .sort((a, b) => {
      // En espera al fondo; prioridad primero; el resto por antigüedad.
      if (a.venta.enEspera !== b.venta.enEspera) return a.venta.enEspera ? 1 : -1;
      if (a.venta.prioridad !== b.venta.prioridad) return a.venta.prioridad ? -1 : 1;
      return epochDeFechaSqlite(a.venta.creadoEn) - epochDeFechaSqlite(b.venta.creadoEn);
    });

  return (
    <div class="flex flex-col gap-4 p-4">
      <div class="flex gap-2">
        {(['pendientes', 'listos', 'entregados', 'todos'] as Filtro[]).map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => setFiltro(opcion)}
            class={`boton-pos rounded-full px-5 capitalize ${
              opcion === filtro ? 'bg-[var(--principal-color)]' : 'bg-[var(--background_color_2)]'
            }`}
          >
            {opcion}
          </button>
        ))}
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map(({ venta, items }) => {
          const minutos = (Date.now() - epochDeFechaSqlite(venta.creadoEn)) / 60000;
          const tarde = minutos > MINUTOS_ALERTA && venta.estadoPedido !== 'entregado';
          const siguiente = SIGUIENTE_ESTADO[venta.estadoPedido];

          return (
            <div
              key={venta.id}
              class={`rounded-xl p-4 ${
                venta.enEspera
                  ? 'bg-[var(--background_color_1)] opacity-60'
                  : tarde
                    ? 'bg-[var(--principal-color)]'
                    : 'bg-[var(--background_color_2)]'
              }`}
            >
              <div class="flex items-center justify-between">
                <span class="text-xl font-bold">#{String(venta.numeroOrdenDia).padStart(3, '0')}</span>
                <span class="monto">{formatoCRC(venta.total)}</span>
              </div>
              <div class="flex gap-2">
                {venta.prioridad && !venta.enEspera && (
                  <span class="rounded bg-[var(--gold)] px-2 text-xs font-bold text-black">⭐ Prioridad</span>
                )}
                {venta.enEspera && <span class="rounded bg-black/40 px-2 text-xs font-bold">⏸ En espera</span>}
              </div>
              {venta.nombreReferencia && <p>{venta.nombreReferencia}</p>}
              <ul class="mt-2 text-sm">
                {items.map((item, indice) => (
                  <li key={indice}>
                    {item.cantidad}x {item.nombreSnapshot}
                    {item.nota && <em> ({item.nota})</em>}
                  </li>
                ))}
              </ul>
              <p class="mt-2 text-xs text-[var(--text_color_2)]">
                {Math.round(minutos)} min · {venta.estadoPago}
              </p>

              <div class="mt-3 flex gap-2">
                {!venta.enEspera && siguiente && (
                  <button
                    type="button"
                    onClick={() => avanzarEstado(venta.id, siguiente.estado)}
                    class="boton-pos flex-1 rounded bg-[var(--accent_color)]"
                  >
                    {siguiente.etiqueta}
                  </button>
                )}
                {venta.estadoPedido !== 'entregado' && (
                  <button
                    type="button"
                    onClick={() => cambiarEspera(venta.id, !venta.enEspera)}
                    class="rounded bg-black/40 px-3 text-sm"
                  >
                    {venta.enEspera ? 'Reanudar' : 'En espera'}
                  </button>
                )}
                {venta.estadoPedido !== 'entregado' && (
                  <button
                    type="button"
                    onClick={() => setAnulando(venta.id)}
                    class="rounded bg-black/40 px-3 text-sm"
                  >
                    Anular
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {anulando && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div class="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-[var(--background_color_1)] p-6">
            <h3 class="text-xl font-bold">Anular venta — pide PIN de admin</h3>
            <input
              placeholder="Motivo"
              value={motivo}
              onInput={(evento) => setMotivo((evento.target as HTMLInputElement).value)}
              class="rounded bg-[var(--background_color_2)] px-3 py-2"
            />
            <input
              type="password"
              placeholder="PIN de admin"
              value={pinAdmin}
              onInput={(evento) => setPinAdmin((evento.target as HTMLInputElement).value)}
              class="rounded bg-[var(--background_color_2)] px-3 py-2"
            />
            {error && <p class="text-[var(--principal-color)]">{error}</p>}
            <div class="flex gap-2">
              <button type="button" onClick={confirmarAnulacion} class="boton-pos flex-1 rounded bg-[var(--principal-color)] font-bold">
                Confirmar anulación
              </button>
              <button type="button" onClick={() => setAnulando(null)} class="rounded bg-[var(--background_color_2)] px-4">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
