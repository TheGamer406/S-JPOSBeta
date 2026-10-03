import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import ConfirmarImpresion from './ConfirmarImpresion';
import VistaPreviaTicket from './VistaPreviaTicket';

const BILLETES_CRC = [50000, 20000, 10000, 5000, 2000, 1000];
const MONEDAS_CRC = [500, 100, 50, 25, 10];
const BILLETES_USD = [100, 50, 20, 10, 5, 1];

interface ResumenMedio {
  medio: string;
  cantidad: number;
  monto: number;
}

interface FilaDenominacion {
  valores: number[];
  denominaciones: Record<string, string>;
  onCambiar: (valor: number, cantidad: string) => void;
  prefijo: string;
}

/** Una fila por denominación: etiqueta a la izquierda, cantidad a la derecha,
 * subtotal abajo — en lista vertical en vez de cuadrícula, para que se lea de
 * arriba hacia abajo como una boleta de arqueo real. */
function ListaDenominaciones({ valores, denominaciones, onCambiar, prefijo }: FilaDenominacion) {
  return (
    <ul class="flex flex-col divide-y divide-[var(--background_color_1)] rounded bg-[var(--background_color_2)]">
      {valores.map((valor) => {
        const cantidad = Number(denominaciones[valor]) || 0;
        return (
          <li key={valor} class="flex items-center justify-between gap-3 px-3 py-2">
            <span class="w-24">
              {prefijo}
              {valor.toLocaleString('es-CR')}
            </span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={denominaciones[valor] ?? ''}
              onInput={(e) => onCambiar(valor, (e.target as HTMLInputElement).value)}
              class="w-24 rounded bg-[var(--background_color_1)] px-2 py-1 text-right"
            />
            <span class="monto w-28 text-right text-[var(--text_color_2)]">
              {cantidad > 0 ? `= ${prefijo}${(valor * cantidad).toLocaleString('es-CR')}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function FormularioCierre() {
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{
    totalesPorMedio: ResumenMedio[];
    totalVendido: number;
    abonosRecibidos: number;
    efectivoEsperado: number;
  } | null>(null);
  const [denominaciones, setDenominaciones] = useState<Record<string, string>>({});
  const [denominacionesUsd, setDenominacionesUsd] = useState<Record<string, string>>({});
  const [loteBac, setLoteBac] = useState('');
  const [loteBn, setLoteBn] = useState('');
  const [notas, setNotas] = useState('');
  const [resultado, setResultado] = useState<{
    diferenciaEfectivo: number;
    respaldo?: { dbPath: string; pdfPath: string };
    avisoRespaldo?: string;
  } | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [pendienteImprimir, setPendienteImprimir] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/caja')
      .then((respuesta) => respuesta.json())
      .then((cuerpo) => {
        if (!cuerpo.sesion) return;
        setSesionId(cuerpo.sesion.id);
        fetch(`/api/caja/cerrar?sesionCajaId=${cuerpo.sesion.id}`)
          .then((r) => r.json())
          .then(setResumen);
      });
  }, []);

  const efectivoContado = Object.entries(denominaciones).reduce(
    (suma, [valor, cantidad]) => suma + Number(valor) * (Number(cantidad) || 0),
    0,
  );
  const usdContado = Object.entries(denominacionesUsd).reduce(
    (suma, [valor, cantidad]) => suma + Number(valor) * (Number(cantidad) || 0),
    0,
  );
  const diferenciaEstimada = resumen ? efectivoContado - resumen.efectivoEsperado : 0;

  function actualizarDenominacion(valor: number, cantidad: string) {
    setDenominaciones((d) => ({ ...d, [valor]: cantidad }));
  }
  function actualizarDenominacionUsd(valor: number, cantidad: string) {
    setDenominacionesUsd((d) => ({ ...d, [valor]: cantidad }));
  }

  async function cerrar() {
    setError(null);
    const respuesta = await fetch('/api/caja/cerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sesionCajaId: sesionId,
        efectivoContado,
        conteoDenominaciones: Object.fromEntries(
          Object.entries(denominaciones).map(([v, c]) => [v, Number(c) || 0]),
        ),
        usdContado,
        conteoUsd: Object.fromEntries(Object.entries(denominacionesUsd).map(([v, c]) => [v, Number(c) || 0])),
        loteBac: loteBac ? Number(loteBac) : undefined,
        loteBn: loteBn ? Number(loteBn) : undefined,
        notasCierre: notas || undefined,
      }),
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo cerrar la caja');
      return;
    }

    setResultado(cuerpo);
    // El tiquete de cierre también se pregunta, igual que el resto (§3.10).
    setPendienteImprimir(true);
  }

  async function imprimirTicketCierre() {
    setPendienteImprimir(false);
    const ticketRespuesta = await fetch('/api/tickets/cierre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesionCajaId: sesionId }),
    });
    const emision = await ticketRespuesta.json();
    if (emision.html) setVistaPrevia(emision.html);
  }

  function saltarTicketCierre() {
    setPendienteImprimir(false);
  }

  if (!sesionId) return <p class="p-4">No hay una sesión de caja abierta.</p>;

  return (
    <div class="flex flex-col gap-6 p-4">
      <h1 class="marca text-3xl">Cierre de caja (Z)</h1>

      {/* Lo esperado que debería haber en la caja, bien al frente antes de contar nada */}
      {resumen && (
        <ul class="flex flex-col divide-y divide-[var(--background_color_1)] rounded-xl bg-[var(--background_color_2)]">
          {resumen.totalesPorMedio.map((fila) => (
            <li key={fila.medio} class="flex justify-between px-4 py-2 text-[var(--text_color_2)]">
              <span class="capitalize">
                {fila.medio} ({fila.cantidad})
              </span>
              <span class="monto">{formatoCRC(fila.monto)}</span>
            </li>
          ))}
          <li class="flex justify-between px-4 py-2">
            <span>Total vendido</span>
            <span class="monto font-bold">{formatoCRC(resumen.totalVendido)}</span>
          </li>
          <li class="flex justify-between px-4 py-2">
            <span>Abonos recibidos</span>
            <span class="monto font-bold">{formatoCRC(resumen.abonosRecibidos)}</span>
          </li>
          <li class="flex justify-between px-4 py-3">
            <span class="text-lg font-bold">Debería haber en caja (₡)</span>
            <span class="monto text-2xl font-bold text-[var(--gold)]">{formatoCRC(resumen.efectivoEsperado)}</span>
          </li>
        </ul>
      )}

      <div>
        <h2 class="mb-2 text-xl font-bold">Colones — billetes</h2>
        <ListaDenominaciones
          valores={BILLETES_CRC}
          denominaciones={denominaciones}
          onCambiar={actualizarDenominacion}
          prefijo="₡"
        />
      </div>

      <div>
        <h2 class="mb-2 text-xl font-bold">Colones — monedas</h2>
        <ListaDenominaciones
          valores={MONEDAS_CRC}
          denominaciones={denominaciones}
          onCambiar={actualizarDenominacion}
          prefijo="₡"
        />
      </div>

      <div>
        <h2 class="mb-2 text-xl font-bold">Dólares — billetes (solo billetes, sin monedas)</h2>
        <ListaDenominaciones
          valores={BILLETES_USD}
          denominaciones={denominacionesUsd}
          onCambiar={actualizarDenominacionUsd}
          prefijo="$"
        />
      </div>

      {/* Comparación en vivo mientras se cuenta, antes de confirmar el cierre */}
      <ul class="flex flex-col divide-y divide-[var(--background_color_1)] rounded-xl bg-[var(--background_color_2)]">
        <li class="flex justify-between px-4 py-2">
          <span>Efectivo contado (₡)</span>
          <span class="monto font-bold">{formatoCRC(efectivoContado)}</span>
        </li>
        <li class="flex justify-between px-4 py-2">
          <span>Dólares contados</span>
          <span class="monto font-bold">${usdContado}</span>
        </li>
        {resumen && (
          <li class="flex justify-between px-4 py-3">
            <span class="text-lg font-bold">Diferencia estimada</span>
            <span class={`monto text-2xl font-bold ${diferenciaEstimada !== 0 ? 'text-[var(--principal-color)]' : 'text-[var(--accent_color)]'}`}>
              {formatoCRC(diferenciaEstimada)} {diferenciaEstimada !== 0 ? '⚠' : '✓'}
            </span>
          </li>
        )}
      </ul>

      <div class="flex flex-col gap-3 sm:flex-row">
        <label class="flex flex-1 flex-col gap-1">
          Lote BAC
          <input value={loteBac} onInput={(e) => setLoteBac((e.target as HTMLInputElement).value)} class="rounded bg-[var(--background_color_2)] px-3 py-2" />
        </label>
        <label class="flex flex-1 flex-col gap-1">
          Lote BN
          <input value={loteBn} onInput={(e) => setLoteBn((e.target as HTMLInputElement).value)} class="rounded bg-[var(--background_color_2)] px-3 py-2" />
        </label>
      </div>

      <textarea
        placeholder="Notas del cierre (obligatorio si hay diferencia)"
        value={notas}
        onInput={(e) => setNotas((e.target as HTMLTextAreaElement).value)}
        class="rounded bg-[var(--background_color_2)] px-3 py-2"
      />

      {error && <p class="text-[var(--principal-color)]">{error}</p>}
      {resultado && (
        <div class="flex flex-col gap-2">
          <p class="font-bold">
            Diferencia: {formatoCRC(resultado.diferenciaEfectivo)}{' '}
            {resultado.diferenciaEfectivo !== 0 ? '⚠' : '✓'}
          </p>
          <a
            href={`/api/caja/reporte-pdf?sesionCajaId=${sesionId}`}
            class="boton-pos inline-block rounded-lg bg-[var(--accent_color)] px-6 text-center font-bold"
          >
            Descargar PDF del cierre (con productos vendidos)
          </a>
          {resultado.respaldo && (
            <p class="text-sm text-[var(--text_color_2)]">
              Respaldo automático guardado en: <code>{resultado.respaldo.pdfPath}</code>
            </p>
          )}
          {resultado.avisoRespaldo && <p class="text-[var(--principal-color)]">⚠ {resultado.avisoRespaldo}</p>}
        </div>
      )}

      {!resultado && (
        <button type="button" onClick={cerrar} class="boton-pos rounded-lg bg-[var(--principal-color)] text-xl font-bold">
          Cerrar caja
        </button>
      )}

      {pendienteImprimir && (
        <ConfirmarImpresion
          mensaje="Tiquete del cierre de caja"
          onImprimir={imprimirTicketCierre}
          onSaltar={saltarTicketCierre}
        />
      )}

      {vistaPrevia && <VistaPreviaTicket html={vistaPrevia} onCerrar={() => setVistaPrevia(null)} />}
    </div>
  );
}
