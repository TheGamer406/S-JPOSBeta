import { useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import BuscadorCliente from './BuscadorCliente';

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  nota?: string;
}

type Metodo = 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn' | 'cuenta';

interface PagoAgregado {
  metodo: Metodo;
  monto: number;
  recibido?: number;
  montoUsd?: number;
  referencia?: string;
  clienteId?: string;
  etiqueta: string;
}

interface ModalCobroProps {
  items: ItemCarrito[];
  total: number;
  tipoCambioUsd: number;
  nombreReferencia?: string;
  onConfirmado: (ventaId: string, avisoLimite?: string) => void;
  onCancelar: () => void;
}

const NOMBRE_METODO: Record<Metodo, string> = {
  efectivo: 'Efectivo ₡',
  efectivo_usd: 'Efectivo $',
  sinpe: 'SINPE Móvil',
  datafono_bac: 'Datáfono BAC',
  datafono_bn: 'Datáfono BN',
  cuenta: 'A cuenta',
};

export default function ModalCobro({
  items,
  total,
  tipoCambioUsd,
  nombreReferencia,
  onConfirmado,
  onCancelar,
}: ModalCobroProps) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [pagos, setPagos] = useState<PagoAgregado[]>([]);
  const [metodoNuevo, setMetodoNuevo] = useState<Metodo | null>(null);
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [montoUsdTexto, setMontoUsdTexto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [clienteCuenta, setClienteCuenta] = useState<{ id: string; nombre: string; numeroCuenta: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const faltante = total - pagado;

  function reiniciarFormularioPago() {
    setMetodoNuevo(null);
    setRecibidoTexto('');
    setMontoUsdTexto('');
    setReferencia('');
    setClienteCuenta(null);
  }

  function agregarEfectivo(recibido: number) {
    const montoAplicado = Math.min(recibido, faltante);
    setPagos((actual) => [
      ...actual,
      {
        metodo: 'efectivo',
        monto: montoAplicado,
        recibido,
        etiqueta: `Efectivo ₡ — recibido ${formatoCRC(recibido)}`,
      },
    ]);
    reiniciarFormularioPago();
  }

  function agregarEfectivoUsd(montoUsd: number) {
    const recibidoCrc = montoUsd * tipoCambioUsd;
    const montoAplicado = Math.min(recibidoCrc, faltante);
    setPagos((actual) => [
      ...actual,
      {
        metodo: 'efectivo_usd',
        monto: montoAplicado,
        montoUsd,
        etiqueta: `Efectivo $ — recibido $${montoUsd}`,
      },
    ]);
    reiniciarFormularioPago();
  }

  function agregarSimple(metodo: 'sinpe' | 'datafono_bac' | 'datafono_bn') {
    setPagos((actual) => [
      ...actual,
      { metodo, monto: faltante, referencia: referencia || undefined, etiqueta: `${NOMBRE_METODO[metodo]} — ${formatoCRC(faltante)}` },
    ]);
    reiniciarFormularioPago();
  }

  function agregarCuenta() {
    if (!clienteCuenta) return;
    setPagos((actual) => [
      ...actual,
      {
        metodo: 'cuenta',
        monto: faltante,
        clienteId: clienteCuenta.id,
        etiqueta: `A cuenta ${clienteCuenta.numeroCuenta} — ${formatoCRC(faltante)}`,
      },
    ]);
    reiniciarFormularioPago();
  }

  function quitarPago(indice: number) {
    setPagos((actual) => actual.filter((_, i) => i !== indice));
  }

  async function confirmar() {
    if (faltante !== 0 || enviando) return;
    setEnviando(true);
    setError(null);

    const clienteId = pagos.find((pago) => pago.clienteId)?.clienteId;

    const respuesta = await fetch('/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        nombreReferencia,
        items: items.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          nota: item.nota,
        })),
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
      setError(cuerpo.error ?? 'No se pudo cobrar la venta');
      setEnviando(false);
      return;
    }

    const avisoLimite = cuerpo.saldoCliente?.pasaLimite
      ? `Esta cuenta pasó su límite de crédito (saldo nuevo: ${formatoCRC(cuerpo.saldoCliente.saldoNuevo)})`
      : undefined;
    onConfirmado(cuerpo.venta.id, avisoLimite);
  }

  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div class="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-auto rounded-xl bg-[var(--background_color_1)] p-6">
        <h2 class="marca text-2xl">Cobrar</h2>
        <p class="monto text-4xl font-bold text-[var(--gold)]">{formatoCRC(total)}</p>

        {pagos.length > 0 && (
          <ul class="flex flex-col gap-1">
            {pagos.map((pago, indice) => (
              <li key={indice} class="flex items-center justify-between rounded bg-[var(--background_color_2)] px-3 py-2">
                <span>{pago.etiqueta}</span>
                <button type="button" onClick={() => quitarPago(indice)} class="text-[var(--principal-color)]">
                  quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {faltante > 0 ? (
          <>
            <p class="text-[var(--text_color_2)]">Falta: {formatoCRC(faltante)}</p>

            {!metodoNuevo && (
              <div class="grid grid-cols-2 gap-2">
                {(Object.keys(NOMBRE_METODO) as Metodo[]).map((metodo) => (
                  <button
                    key={metodo}
                    type="button"
                    onClick={() => setMetodoNuevo(metodo)}
                    class="boton-pos rounded-lg bg-[var(--background_color_2)] font-bold"
                  >
                    {NOMBRE_METODO[metodo]}
                  </button>
                ))}
              </div>
            )}

            {metodoNuevo === 'efectivo' && (
              <div class="flex flex-col gap-2">
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => agregarEfectivo(faltante)} class="boton-pos rounded bg-[var(--pago-efectivo-crc)]">
                    Exacto
                  </button>
                  <button type="button" onClick={() => agregarEfectivo(10000)} class="boton-pos rounded bg-[var(--pago-efectivo-crc)]">
                    ₡10 000
                  </button>
                  <button type="button" onClick={() => agregarEfectivo(20000)} class="boton-pos rounded bg-[var(--pago-efectivo-crc)]">
                    ₡20 000
                  </button>
                </div>
                <div class="flex gap-2">
                  <input
                    type="number"
                    placeholder="Otro monto recibido"
                    value={recibidoTexto}
                    onInput={(evento) => setRecibidoTexto((evento.target as HTMLInputElement).value)}
                    class="flex-1 rounded bg-[var(--background_color_2)] px-3 py-2"
                  />
                  <button
                    type="button"
                    disabled={!recibidoTexto}
                    onClick={() => agregarEfectivo(Number(recibidoTexto))}
                    class="rounded bg-[var(--accent_color)] px-4"
                  >
                    Agregar
                  </button>
                </div>
                <button type="button" onClick={reiniciarFormularioPago} class="text-sm text-[var(--text_color_2)]">
                  cancelar
                </button>
              </div>
            )}

            {metodoNuevo === 'efectivo_usd' && (
              <div class="flex flex-col gap-2">
                <div class="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      onClick={() => setMontoUsdTexto(String(Number(montoUsdTexto || 0) + billete))}
                      class="boton-pos rounded bg-[var(--pago-efectivo-usd)]"
                    >
                      ${billete}
                    </button>
                  ))}
                </div>
                <p>Recibido: ${montoUsdTexto || 0} (TC ₡{tipoCambioUsd})</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    disabled={!montoUsdTexto}
                    onClick={() => agregarEfectivoUsd(Number(montoUsdTexto))}
                    class="flex-1 rounded bg-[var(--accent_color)] px-4 py-2"
                  >
                    Agregar
                  </button>
                  <button type="button" onClick={reiniciarFormularioPago} class="text-sm text-[var(--text_color_2)]">
                    cancelar
                  </button>
                </div>
              </div>
            )}

            {(metodoNuevo === 'sinpe' || metodoNuevo === 'datafono_bac' || metodoNuevo === 'datafono_bn') && (
              <div class="flex flex-col gap-2">
                <input
                  placeholder={metodoNuevo === 'sinpe' ? 'N.º de comprobante' : 'N.º de autorización (opcional)'}
                  value={referencia}
                  onInput={(evento) => setReferencia((evento.target as HTMLInputElement).value)}
                  class="rounded bg-[var(--background_color_2)] px-3 py-2"
                />
                <div class="flex gap-2">
                  <button type="button" onClick={() => agregarSimple(metodoNuevo)} class="flex-1 rounded bg-[var(--accent_color)] px-4 py-2">
                    Agregar {formatoCRC(faltante)}
                  </button>
                  <button type="button" onClick={reiniciarFormularioPago} class="text-sm text-[var(--text_color_2)]">
                    cancelar
                  </button>
                </div>
              </div>
            )}

            {metodoNuevo === 'cuenta' && (
              <div class="flex flex-col gap-2">
                {!clienteCuenta ? (
                  <BuscadorCliente onSeleccionar={(cliente) => setClienteCuenta(cliente)} />
                ) : (
                  <>
                    <p>
                      {clienteCuenta.numeroCuenta} — {clienteCuenta.nombre}
                    </p>
                    <div class="flex gap-2">
                      <button type="button" onClick={agregarCuenta} class="flex-1 rounded bg-[var(--pago-cuenta)] px-4 py-2 text-black">
                        Cargar {formatoCRC(faltante)}
                      </button>
                      <button type="button" onClick={reiniciarFormularioPago} class="text-sm text-[var(--text_color_2)]">
                        cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <p class="font-bold text-[var(--accent_color)]">Pagos completos ✓</p>
        )}

        {error && <p class="text-[var(--principal-color)]">{error}</p>}

        <div class="mt-2 flex gap-3">
          <button type="button" onClick={onCancelar} class="boton-pos flex-1 rounded-lg bg-[var(--background_color_2)]">
            Cancelar venta
          </button>
          <button
            type="button"
            disabled={faltante !== 0 || enviando}
            onClick={confirmar}
            class="boton-pos flex-1 rounded-lg bg-[var(--principal-color)] font-bold disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
