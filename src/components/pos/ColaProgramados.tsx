import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import ModalGestionProgramado, { type ItemPlan, type ProductoCatalogo } from './ModalGestionProgramado';

interface Venta {
  id: string;
  nombreReferencia: string | null;
  total: number;
  estadoPedido: string;
  tiempoComida: 'almuerzo' | 'cafe' | 'cena' | null;
}

interface Cliente {
  numeroCuenta: string;
  nombre: string;
}

interface Pedido {
  venta: Venta;
  items: ItemPlan[];
  cliente?: Cliente;
  pendiente: number;
}

const NOMBRE_TIEMPO: Record<string, string> = { almuerzo: 'Almuerzo', cafe: 'Café', cena: 'Cena' };

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pedidos programados del día (§3.5): lista compacta, se gestionan de a uno. */
export default function ColaProgramados() {
  const [fecha, setFecha] = useState(hoyISO());
  const [tiempoComida, setTiempoComida] = useState<'' | 'almuerzo' | 'cafe' | 'cena'>('');
  const [busqueda, setBusqueda] = useState('');
  const [tipoCambioUsd, setTipoCambioUsd] = useState(500);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [gestionando, setGestionando] = useState<Pedido | null>(null);

  async function cargar() {
    const parametros = new URLSearchParams({ fecha });
    if (tiempoComida) parametros.set('tiempoComida', tiempoComida);
    const respuesta = await fetch(`/api/programados?${parametros}`);
    const cuerpo = await respuesta.json();
    setPedidos(cuerpo.pedidos ?? []);
  }

  useEffect(() => {
    cargar();
  }, [fecha, tiempoComida]);

  useEffect(() => {
    fetch('/api/caja')
      .then((r) => r.json())
      .then((cuerpo) => cuerpo.sesion && setTipoCambioUsd(cuerpo.sesion.tipoCambioUsd));
    fetch('/api/productos')
      .then((r) => r.json())
      .then((cuerpo) => setProductos(cuerpo.productos ?? []));
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const visibles = texto
    ? pedidos.filter(
        (p) =>
          p.cliente?.nombre.toLowerCase().includes(texto) ||
          p.venta.nombreReferencia?.toLowerCase().includes(texto),
      )
    : pedidos;

  return (
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <div class="flex flex-wrap gap-2">
        <input
          type="date"
          value={fecha}
          onInput={(e) => setFecha((e.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        />
        <select
          value={tiempoComida}
          onChange={(e) => setTiempoComida((e.target as HTMLSelectElement).value as typeof tiempoComida)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        >
          <option value="">Todos los tiempos</option>
          <option value="almuerzo">Almuerzo</option>
          <option value="cafe">Café</option>
          <option value="cena">Cena</option>
        </select>
        <input
          placeholder="Buscar empresa, persona o encargado..."
          value={busqueda}
          onInput={(e) => setBusqueda((e.target as HTMLInputElement).value)}
          class="min-w-[200px] flex-1 rounded bg-[var(--background_color_2)] px-3 py-2"
        />
        {tiempoComida && (
          <a
            href={`/api/programados/despacho-pdf?fecha=${fecha}&tiempoComida=${tiempoComida}`}
            class="rounded bg-[var(--accent_color)] px-4 py-2 font-bold"
          >
            Hoja de despacho
          </a>
        )}
      </div>

      <ul class="flex flex-col gap-2">
        {visibles.map((pedido) => {
          const completo = pedido.pendiente === 0;
          return (
            <li
              key={pedido.venta.id}
              class={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                completo ? 'bg-[var(--background_color_2)] opacity-60' : 'bg-[var(--background_color_2)]'
              }`}
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold">{pedido.cliente?.nombre ?? 'Sin cliente'}</p>
                <p class="truncate text-xs text-[var(--text_color_2)]">
                  {pedido.venta.tiempoComida ? NOMBRE_TIEMPO[pedido.venta.tiempoComida] : ''}
                  {pedido.venta.nombreReferencia ? ` · ${pedido.venta.nombreReferencia}` : ''}
                  {completo ? ' · entregado' : ''}
                </p>
              </div>

              <span class="monto whitespace-nowrap text-sm text-[var(--text_color_2)]">
                {completo ? formatoCRC(pedido.venta.total) : `faltan ${formatoCRC(pedido.pendiente)}`}
              </span>

              <button
                type="button"
                disabled={completo}
                onClick={() => setGestionando(pedido)}
                class="rounded-lg bg-[var(--principal-color)] px-5 py-2 font-bold disabled:opacity-40"
              >
                Gestionar
              </button>
            </li>
          );
        })}

        {visibles.length === 0 && (
          <p class="text-[var(--text_color_2)]">
            {pedidos.length === 0 ? 'No hay pedidos programados para este día.' : 'Ningún pedido coincide con la búsqueda.'}
          </p>
        )}
      </ul>

      {gestionando && (
        <ModalGestionProgramado
          programadoId={gestionando.venta.id}
          nombreCliente={gestionando.cliente?.nombre ?? 'Sin cliente'}
          encargado={gestionando.venta.nombreReferencia}
          items={gestionando.items}
          productos={productos}
          tipoCambioUsd={tipoCambioUsd}
          onListo={() => {
            setGestionando(null);
            cargar();
          }}
          onCerrar={() => setGestionando(null)}
        />
      )}
    </div>
  );
}
