import { useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import SelectorPago, { type PagoAgregado, type Metodo } from './SelectorPago';

interface ModalAbonoProps {
  clienteId: string;
  saldo: number;
  tipoCambioUsd: number;
  onConfirmado: (pagoIds: string[]) => void;
  onCancelar: () => void;
}

// Un abono nunca es "a cuenta" (no tiene sentido cargar una cuenta a sí misma).
const METODOS: Metodo[] = ['efectivo', 'efectivo_usd', 'sinpe', 'datafono_bac', 'datafono_bn'];

/**
 * Registrar un abono se cobra igual que una venta normal (mismo `SelectorPago`,
 * incluido pago dividido — §7) — la única diferencia es que el monto no viene de
 * un carrito, sino de lo que el cliente decide abonar a su cuenta.
 */
export default function ModalAbono({ clienteId, saldo, tipoCambioUsd, onConfirmado, onCancelar }: ModalAbonoProps) {
  const [monto, setMonto] = useState(String(saldo));
  const [pagos, setPagos] = useState<PagoAgregado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const montoNumero = Number(monto) || 0;
  const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const faltante = montoNumero - pagado;

  function cambiarMonto(valor: string) {
    setMonto(valor);
    setPagos([]); // cambiar el monto a abonar invalida lo ya armado
  }

  async function confirmar() {
    if (faltante !== 0 || montoNumero <= 0 || enviando) return;
    setEnviando(true);
    setError(null);

    const respuesta = await fetch(`/api/clientes/${clienteId}/abono`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pagos: pagos.map((pago) => ({
          metodo: pago.metodo,
          monto: pago.monto,
          recibido: pago.recibido,
          montoUsd: pago.montoUsd,
          referencia: pago.referencia,
        })),
      }),
    });

    const resultado = await respuesta.json();
    if (!respuesta.ok) {
      setError(resultado.error ?? 'No se pudo registrar el abono');
      setEnviando(false);
      return;
    }

    onConfirmado(resultado.pagosCreados.map((pago: { id: string }) => pago.id));
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
              onInput={(e) => cambiarMonto((e.target as HTMLInputElement).value)}
              class="monto flex-1 rounded bg-[var(--background_color_2)] px-3 py-2 text-2xl text-[var(--gold)]"
            />
            <button type="button" onClick={() => cambiarMonto(String(saldo))} class="rounded bg-[var(--background_color_2)] px-3 text-sm">
              Todo el saldo ({formatoCRC(saldo)})
            </button>
          </div>
        </label>

        {montoNumero > 0 && (
          <SelectorPago
            key={montoNumero}
            total={montoNumero}
            tipoCambioUsd={tipoCambioUsd}
            metodos={METODOS}
            onPagosCambian={setPagos}
          />
        )}

        {error && <p class="text-[var(--principal-color)]">{error}</p>}

        <div class="mt-2 flex gap-3">
          <button type="button" onClick={onCancelar} class="boton-pos flex-1 rounded-lg bg-[var(--background_color_2)]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={faltante !== 0 || montoNumero <= 0 || enviando}
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
