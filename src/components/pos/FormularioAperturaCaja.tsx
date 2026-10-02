import { useState } from 'preact/hooks';

/** Apertura de caja (§3.1): fondo inicial + tipo de cambio del día. Sin esto no se puede vender. */
export default function FormularioAperturaCaja() {
  const [fondoInicial, setFondoInicial] = useState('30000');
  const [tipoCambioUsd, setTipoCambioUsd] = useState('505');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function abrir(evento: SubmitEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const respuesta = await fetch('/api/caja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fondoInicial: Number(fondoInicial),
        tipoCambioUsd: Number(tipoCambioUsd),
      }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json();
      setError(cuerpo.error ?? 'No se pudo abrir la caja');
      setEnviando(false);
      return;
    }

    window.location.href = '/vender';
  }

  return (
    <form onSubmit={abrir} class="flex w-full max-w-sm flex-col gap-5">
      <label class="flex flex-col gap-1">
        <span class="text-[var(--text_color_2)]">Fondo inicial (₡)</span>
        <input
          type="number"
          min="0"
          required
          value={fondoInicial}
          onInput={(evento) => setFondoInicial((evento.target as HTMLInputElement).value)}
          class="boton-pos rounded-lg bg-[var(--background_color_2)] px-4 text-2xl text-[var(--gold)] monto"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[var(--text_color_2)]">Tipo de cambio del dólar (₡ por $1)</span>
        <input
          type="number"
          min="1"
          required
          value={tipoCambioUsd}
          onInput={(evento) => setTipoCambioUsd((evento.target as HTMLInputElement).value)}
          class="boton-pos rounded-lg bg-[var(--background_color_2)] px-4 text-2xl text-[var(--gold)] monto"
        />
      </label>

      {error && <p class="text-[var(--principal-color)]">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        class="boton-pos rounded-lg bg-[var(--principal-color)] text-xl font-bold text-[var(--text_color_1)]"
      >
        Abrir caja
      </button>
    </form>
  );
}
