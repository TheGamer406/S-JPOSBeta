import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';

interface Item {
  id: string;
  nombreSnapshot: string;
  precioSnapshot: number;
  cantidad: number;
  cantidadEntregada: number;
  nota: string | null;
}

interface Venta {
  id: string;
  nombreReferencia: string | null;
  total: number;
  estadoPedido: string;
  estadoPago: string;
  tiempoComida: 'almuerzo' | 'cafe' | 'cena' | null;
}

interface Cliente {
  numeroCuenta: string;
  nombre: string;
  modoPagoDefault: 'cuenta' | 'contra_entrega';
}

interface Pedido {
  venta: Venta;
  items: Item[];
  cliente?: Cliente;
}

type Metodo = 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Entrega total o parcial de pedidos programados (§3.5), por empresa y día. */
export default function ColaProgramados() {
  const [fecha, setFecha] = useState(hoyISO());
  const [tiempoComida, setTiempoComida] = useState<'' | 'almuerzo' | 'cafe' | 'cena'>('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

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

  return (
    <div class="flex flex-col gap-4 p-4">
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
        {tiempoComida && (
          <a
            href={`/api/programados/despacho-pdf?fecha=${fecha}&tiempoComida=${tiempoComida}`}
            class="rounded bg-[var(--accent_color)] px-4 py-2 font-bold"
          >
            Descargar hoja de despacho
          </a>
        )}
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pedidos.map((pedido) => (
          <TarjetaProgramado key={pedido.venta.id} pedido={pedido} onEntregado={cargar} />
        ))}
        {pedidos.length === 0 && <p class="text-[var(--text_color_2)]">No hay pedidos programados para este día.</p>}
      </div>
    </div>
  );
}

function TarjetaProgramado({ pedido, onEntregado }: { pedido: Pedido; onEntregado: () => void }) {
  const [cantidades, setCantidades] = useState<Record<string, string>>(
    Object.fromEntries(pedido.items.map((item) => [item.id, String(item.cantidadEntregada)])),
  );
  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [recibido, setRecibido] = useState('');
  const [montoUsd, setMontoUsd] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const esContraEntrega = pedido.cliente?.modoPagoDefault === 'contra_entrega';

  async function guardarEntrega(evento: SubmitEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const entregas = pedido.items.map((item) => ({
      ventaItemId: item.id,
      cantidadEntregada: Number(cantidades[item.id]) || 0,
    }));

    const cuerpo: Record<string, unknown> = { ventaId: pedido.venta.id, entregas };
    if (esContraEntrega) {
      cuerpo.pago = {
        metodo,
        recibido: metodo === 'efectivo' ? Number(recibido) || undefined : undefined,
        montoUsd: metodo === 'efectivo_usd' ? Number(montoUsd) || undefined : undefined,
        referencia: referencia || undefined,
      };
    }

    const respuesta = await fetch('/api/programados/entregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    const resultado = await respuesta.json();
    setEnviando(false);
    if (!respuesta.ok) {
      setError(resultado.error ?? 'No se pudo guardar la entrega');
      return;
    }

    onEntregado();
  }

  return (
    <form onSubmit={guardarEntrega} class="flex flex-col gap-2 rounded-xl bg-[var(--background_color_2)] p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-bold">{pedido.cliente?.nombre ?? 'Sin cliente'}</h3>
        <span class="monto">{formatoCRC(pedido.venta.total)}</span>
      </div>
      {pedido.venta.nombreReferencia && <p class="text-sm text-[var(--text_color_2)]">Encargado: {pedido.venta.nombreReferencia}</p>}
      <p class="text-sm capitalize text-[var(--text_color_2)]">
        {pedido.venta.estadoPedido} · {pedido.venta.estadoPago} ·{' '}
        {pedido.cliente?.modoPagoDefault === 'cuenta' ? 'a cuenta' : 'contra entrega'}
      </p>

      <ul class="flex flex-col gap-1">
        {pedido.items.map((item) => (
          <li key={item.id} class="flex items-center justify-between gap-2">
            <span class="flex-1">{item.nombreSnapshot}</span>
            <span class="text-sm text-[var(--text_color_2)]">pedido {item.cantidad}</span>
            <input
              type="number"
              min={item.cantidadEntregada}
              max={item.cantidad}
              value={cantidades[item.id]}
              onInput={(e) => setCantidades((c) => ({ ...c, [item.id]: (e.target as HTMLInputElement).value }))}
              class="w-16 rounded bg-[var(--background_color_1)] px-2 py-1 text-right"
            />
          </li>
        ))}
      </ul>

      {esContraEntrega && (
        <div class="flex flex-col gap-2 rounded bg-[var(--background_color_1)] p-2">
          <select
            value={metodo}
            onChange={(e) => setMetodo((e.target as HTMLSelectElement).value as Metodo)}
            class="rounded bg-[var(--background_color_2)] px-2 py-1"
          >
            <option value="efectivo">Efectivo ₡</option>
            <option value="efectivo_usd">Efectivo $</option>
            <option value="sinpe">SINPE Móvil</option>
            <option value="datafono_bac">Datáfono BAC</option>
            <option value="datafono_bn">Datáfono BN</option>
          </select>
          {metodo === 'efectivo' && (
            <input
              type="number"
              placeholder="Recibido (₡)"
              value={recibido}
              onInput={(e) => setRecibido((e.target as HTMLInputElement).value)}
              class="rounded bg-[var(--background_color_2)] px-2 py-1"
            />
          )}
          {metodo === 'efectivo_usd' && (
            <input
              type="number"
              placeholder="Recibido ($)"
              value={montoUsd}
              onInput={(e) => setMontoUsd((e.target as HTMLInputElement).value)}
              class="rounded bg-[var(--background_color_2)] px-2 py-1"
            />
          )}
          {(metodo === 'sinpe' || metodo === 'datafono_bac' || metodo === 'datafono_bn') && (
            <input
              placeholder="Referencia"
              value={referencia}
              onInput={(e) => setReferencia((e.target as HTMLInputElement).value)}
              class="rounded bg-[var(--background_color_2)] px-2 py-1"
            />
          )}
        </div>
      )}

      {error && <p class="text-[var(--principal-color)]">{error}</p>}

      <button type="submit" disabled={enviando} class="boton-pos rounded bg-[var(--principal-color)] font-bold disabled:opacity-40">
        Guardar entrega
      </button>
    </form>
  );
}
