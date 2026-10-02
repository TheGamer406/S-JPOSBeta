import { useState } from 'preact/hooks';
import { formatoCRC, calcularVueltoCrc, calcularVueltoUsd } from '@/lib/dinero';

type Metodo = 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn';

interface ModalAbonoProps {
  clienteId: string;
  saldo: number;
  tipoCambioUsd: number;
  onConfirmado: (pagoId: string) => void;
  onCancelar: () => void;
}

const NOMBRE_METODO: Record<Metodo, string> = {
  efectivo: 'Efectivo ₡',
  efectivo_usd: 'Efectivo $',
  sinpe: 'SINPE Móvil',
  datafono_bac: 'Datáfono BAC',
  datafono_bn: 'Datáfono BN',
};

const COLOR_METODO: Record<Metodo, string> = {
  efectivo: 'var(--pago-efectivo-crc)',
  efectivo_usd: 'var(--pago-efectivo-usd)',
  sinpe: 'var(--pago-sinpe)',
  datafono_bac: 'var(--pago-bac)',
  datafono_bn: 'var(--pago-bn)',
};

/**
 * Registrar un abono se cobra igual que una venta normal (mismos botones grandes,
 * mismos atajos de efectivo y billetes $) — la única diferencia es que el monto no
 * viene de un carrito, sino de lo que el cliente decide abonar a su cuenta.
 */
export default function ModalAbono({ clienteId, saldo, tipoCambioUsd, onConfirmado, onCancelar }: ModalAbonoProps) {
  const [monto, setMonto] = useState(String(saldo));
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [montoUsdTexto, setMontoUsdTexto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const montoNumero = Number(monto) || 0;
  const recibidoNumero = Number(recibidoTexto) || 0;
  const montoUsdNumero = Number(montoUsdTexto) || 0;

  let vueltoPreview: number | null = null;
  if (metodo === 'efectivo' && recibidoNumero >= montoNumero && montoNumero > 0) {
    vueltoPreview = calcularVueltoCrc(montoNumero, recibidoNumero);
  }
  if (metodo === 'efectivo_usd' && montoUsdNumero > 0 && montoNumero > 0) {
    const recibidoCrc = montoUsdNumero * tipoCambioUsd;
    if (recibidoCrc >= montoNumero) vueltoPreview = calcularVueltoUsd(montoNumero, montoUsdNumero, tipoCambioUsd);
  }

  async function confirmar() {
    if (!metodo || montoNumero <= 0 || enviando) return;
    setEnviando(true);
    setError(null);

    const cuerpo: Record<string, unknown> = { metodo, monto: montoNumero };
    if (metodo === 'efectivo') cuerpo.recibido = recibidoNumero;
    if (metodo === 'efectivo_usd') cuerpo.montoUsd = montoUsdNumero;
    if (metodo === 'sinpe' || metodo === 'datafono_bac' || metodo === 'datafono_bn') {
      cuerpo.referencia = referencia || undefined;
    }

    const respuesta = await fetch(`/api/clientes/${clienteId}/abono`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    const resultado = await respuesta.json();
    if (!respuesta.ok) {
      setError(resultado.error ?? 'No se pudo registrar el abono');
      setEnviando(false);
      return;
    }

    onConfirmado(resultado.pagoId);
  }

  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div class="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-auto rounded-xl bg-[var(--background_color_1)] p-6">
        <h2 class="marca text-2xl">Registrar abono</h2>

        <label class="flex flex-col gap-1">
          <span class="text-[var(--text_color_2)]">Monto a abonar</span>
          <div class="flex gap-2">
            <input
              type="number"
              value={monto}
              onInput={(e) => setMonto((e.target as HTMLInputElement).value)}
              class="monto flex-1 rounded bg-[var(--background_color_2)] px-3 py-2 text-2xl text-[var(--gold)]"
            />
            <button type="button" onClick={() => setMonto(String(saldo))} class="rounded bg-[var(--background_color_2)] px-3 text-sm">
              Todo el saldo ({formatoCRC(saldo)})
            </button>
          </div>
        </label>

        {!metodo && (
          <div class="grid grid-cols-2 gap-2">
            {(Object.keys(NOMBRE_METODO) as Metodo[]).map((opcion) => (
              <button
                key={opcion}
                type="button"
                disabled={montoNumero <= 0}
                onClick={() => setMetodo(opcion)}
                style={{ backgroundColor: COLOR_METODO[opcion] }}
                class="boton-pos rounded-lg font-bold text-black disabled:opacity-40"
              >
                {NOMBRE_METODO[opcion]}
              </button>
            ))}
          </div>
        )}

        {metodo === 'efectivo' && (
          <div class="flex flex-col gap-2">
            <div class="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setRecibidoTexto(String(montoNumero))} class="boton-pos rounded bg-[var(--pago-efectivo-crc)] text-black">
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
              class="rounded bg-[var(--background_color_2)] px-3 py-2"
            />
            {vueltoPreview !== null && (
              <p class="monto text-xl font-bold text-[var(--gold)]">Vuelto: {formatoCRC(vueltoPreview)}</p>
            )}
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
            <p>
              Recibido: ${montoUsdTexto || 0} (TC ₡{tipoCambioUsd})
            </p>
            {vueltoPreview !== null && (
              <p class="monto text-xl font-bold text-[var(--gold)]">Vuelto: {formatoCRC(vueltoPreview)}</p>
            )}
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
              class="rounded bg-[var(--background_color_2)] px-3 py-2"
            />
            <button type="button" onClick={() => setMetodo(null)} class="text-sm text-[var(--text_color_2)]">
              cambiar medio de pago
            </button>
          </div>
        )}

        {error && <p class="text-[var(--principal-color)]">{error}</p>}

        <div class="mt-2 flex gap-3">
          <button type="button" onClick={onCancelar} class="boton-pos flex-1 rounded-lg bg-[var(--background_color_2)]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!metodo || montoNumero <= 0 || enviando}
            onClick={confirmar}
            class="boton-pos flex-1 rounded-lg bg-[var(--principal-color)] font-bold disabled:opacity-40"
          >
            Confirmar abono
          </button>
        </div>
      </div>
    </div>
  );
}
