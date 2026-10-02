import { useState } from 'preact/hooks';
import { formatoCRC, calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';

export interface ItemPlan {
  id: string;
  nombreSnapshot: string;
  precioSnapshot: number;
  cantidad: number;
  cantidadEntregada: number;
  nota: string | null;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  precio: number;
  agotado: boolean;
}

interface Props {
  programadoId: string;
  nombreCliente: string;
  encargado: string | null;
  items: ItemPlan[];
  productos: ProductoCatalogo[];
  tipoCambioUsd: number;
  onListo: () => void;
  onCerrar: () => void;
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

interface Adicional {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

/**
 * Gestionar un pedido programado (§3.5): se saca una parte del plan — por
 * ejemplo 5 de los 9 arroces y la bebida — y eso se cobra como una venta normal.
 * Lo que no se saca queda pendiente para un despacho posterior.
 */
export default function ModalGestionProgramado({
  programadoId,
  nombreCliente,
  encargado,
  items,
  productos,
  tipoCambioUsd,
  onListo,
  onCerrar,
}: Props) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [sacar, setSacar] = useState<Record<string, string>>({});
  const [adicionales, setAdicionales] = useState<Adicional[]>([]);
  const [productoAgregar, setProductoAgregar] = useState('');
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [montoUsdTexto, setMontoUsdTexto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pendientes = items.filter((item) => item.cantidad - item.cantidadEntregada > 0);

  const totalSacado = pendientes.reduce(
    (suma, item) => suma + (Number(sacar[item.id]) || 0) * item.precioSnapshot,
    0,
  );
  const totalAdicionales = adicionales.reduce((suma, a) => suma + a.precio * a.cantidad, 0);
  const total = totalSacado + totalAdicionales;

  const recibidoNumero = Number(recibidoTexto) || 0;
  const montoUsdNumero = Number(montoUsdTexto) || 0;

  let vuelto: number | null = null;
  if (metodo === 'efectivo' && total > 0 && recibidoNumero >= total) {
    vuelto = calcularVueltoCrc(total, recibidoNumero);
  }
  if (metodo === 'efectivo_usd' && total > 0 && montoUsdNumero > 0) {
    if (montoUsdNumero * tipoCambioUsd >= total) vuelto = calcularVueltoUsd(total, montoUsdNumero, tipoCambioUsd);
  }

  function cambiarSacar(itemId: string, valor: string) {
    setSacar((actual) => ({ ...actual, [itemId]: valor }));
  }

  function sacarTodo() {
    setSacar(Object.fromEntries(pendientes.map((item) => [item.id, String(item.cantidad - item.cantidadEntregada)])));
  }

  function agregarAdicional() {
    const producto = productos.find((p) => p.id === productoAgregar);
    if (!producto) return;
    setAdicionales((actual) => {
      const existente = actual.find((a) => a.productoId === producto.id);
      if (existente) {
        return actual.map((a) => (a.productoId === producto.id ? { ...a, cantidad: a.cantidad + 1 } : a));
      }
      return [...actual, { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 }];
    });
    setProductoAgregar('');
  }

  function cambiarCantidadAdicional(productoId: string, delta: number) {
    setAdicionales((actual) =>
      actual
        .map((a) => (a.productoId === productoId ? { ...a, cantidad: a.cantidad + delta } : a))
        .filter((a) => a.cantidad > 0),
    );
  }

  async function despachar() {
    if (total <= 0 || !metodo || enviando) return;
    setEnviando(true);
    setError(null);

    const lineas = pendientes
      .map((item) => ({ ventaItemId: item.id, cantidad: Number(sacar[item.id]) || 0 }))
      .filter((linea) => linea.cantidad > 0);

    const respuesta = await fetch('/api/programados/despachar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programadoId,
        lineas,
        adicionales: adicionales.map((a) => ({ productoId: a.productoId, cantidad: a.cantidad })),
        pago: {
          metodo,
          recibido: metodo === 'efectivo' ? recibidoNumero || undefined : undefined,
          montoUsd: metodo === 'efectivo_usd' ? montoUsdNumero || undefined : undefined,
          referencia: referencia || undefined,
        },
        idempotencyKey,
      }),
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo despachar');
      setEnviando(false);
      return;
    }

    onListo();
  }

  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div class="flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-auto rounded-xl bg-[var(--background_color_1)] p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="marca text-2xl">{nombreCliente}</h2>
            {encargado && <p class="text-sm text-[var(--text_color_2)]">Encargado: {encargado}</p>}
          </div>
          <button type="button" onClick={onCerrar} class="rounded px-3 py-1 text-[var(--text_color_2)]">
            ✕
          </button>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="font-bold">Pendiente del pedido</h3>
            {pendientes.length > 0 && (
              <button type="button" onClick={sacarTodo} class="rounded bg-[var(--background_color_2)] px-3 py-1 text-sm">
                Sacar todo
              </button>
            )}
          </div>

          {pendientes.length === 0 ? (
            <p class="text-[var(--text_color_2)]">Ya se entregó todo este pedido.</p>
          ) : (
            <ul class="flex flex-col divide-y divide-[var(--background_color_2)] rounded bg-[var(--background_color_2)]">
              {pendientes.map((item) => {
                const queda = item.cantidad - item.cantidadEntregada;
                return (
                  <li key={item.id} class="flex items-center gap-3 px-3 py-2">
                    <span class="flex-1">
                      {item.nombreSnapshot}
                      {item.nota && <em class="block text-xs text-[var(--text_color_2)]">{item.nota}</em>}
                    </span>
                    <span class="text-sm text-[var(--text_color_2)]">quedan {queda}</span>
                    <input
                      type="number"
                      min="0"
                      max={queda}
                      placeholder="0"
                      value={sacar[item.id] ?? ''}
                      onInput={(e) => cambiarSacar(item.id, (e.target as HTMLInputElement).value)}
                      class="w-16 rounded bg-[var(--background_color_1)] px-2 py-1 text-right"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h3 class="mb-2 font-bold">Agregar algo adicional</h3>
          <div class="flex gap-2">
            <select
              value={productoAgregar}
              onChange={(e) => setProductoAgregar((e.target as HTMLSelectElement).value)}
              class="flex-1 rounded bg-[var(--background_color_2)] px-3 py-2"
            >
              <option value="">Elegir producto...</option>
              {productos
                .filter((p) => !p.agotado)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {formatoCRC(p.precio)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!productoAgregar}
              onClick={agregarAdicional}
              class="rounded bg-[var(--accent_color)] px-4 font-bold disabled:opacity-40"
            >
              Agregar
            </button>
          </div>

          {adicionales.length > 0 && (
            <ul class="mt-2 flex flex-col gap-1">
              {adicionales.map((a) => (
                <li key={a.productoId} class="flex items-center gap-2 rounded bg-[var(--background_color_2)] px-3 py-2">
                  <span class="flex-1">{a.nombre}</span>
                  <button type="button" onClick={() => cambiarCantidadAdicional(a.productoId, -1)} class="rounded bg-[var(--background_color_1)] px-3">
                    −
                  </button>
                  <span>{a.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidadAdicional(a.productoId, 1)} class="rounded bg-[var(--background_color_1)] px-3">
                    +
                  </button>
                  <span class="monto w-24 text-right">{formatoCRC(a.precio * a.cantidad)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p class="monto text-right text-3xl font-bold text-[var(--gold)]">{formatoCRC(total)}</p>

        {total > 0 && (
          <div class="flex flex-col gap-2 rounded bg-[var(--background_color_2)] p-3">
            {!metodo && (
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                  <button type="button" onClick={() => setRecibidoTexto(String(total))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
                    Exacto
                  </button>
                  <button type="button" onClick={() => setRecibidoTexto(String(recibidoNumero + 10000))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
                    +₡10 000
                  </button>
                  <button type="button" onClick={() => setRecibidoTexto(String(recibidoNumero + 20000))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
                    +₡20 000
                  </button>
                </div>
                <input
                  type="number"
                  placeholder="Monto recibido"
                  value={recibidoTexto}
                  onInput={(e) => setRecibidoTexto((e.target as HTMLInputElement).value)}
                  class="rounded bg-[var(--background_color_1)] px-3 py-2"
                />
                {vuelto !== null && <p class="monto text-xl font-bold text-[var(--gold)]">Vuelto: {formatoCRC(vuelto)}</p>}
              </div>
            )}

            {metodo === 'efectivo_usd' && (
              <div class="flex flex-col gap-2">
                <div class="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      onClick={() => setMontoUsdTexto(String(montoUsdNumero + billete))}
                      class="boton-pos rounded bg-[var(--pago-efectivo-usd)] text-black"
                    >
                      ${billete}
                    </button>
                  ))}
                </div>
                <p>
                  Recibido: ${montoUsdTexto || 0} (TC ₡{tipoCambioUsd})
                </p>
                {vuelto !== null && <p class="monto text-xl font-bold text-[var(--gold)]">Vuelto: {formatoCRC(vuelto)}</p>}
              </div>
            )}

            {(metodo === 'sinpe' || metodo === 'datafono_bac' || metodo === 'datafono_bn') && (
              <input
                placeholder={metodo === 'sinpe' ? 'N.º de comprobante' : 'N.º de autorización (opcional)'}
                value={referencia}
                onInput={(e) => setReferencia((e.target as HTMLInputElement).value)}
                class="rounded bg-[var(--background_color_1)] px-3 py-2"
              />
            )}

            {metodo === 'cuenta' && <p>Se carga {formatoCRC(total)} a la cuenta de {nombreCliente}.</p>}

            {metodo && (
              <button type="button" onClick={() => setMetodo(null)} class="text-sm text-[var(--text_color_2)]">
                cambiar medio de pago
              </button>
            )}
          </div>
        )}

        {error && <p class="text-[var(--principal-color)]">{error}</p>}

        <div class="flex gap-3">
          <button type="button" onClick={onCerrar} class="boton-pos flex-1 rounded-lg bg-[var(--background_color_2)]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={total <= 0 || !metodo || enviando}
            onClick={despachar}
            class="boton-pos flex-1 rounded-lg bg-[var(--principal-color)] font-bold disabled:opacity-40"
          >
            Cobrar y despachar
          </button>
        </div>
      </div>
    </div>
  );
}
