import { useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import BuscadorCliente from './BuscadorCliente';
import VistaPreviaTicket from './VistaPreviaTicket';

interface Cliente {
  id: string;
  numeroCuenta: string;
  nombre: string;
  cedula: string;
  estado: string;
  limiteCredito: number | null;
}

interface Movimiento {
  id: string;
  tipo: 'cargo' | 'abono' | 'ajuste';
  monto: number;
  nota: string | null;
  creadoEn: string;
}

interface AntiguedadFila {
  cliente: Cliente;
  saldo: number;
  cargoMasAntiguo: string | null;
}

type Metodo = 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn';

export default function PantallaCuentas() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [mostrarAntiguedad, setMostrarAntiguedad] = useState(false);
  const [antiguedad, setAntiguedad] = useState<AntiguedadFila[]>([]);

  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [monto, setMonto] = useState('');
  const [recibido, setRecibido] = useState('');
  const [montoUsd, setMontoUsd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

  async function cargarEstadoCuenta(clienteSeleccionado: Cliente) {
    setCliente(clienteSeleccionado);
    setMostrarAntiguedad(false);
    const respuesta = await fetch(`/api/clientes/${clienteSeleccionado.id}/estado-cuenta`);
    const cuerpo = await respuesta.json();
    setMovimientos(cuerpo.movimientos ?? []);
    setSaldo(cuerpo.saldo ?? 0);
  }

  async function verAntiguedad() {
    setCliente(null);
    setMostrarAntiguedad(true);
    const respuesta = await fetch('/api/clientes/antiguedad');
    const cuerpo = await respuesta.json();
    setAntiguedad(cuerpo.saldos ?? []);
  }

  async function registrarAbono(evento: SubmitEvent) {
    evento.preventDefault();
    if (!cliente) return;
    setError(null);

    const respuesta = await fetch(`/api/clientes/${cliente.id}/abono`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metodo,
        monto: Number(monto),
        recibido: recibido ? Number(recibido) : undefined,
        montoUsd: montoUsd ? Number(montoUsd) : undefined,
      }),
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo registrar el abono');
      return;
    }

    setMonto('');
    setRecibido('');
    setMontoUsd('');
    await cargarEstadoCuenta(cliente);

    const ticketRespuesta = await fetch('/api/tickets/abono', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagoId: cuerpo.pagoId }),
    });
    const emision = await ticketRespuesta.json();
    if (emision.html) setVistaPrevia(emision.html);
  }

  async function imprimirEstadoCuenta() {
    if (!cliente) return;
    const respuesta = await fetch('/api/tickets/estado-cuenta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: cliente.id }),
    });
    const emision = await respuesta.json();
    if (emision.html) setVistaPrevia(emision.html);
  }

  return (
    <div class="flex flex-col gap-6 p-4 lg:flex-row">
      <div class="w-full lg:w-80">
        <BuscadorCliente onSeleccionar={(c) => cargarEstadoCuenta(c as Cliente)} />
        <button type="button" onClick={verAntiguedad} class="mt-3 w-full rounded bg-[var(--background_color_2)] px-3 py-2">
          Ver antigüedad de saldos
        </button>
      </div>

      <div class="flex-1">
        {cliente && (
          <>
            <h2 class="marca text-2xl">
              {cliente.numeroCuenta} — {cliente.nombre}
            </h2>
            <p class="monto text-3xl font-bold text-[var(--gold)]">Saldo: {formatoCRC(saldo)}</p>
            {cliente.limiteCredito != null && saldo > cliente.limiteCredito && (
              <p class="text-[var(--principal-color)]">⚠ Pasa el límite de crédito ({formatoCRC(cliente.limiteCredito)})</p>
            )}

            <ul class="mt-4 flex flex-col gap-1">
              {movimientos.map((movimiento) => (
                <li key={movimiento.id} class="flex justify-between rounded bg-[var(--background_color_2)] px-3 py-2">
                  <span class="capitalize">
                    {movimiento.creadoEn} · {movimiento.tipo}
                  </span>
                  <span class="monto">{formatoCRC(movimiento.monto)}</span>
                </li>
              ))}
            </ul>

            <button type="button" onClick={imprimirEstadoCuenta} class="mt-3 rounded bg-[var(--background_color_2)] px-4 py-2">
              Imprimir estado de cuenta
            </button>

            <form onSubmit={registrarAbono} class="mt-6 flex flex-col gap-2 rounded-xl bg-[var(--background_color_2)] p-4">
              <h3 class="text-xl font-bold">Registrar abono</h3>
              <select
                value={metodo}
                onChange={(e) => setMetodo((e.target as HTMLSelectElement).value as Metodo)}
                class="rounded bg-[var(--background_color_1)] px-3 py-2"
              >
                <option value="efectivo">Efectivo ₡</option>
                <option value="efectivo_usd">Efectivo $</option>
                <option value="sinpe">SINPE Móvil</option>
                <option value="datafono_bac">Datáfono BAC</option>
                <option value="datafono_bn">Datáfono BN</option>
              </select>
              <input
                type="number"
                placeholder="Monto abonado (₡)"
                required
                value={monto}
                onInput={(e) => setMonto((e.target as HTMLInputElement).value)}
                class="rounded bg-[var(--background_color_1)] px-3 py-2"
              />
              {metodo === 'efectivo' && (
                <input
                  type="number"
                  placeholder="Recibido (₡)"
                  value={recibido}
                  onInput={(e) => setRecibido((e.target as HTMLInputElement).value)}
                  class="rounded bg-[var(--background_color_1)] px-3 py-2"
                />
              )}
              {metodo === 'efectivo_usd' && (
                <input
                  type="number"
                  placeholder="Recibido ($)"
                  value={montoUsd}
                  onInput={(e) => setMontoUsd((e.target as HTMLInputElement).value)}
                  class="rounded bg-[var(--background_color_1)] px-3 py-2"
                />
              )}
              {error && <p class="text-[var(--principal-color)]">{error}</p>}
              <button type="submit" class="boton-pos rounded bg-[var(--principal-color)] font-bold">
                Registrar abono
              </button>
            </form>
          </>
        )}

        {mostrarAntiguedad && (
          <>
            <h2 class="marca text-2xl">Antigüedad de saldos</h2>
            <ul class="mt-4 flex flex-col gap-1">
              {antiguedad.map((fila) => (
                <li key={fila.cliente.id} class="flex justify-between rounded bg-[var(--background_color_2)] px-3 py-2">
                  <span>
                    {fila.cliente.numeroCuenta} — {fila.cliente.nombre}
                    {fila.cargoMasAntiguo && <em class="ml-2 text-sm text-[var(--text_color_2)]">desde {fila.cargoMasAntiguo}</em>}
                  </span>
                  <span class="monto font-bold">{formatoCRC(fila.saldo)}</span>
                </li>
              ))}
              {antiguedad.length === 0 && <p class="text-[var(--text_color_2)]">Nadie debe en este momento.</p>}
            </ul>
          </>
        )}
      </div>

      {vistaPrevia && <VistaPreviaTicket html={vistaPrevia} onCerrar={() => setVistaPrevia(null)} />}
    </div>
  );
}
