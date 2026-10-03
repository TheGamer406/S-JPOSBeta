import { useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import SelectorPago, { type PagoAgregado, type Metodo } from './SelectorPago';
import ConfirmarImpresion from './ConfirmarImpresion';
import VistaPreviaTicket from './VistaPreviaTicket';

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
  clienteId: string;
  numeroCuenta: string;
  nombreCliente: string;
  encargado: string | null;
  items: ItemPlan[];
  productos: ProductoCatalogo[];
  tipoCambioUsd: number;
  onListo: () => void;
  onCerrar: () => void;
}

const METODOS: Metodo[] = ['efectivo', 'efectivo_usd', 'sinpe', 'datafono_bac', 'datafono_bn', 'cuenta'];

interface Adicional {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

/**
 * Gestionar un pedido programado (§3.5): se saca una parte del plan — por
 * ejemplo 5 de los 9 arroces y la bebida — y eso se cobra igual que una venta
 * normal, con el mismo `SelectorPago` compartido (métodos, atajos, pago
 * dividido y a cuenta — §7). Lo que no se saca queda pendiente para un
 * despacho posterior.
 */
export default function ModalGestionProgramado({
  programadoId,
  clienteId,
  numeroCuenta,
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
  const [pagos, setPagos] = useState<PagoAgregado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendienteImprimir, setPendienteImprimir] = useState<{ ventaId: string; avisoLimite?: string } | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<{ html: string; aviso?: string } | null>(null);

  const pendientes = items.filter((item) => item.cantidad - item.cantidadEntregada > 0);

  const totalSacado = pendientes.reduce(
    (suma, item) => suma + (Number(sacar[item.id]) || 0) * item.precioSnapshot,
    0,
  );
  const totalAdicionales = adicionales.reduce((suma, a) => suma + a.precio * a.cantidad, 0);
  const total = totalSacado + totalAdicionales;

  const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const faltante = total - pagado;

  function cambiarSacar(itemId: string, valor: string) {
    setSacar((actual) => ({ ...actual, [itemId]: valor }));
    setPagos([]); // cambiar lo que se saca invalida los pagos ya armados
  }

  function sacarTodo() {
    setSacar(Object.fromEntries(pendientes.map((item) => [item.id, String(item.cantidad - item.cantidadEntregada)])));
    setPagos([]);
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
    setPagos([]);
  }

  function cambiarCantidadAdicional(productoId: string, delta: number) {
    setAdicionales((actual) =>
      actual
        .map((a) => (a.productoId === productoId ? { ...a, cantidad: a.cantidad + delta } : a))
        .filter((a) => a.cantidad > 0),
    );
    setPagos([]);
  }

  async function despachar() {
    if (total <= 0 || faltante !== 0 || enviando) return;
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
        pagos: pagos.map((pago) => ({
          metodo: pago.metodo,
          monto: pago.monto,
          recibido: pago.recibido,
          montoUsd: pago.montoUsd,
          referencia: pago.referencia,
        })),
        idempotencyKey,
      }),
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo despachar');
      setEnviando(false);
      return;
    }

    const avisoLimite = cuerpo.saldoCliente?.pasaLimite
      ? `Esta cuenta pasó su límite de crédito (saldo nuevo: ${formatoCRC(cuerpo.saldoCliente.saldoNuevo)})`
      : undefined;

    // El tiquete es para el cliente — se pregunta, igual que en una venta de
    // mostrador (§3.10). onListo() se llama al cerrar este paso, no antes, para
    // no refrescar la cola de programados mientras el tiquete sigue en pantalla.
    setPendienteImprimir({ ventaId: cuerpo.venta.id, avisoLimite });
  }

  async function imprimirTicketDespacho() {
    if (!pendienteImprimir) return;
    const { ventaId, avisoLimite } = pendienteImprimir;
    setPendienteImprimir(null);

    const respuesta = await fetch('/api/tickets/venta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventaId }),
    });
    const emision = await respuesta.json();
    const aviso = [avisoLimite, emision.error].filter(Boolean).join(' - ');
    if (emision.html) {
      setVistaPrevia({ html: emision.html, aviso: aviso || undefined });
    } else if (avisoLimite) {
      setVistaPrevia({ html: '', aviso: avisoLimite });
    } else {
      onListo();
    }
  }

  function saltarTicketDespacho() {
    const avisoLimite = pendienteImprimir?.avisoLimite;
    setPendienteImprimir(null);
    if (avisoLimite) setVistaPrevia({ html: '', aviso: avisoLimite });
    else onListo();
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
          <SelectorPago
            key={total}
            total={total}
            tipoCambioUsd={tipoCambioUsd}
            metodos={METODOS}
            cuentaFija={{ id: clienteId, nombre: nombreCliente, numeroCuenta }}
            onPagosCambian={setPagos}
          />
        )}

        {error && <p class="text-[var(--principal-color)]">{error}</p>}

        <div class="flex gap-3">
          <button type="button" onClick={onCerrar} class="boton-pos flex-1 rounded-lg bg-[var(--background_color_2)]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={total <= 0 || faltante !== 0 || enviando}
            onClick={despachar}
            class="boton-pos flex-1 rounded-lg bg-[var(--principal-color)] font-bold disabled:opacity-40"
          >
            Cobrar y despachar
          </button>
        </div>
      </div>

      {pendienteImprimir && (
        <ConfirmarImpresion onImprimir={imprimirTicketDespacho} onSaltar={saltarTicketDespacho} />
      )}

      {vistaPrevia && (
        <VistaPreviaTicket
          html={vistaPrevia.html}
          aviso={vistaPrevia.aviso}
          onCerrar={() => {
            setVistaPrevia(null);
            onListo();
          }}
        />
      )}
    </div>
  );
}
