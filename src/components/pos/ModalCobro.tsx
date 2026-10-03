import { useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import SelectorPago, { type PagoAgregado, type Metodo } from './SelectorPago';

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  nota?: string;
}

interface ModalCobroProps {
  items: ItemCarrito[];
  total: number;
  tipoCambioUsd: number;
  nombreReferencia?: string;
  onConfirmado: (ventaId: string, avisoLimite?: string) => void;
  onCancelar: () => void;
}

const METODOS: Metodo[] = ['efectivo', 'efectivo_usd', 'sinpe', 'datafono_bac', 'datafono_bn', 'cuenta'];

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
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const faltante = total - pagado;

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

        <SelectorPago total={total} tipoCambioUsd={tipoCambioUsd} metodos={METODOS} onPagosCambian={setPagos} />

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
