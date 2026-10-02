import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import VistaPreviaTicket from './VistaPreviaTicket';

const BILLETES_CRC = [50000, 20000, 10000, 5000, 2000, 1000];
const MONEDAS_CRC = [500, 100, 50, 25, 10];
const BILLETES_USD = [100, 50, 20, 10, 5, 1];

interface ResumenMedio {
  medio: string;
  cantidad: number;
  monto: number;
}

export default function FormularioCierre() {
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ totalesPorMedio: ResumenMedio[]; totalVendido: number; efectivoEsperado: number } | null>(
    null,
  );
  const [denominaciones, setDenominaciones] = useState<Record<string, string>>({});
  const [denominacionesUsd, setDenominacionesUsd] = useState<Record<string, string>>({});
  const [loteBac, setLoteBac] = useState('');
  const [loteBn, setLoteBn] = useState('');
  const [notas, setNotas] = useState('');
  const [resultado, setResultado] = useState<{ diferenciaEfectivo: number } | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
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

    const ticketRespuesta = await fetch('/api/tickets/cierre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesionCajaId: sesionId }),
    });
    const emision = await ticketRespuesta.json();
    if (emision.html) setVistaPrevia(emision.html);
  }

  if (!sesionId) return <p class="p-4">No hay una sesión de caja abierta.</p>;

  return (
    <div class="flex flex-col gap-6 p-4">
      <h1 class="marca text-3xl">Cierre de caja (Z)</h1>

      {resumen && (
        <div class="rounded bg-[var(--background_color_2)] p-4">
          <p>Total vendido: {formatoCRC(resumen.totalVendido)}</p>
          <p>Efectivo esperado: {formatoCRC(resumen.efectivoEsperado)}</p>
          <ul class="mt-2 text-sm text-[var(--text_color_2)]">
            {resumen.totalesPorMedio.map((fila) => (
              <li key={fila.medio}>
                {fila.medio}: {fila.cantidad} · {formatoCRC(fila.monto)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 class="mb-2 text-xl font-bold">Colones — billetes</h2>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BILLETES_CRC.map((valor) => (
            <label key={valor} class="flex flex-col gap-1 text-sm">
              {formatoCRC(valor)}
              <input
                type="number"
                min="0"
                value={denominaciones[valor] ?? ''}
                onInput={(e) => setDenominaciones((d) => ({ ...d, [valor]: (e.target as HTMLInputElement).value }))}
                class="rounded bg-[var(--background_color_2)] px-2 py-1"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 class="mb-2 text-xl font-bold">Colones — monedas</h2>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {MONEDAS_CRC.map((valor) => (
            <label key={valor} class="flex flex-col gap-1 text-sm">
              {formatoCRC(valor)}
              <input
                type="number"
                min="0"
                value={denominaciones[valor] ?? ''}
                onInput={(e) => setDenominaciones((d) => ({ ...d, [valor]: (e.target as HTMLInputElement).value }))}
                class="rounded bg-[var(--background_color_2)] px-2 py-1"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 class="mb-2 text-xl font-bold">Dólares — billetes (solo billetes, sin monedas)</h2>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BILLETES_USD.map((valor) => (
            <label key={valor} class="flex flex-col gap-1 text-sm">
              ${valor}
              <input
                type="number"
                min="0"
                value={denominacionesUsd[valor] ?? ''}
                onInput={(e) => setDenominacionesUsd((d) => ({ ...d, [valor]: (e.target as HTMLInputElement).value }))}
                class="rounded bg-[var(--background_color_2)] px-2 py-1"
              />
            </label>
          ))}
        </div>
      </div>

      <p class="monto text-2xl">
        Efectivo contado: {formatoCRC(efectivoContado)} · Dólares contados: ${usdContado}
      </p>

      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          Lote BAC
          <input value={loteBac} onInput={(e) => setLoteBac((e.target as HTMLInputElement).value)} class="rounded bg-[var(--background_color_2)] px-3 py-2" />
        </label>
        <label class="flex flex-col gap-1">
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
        </div>
      )}

      {!resultado && (
        <button type="button" onClick={cerrar} class="boton-pos rounded-lg bg-[var(--principal-color)] text-xl font-bold">
          Cerrar caja
        </button>
      )}

      {vistaPrevia && <VistaPreviaTicket html={vistaPrevia} onCerrar={() => setVistaPrevia(null)} />}
    </div>
  );
}
