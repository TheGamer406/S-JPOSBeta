import { useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import BuscadorCliente from './BuscadorCliente';

export type Metodo = 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn' | 'cuenta';

export interface PagoAgregado {
  metodo: Metodo;
  monto: number;
  recibido?: number;
  montoUsd?: number;
  referencia?: string;
  clienteId?: string;
  etiqueta: string;
}

interface ClienteCuenta {
  id: string;
  nombre: string;
  numeroCuenta: string;
}

interface SelectorPagoProps {
  total: number;
  tipoCambioUsd: number;
  /** Qué botones de método mostrar, en ese orden (ej. sin 'cuenta' para un abono). */
  metodos: Metodo[];
  /**
   * Si 'cuenta' está en `metodos` y viene este dato, "a cuenta" carga directo a
   * ESE cliente (caso de un pedido programado: ya se sabe de quién es). Si no
   * viene, se busca/crea el cliente con `BuscadorCliente` (caso de una venta).
   */
  cuentaFija?: ClienteCuenta;
  /** Se llama cada vez que cambia la lista de pagos acumulados (agregar/quitar). */
  onPagosCambian: (pagos: PagoAgregado[]) => void;
}

const NOMBRE_METODO: Record<Metodo, string> = {
  efectivo: 'Efectivo ₡',
  efectivo_usd: 'Efectivo $',
  sinpe: 'SINPE Móvil',
  datafono_bac: 'Datáfono BAC',
  datafono_bn: 'Datáfono BN',
  cuenta: 'A cuenta',
};

/**
 * Núcleo de cobro compartido (§7): métodos, atajos de efectivo ₡ y billetes $,
 * referencia de SINPE/datáfono, "a cuenta", y pago dividido (varios métodos
 * hasta completar el total). Lo usan ModalCobro, ModalAbono y
 * ModalGestionProgramado — antes cada uno reimplementaba esto por separado.
 */
export default function SelectorPago({ total, tipoCambioUsd, metodos, cuentaFija, onPagosCambian }: SelectorPagoProps) {
  const [pagos, setPagos] = useState<PagoAgregado[]>([]);
  const [metodoNuevo, setMetodoNuevo] = useState<Metodo | null>(null);
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [montoUsdTexto, setMontoUsdTexto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [clienteCuenta, setClienteCuenta] = useState<ClienteCuenta | null>(null);

  const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const faltante = total - pagado;

  function actualizar(nuevos: PagoAgregado[]) {
    setPagos(nuevos);
    onPagosCambian(nuevos);
  }

  function reiniciarFormularioPago() {
    setMetodoNuevo(null);
    setRecibidoTexto('');
    setMontoUsdTexto('');
    setReferencia('');
    setClienteCuenta(null);
  }

  function agregarEfectivo(recibido: number) {
    const montoAplicado = Math.min(recibido, faltante);
    actualizar([
      ...pagos,
      { metodo: 'efectivo', monto: montoAplicado, recibido, etiqueta: `Efectivo ₡ — recibido ${formatoCRC(recibido)}` },
    ]);
    reiniciarFormularioPago();
  }

  function agregarEfectivoUsd(montoUsd: number) {
    const recibidoCrc = montoUsd * tipoCambioUsd;
    const montoAplicado = Math.min(recibidoCrc, faltante);
    actualizar([
      ...pagos,
      { metodo: 'efectivo_usd', monto: montoAplicado, montoUsd, etiqueta: `Efectivo $ — recibido $${montoUsd}` },
    ]);
    reiniciarFormularioPago();
  }

  function agregarSimple(metodo: 'sinpe' | 'datafono_bac' | 'datafono_bn') {
    actualizar([
      ...pagos,
      { metodo, monto: faltante, referencia: referencia || undefined, etiqueta: `${NOMBRE_METODO[metodo]} — ${formatoCRC(faltante)}` },
    ]);
    reiniciarFormularioPago();
  }

  function agregarCuenta() {
    const destino = cuentaFija ?? clienteCuenta;
    if (!destino) return;
    actualizar([
      ...pagos,
      {
        metodo: 'cuenta',
        monto: faltante,
        clienteId: destino.id,
        etiqueta: `A cuenta ${destino.numeroCuenta} — ${formatoCRC(faltante)}`,
      },
    ]);
    reiniciarFormularioPago();
  }

  function quitarPago(indice: number) {
    actualizar(pagos.filter((_, i) => i !== indice));
  }

  return (
    <div class="flex flex-col gap-4">
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
              {metodos.map((metodo) => (
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
              {cuentaFija ? (
                <>
                  <p>
                    Se carga {formatoCRC(faltante)} a la cuenta de {cuentaFija.nombre} ({cuentaFija.numeroCuenta}).
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
              ) : !clienteCuenta ? (
                <BuscadorCliente onSeleccionar={(cliente) => setClienteCuenta(cliente as ClienteCuenta)} />
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
    </div>
  );
}
