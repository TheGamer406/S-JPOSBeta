import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import { formatoFechaHora } from '@/lib/fecha';
import BuscadorCliente from './BuscadorCliente';
import ModalAbono from './ModalAbono';
import ConfirmarImpresion from './ConfirmarImpresion';
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

export default function PantallaCuentas() {
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [tipoCambioUsd, setTipoCambioUsd] = useState(500);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [mostrarAntiguedad, setMostrarAntiguedad] = useState(false);
  const [antiguedad, setAntiguedad] = useState<AntiguedadFila[]>([]);
  const [mostrarModalAbono, setMostrarModalAbono] = useState(false);
  const [pagoPendienteImprimir, setPagoPendienteImprimir] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/caja')
      .then((respuesta) => respuesta.json())
      .then((cuerpo) => {
        setCajaAbierta(Boolean(cuerpo.sesion));
        if (cuerpo.sesion) setTipoCambioUsd(cuerpo.sesion.tipoCambioUsd);
      });
  }, []);

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

  async function alConfirmarAbono(pagoId: string) {
    setMostrarModalAbono(false);
    if (cliente) await cargarEstadoCuenta(cliente);
    // El tiquete de abono es para el cliente — no todos lo piden (§3.10).
    setPagoPendienteImprimir(pagoId);
  }

  async function imprimirTicketAbono() {
    if (!pagoPendienteImprimir) return;
    const pagoId = pagoPendienteImprimir;
    setPagoPendienteImprimir(null);

    const ticketRespuesta = await fetch('/api/tickets/abono', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagoId }),
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
    <div class="flex flex-col gap-6 p-4">
      {cajaAbierta === false && (
        <div class="rounded-lg bg-[var(--principal-color)] p-4">
          ⚠ No hay caja abierta — hace falta abrirla para poder registrar abonos (el abono
          entra al cierre del día, igual que una venta).{' '}
          <a href="/caja/abrir" class="font-bold underline">
            Abrir caja
          </a>
        </div>
      )}

      <div class="flex flex-col gap-6 lg:flex-row">
      <div class="w-full lg:w-80">
        <BuscadorCliente onSeleccionar={(c) => cargarEstadoCuenta(c as Cliente)} />
        <button type="button" onClick={verAntiguedad} class="mt-3 w-full rounded bg-[var(--background_color_2)] px-3 py-2">
          Ver antigüedad de saldos
        </button>
      </div>

      <div class="flex-1">
        {cliente && (
          <>
            <button type="button" onClick={verAntiguedad} class="mb-2 text-sm text-[var(--text_color_2)] underline">
              ← Ver todas las cuentas
            </button>
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
                    {formatoFechaHora(movimiento.creadoEn)} · {movimiento.tipo}
                  </span>
                  <span class="monto">{formatoCRC(movimiento.monto)}</span>
                </li>
              ))}
            </ul>

            <button type="button" onClick={imprimirEstadoCuenta} class="mt-3 rounded bg-[var(--background_color_2)] px-4 py-2">
              Imprimir estado de cuenta
            </button>

            <button
              type="button"
              disabled={!cajaAbierta}
              onClick={() => setMostrarModalAbono(true)}
              class="boton-pos mt-6 w-full rounded-lg bg-[var(--principal-color)] text-xl font-bold disabled:opacity-40"
            >
              {cajaAbierta ? 'Registrar abono' : 'Abrí la caja primero'}
            </button>
          </>
        )}

        {mostrarAntiguedad && (
          <>
            <h2 class="marca text-2xl">Antigüedad de saldos</h2>
            <p class="text-sm text-[var(--text_color_2)]">
              Tocá una cuenta para abrirla y registrarle el abono — útil cuando pagan
              varias cuentas el mismo día.
            </p>
            <ul class="mt-4 flex flex-col gap-1">
              {antiguedad.map((fila) => (
                <li key={fila.cliente.id}>
                  <button
                    type="button"
                    onClick={() => cargarEstadoCuenta(fila.cliente)}
                    class="flex w-full justify-between rounded bg-[var(--background_color_2)] px-3 py-2 text-left hover:bg-[var(--accent_color)]"
                  >
                    <span>
                      {fila.cliente.numeroCuenta} — {fila.cliente.nombre}
                      {fila.cargoMasAntiguo && <em class="ml-2 text-sm text-[var(--text_color_2)]">desde {fila.cargoMasAntiguo}</em>}
                    </span>
                    <span class="monto font-bold">{formatoCRC(fila.saldo)}</span>
                  </button>
                </li>
              ))}
              {antiguedad.length === 0 && <p class="text-[var(--text_color_2)]">Nadie debe en este momento.</p>}
            </ul>
          </>
        )}
      </div>
      </div>

      {mostrarModalAbono && cliente && (
        <ModalAbono
          clienteId={cliente.id}
          saldo={saldo}
          tipoCambioUsd={tipoCambioUsd}
          onConfirmado={alConfirmarAbono}
          onCancelar={() => setMostrarModalAbono(false)}
        />
      )}

      {pagoPendienteImprimir && (
        <ConfirmarImpresion onImprimir={imprimirTicketAbono} onSaltar={() => setPagoPendienteImprimir(null)} />
      )}

      {vistaPrevia && <VistaPreviaTicket html={vistaPrevia} onCerrar={() => setVistaPrevia(null)} />}
    </div>
  );
}
