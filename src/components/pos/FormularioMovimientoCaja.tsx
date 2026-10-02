import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';

interface Movimiento {
  id: string;
  tipo: 'entrada' | 'salida';
  monto: number;
  motivo: string;
  creadoEn: string;
}

/** Entradas/salidas de efectivo fuera de ventas (§3.7): hielo, gas, cambio agregado... */
export default function FormularioMovimientoCaja() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('salida');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const respuesta = await fetch('/api/caja/movimientos');
    const cuerpo = await respuesta.json();
    setMovimientos(cuerpo.movimientos ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function registrar(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);

    const respuesta = await fetch('/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, monto: Number(monto), motivo }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json();
      setError(cuerpo.error ?? 'No se pudo registrar el movimiento');
      return;
    }

    setMonto('');
    setMotivo('');
    cargar();
  }

  return (
    <div class="flex flex-col gap-6 p-4">
      <h1 class="marca text-3xl">Entradas y salidas de caja</h1>

      <form onSubmit={registrar} class="flex max-w-md flex-col gap-2 rounded-xl bg-[var(--background_color_2)] p-4">
        <select
          value={tipo}
          onChange={(e) => setTipo((e.target as HTMLSelectElement).value as typeof tipo)}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        >
          <option value="salida">Salida (hielo, gas, pago a ayudante...)</option>
          <option value="entrada">Entrada (más cambio agregado)</option>
        </select>
        <input
          type="number"
          placeholder="Monto (₡)"
          required
          value={monto}
          onInput={(e) => setMonto((e.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        />
        <input
          placeholder="Motivo"
          required
          value={motivo}
          onInput={(e) => setMotivo((e.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        />
        {error && <p class="text-[var(--principal-color)]">{error}</p>}
        <button type="submit" class="boton-pos rounded bg-[var(--principal-color)] font-bold">
          Registrar
        </button>
      </form>

      <ul class="flex max-w-md flex-col gap-1">
        {movimientos.map((movimiento) => (
          <li key={movimiento.id} class="flex justify-between rounded bg-[var(--background_color_2)] px-3 py-2">
            <span>
              {movimiento.tipo === 'salida' ? '−' : '+'} {movimiento.motivo}
            </span>
            <span class="monto">{formatoCRC(movimiento.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
