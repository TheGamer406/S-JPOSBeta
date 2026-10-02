import { useEffect, useState } from 'preact/hooks';
import { formatoCRC, calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';

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
}

interface Pedido {
  venta: Venta;
  items: Item[];
  cliente?: Cliente;
}

type Metodo = 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn' | 'cuenta';

const NOMBRE_METODO: Record<Metodo, string> = {
  efectivo: 'Efectivo ₡',
  efectivo_usd: 'Efectivo $',
  sinpe: 'SINPE Móvil',
  datafono_bac: 'Datáfono BAC',
  datafono_bn: 'Datáfono BN',
  cuenta: 'A cuenta',
};

const COLOR_METODO: Record<Metodo, string> = {
  efectivo: 'var(--pago-efectivo-crc)',
  efectivo_usd: 'var(--pago-efectivo-usd)',
  sinpe: 'var(--pago-sinpe)',
  datafono_bac: 'var(--pago-bac)',
  datafono_bn: 'var(--pago-bn)',
  cuenta: 'var(--pago-cuenta)',
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Entrega total o parcial de pedidos programados (§3.5), por empresa y día. */
export default function ColaProgramados() {
  const [fecha, setFecha] = useState(hoyISO());
  const [tiempoComida, setTiempoComida] = useState<'' | 'almuerzo' | 'cafe' | 'cena'>('');
  const [busqueda, setBusqueda] = useState('');
  const [tipoCambioUsd, setTipoCambioUsd] = useState(500);
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

  useEffect(() => {
    fetch('/api/caja')
      .then((r) => r.json())
      .then((cuerpo) => cuerpo.sesion && setTipoCambioUsd(cuerpo.sesion.tipoCambioUsd));
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
        <input
          placeholder="Buscar empresa, persona o encargado..."
          value={busqueda}
          onInput={(e) => setBusqueda((e.target as HTMLInputElement).value)}
          class="min-w-[220px] flex-1 rounded bg-[var(--background_color_2)] px-3 py-2"
        />
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
        {visibles.map((pedido) => (
          <TarjetaProgramado key={pedido.venta.id} pedido={pedido} tipoCambioUsd={tipoCambioUsd} onEntregado={cargar} />
        ))}
        {visibles.length === 0 && (
          <p class="text-[var(--text_color_2)]">
            {pedidos.length === 0 ? 'No hay pedidos programados para este día.' : 'Ningún pedido coincide con la búsqueda.'}
          </p>
        )}
      </div>
    </div>
  );
}

function TarjetaProgramado({
  pedido,
  tipoCambioUsd,
  onEntregado,
}: {
  pedido: Pedido;
  tipoCambioUsd: number;
  onEntregado: () => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, string>>(
    Object.fromEntries(pedido.items.map((item) => [item.id, String(item.cantidadEntregada)])),
  );
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [montoUsdTexto, setMontoUsdTexto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const montoACobrar = pedido.items.reduce((suma, item) => {
    const nueva = Number(cantidades[item.id]) || 0;
    return suma + Math.max(0, nueva - item.cantidadEntregada) * item.precioSnapshot;
  }, 0);

  const recibidoNumero = Number(recibidoTexto) || 0;
  const montoUsdNumero = Number(montoUsdTexto) || 0;

  let vueltoPreview: number | null = null;
  if (metodo === 'efectivo' && recibidoNumero >= montoACobrar && montoACobrar > 0) {
    vueltoPreview = calcularVueltoCrc(montoACobrar, recibidoNumero);
  }
  if (metodo === 'efectivo_usd' && montoUsdNumero > 0 && montoACobrar > 0) {
    const recibidoCrc = montoUsdNumero * tipoCambioUsd;
    if (recibidoCrc >= montoACobrar) vueltoPreview = calcularVueltoUsd(montoACobrar, montoUsdNumero, tipoCambioUsd);
  }

  const listoParaGuardar = montoACobrar === 0 || metodo !== null;

  async function guardarEntrega() {
    if (!listoParaGuardar || enviando) return;
    setEnviando(true);
    setError(null);

    const entregas = pedido.items.map((item) => ({
      ventaItemId: item.id,
      cantidadEntregada: Number(cantidades[item.id]) || 0,
    }));

    const cuerpo: Record<string, unknown> = { ventaId: pedido.venta.id, entregas };
    if (montoACobrar > 0 && metodo) {
      cuerpo.pago = {
        metodo,
        recibido: metodo === 'efectivo' ? recibidoNumero || undefined : undefined,
        montoUsd: metodo === 'efectivo_usd' ? montoUsdNumero || undefined : undefined,
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
    <div class="flex flex-col gap-2 rounded-xl bg-[var(--background_color_2)] p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-bold">{pedido.cliente?.nombre ?? 'Sin cliente'}</h3>
        <span class="monto">{formatoCRC(pedido.venta.total)}</span>
      </div>
      {pedido.venta.nombreReferencia && <p class="text-sm text-[var(--text_color_2)]">Encargado: {pedido.venta.nombreReferencia}</p>}
      <p class="text-sm capitalize text-[var(--text_color_2)]">
        {pedido.venta.estadoPedido} · {pedido.venta.estadoPago}
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

      {montoACobrar > 0 && (
        <div class="flex flex-col gap-2 rounded bg-[var(--background_color_1)] p-3">
          <p class="monto text-lg font-bold text-[var(--gold)]">A cobrar esta entrega: {formatoCRC(montoACobrar)}</p>

          {!metodo && (
            <div class="grid grid-cols-2 gap-2">
              {(Object.keys(NOMBRE_METODO) as Metodo[]).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setMetodo(opcion)}
                  style={{ backgroundColor: COLOR_METODO[opcion] }}
                  class="boton-pos rounded-lg font-bold text-black"
                >
                  {NOMBRE_METODO[opcion]}
                </button>
              ))}
            </div>
          )}

          {metodo === 'efectivo' && (
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setRecibidoTexto(String(montoACobrar))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
                  Exacto
                </button>
                <button type="button" onClick={() => setRecibidoTexto(String(Number(recibidoTexto || 0) + 10000))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
                  +₡10 000
                </button>
                <button type="button" onClick={() => setRecibidoTexto(String(Number(recibidoTexto || 0) + 20000))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
                  +₡20 000
                </button>
              </div>
              <input
                type="number"
                placeholder="Monto recibido"
                value={recibidoTexto}
                onInput={(e) => setRecibidoTexto((e.target as HTMLInputElement).value)}
                class="rounded bg-[var(--background_color_2)] px-2 py-1"
              />
              {vueltoPreview !== null && <p class="monto font-bold text-[var(--gold)]">Vuelto: {formatoCRC(vueltoPreview)}</p>}
              <button type="button" onClick={() => setMetodo(null)} class="text-sm text-[var(--text_color_2)]">
                cambiar medio de pago
              </button>
            </div>
          )}

          {metodo === 'efectivo_usd' && (
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-3 gap-2">
                {[1, 5, 10, 20, 50, 100].map((billete) => (
                  <button
                    key={billete}
                    type="button"
                    onClick={() => setMontoUsdTexto(String(Number(montoUsdTexto || 0) + billete))}
                    class="boton-pos rounded bg-[var(--pago-efectivo-usd)] text-black"
                  >
                    ${billete}
                  </button>
                ))}
              </div>
              <p>Recibido: ${montoUsdTexto || 0} (TC ₡{tipoCambioUsd})</p>
              {vueltoPreview !== null && <p class="monto font-bold text-[var(--gold)]">Vuelto: {formatoCRC(vueltoPreview)}</p>}
              <button type="button" onClick={() => setMetodo(null)} class="text-sm text-[var(--text_color_2)]">
                cambiar medio de pago
              </button>
            </div>
          )}

          {(metodo === 'sinpe' || metodo === 'datafono_bac' || metodo === 'datafono_bn') && (
            <div class="flex flex-col gap-2">
              <input
                placeholder={metodo === 'sinpe' ? 'N.º de comprobante' : 'N.º de autorización (opcional)'}
                value={referencia}
                onInput={(e) => setReferencia((e.target as HTMLInputElement).value)}
                class="rounded bg-[var(--background_color_2)] px-2 py-1"
              />
              <button type="button" onClick={() => setMetodo(null)} class="text-sm text-[var(--text_color_2)]">
                cambiar medio de pago
              </button>
            </div>
          )}

          {metodo === 'cuenta' && (
            <div class="flex flex-col gap-2">
              <p>Se carga {formatoCRC(montoACobrar)} a la cuenta de {pedido.cliente?.nombre}.</p>
              <button type="button" onClick={() => setMetodo(null)} class="text-sm text-[var(--text_color_2)]">
                cambiar medio de pago
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p class="text-[var(--principal-color)]">{error}</p>}

      <button
        type="button"
        disabled={!listoParaGuardar || enviando}
        onClick={guardarEntrega}
        class="boton-pos rounded bg-[var(--principal-color)] font-bold disabled:opacity-40"
      >
        Guardar entrega
      </button>
    </div>
  );
}
