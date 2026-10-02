import { useState } from 'preact/hooks';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'entrar'];

export default function TecladoPin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (pin.length < 4 || enviando) return;
    setEnviando(true);
    setError(null);

    const respuesta = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json();
      setError(cuerpo.error ?? 'No se pudo iniciar sesión');
      setPin('');
      setEnviando(false);
      return;
    }

    window.location.href = '/vender';
  }

  function tocar(tecla: string) {
    if (tecla === 'borrar') {
      setPin((actual) => actual.slice(0, -1));
      return;
    }
    if (tecla === 'entrar') {
      confirmar();
      return;
    }
    if (pin.length < 6) setPin((actual) => actual + tecla);
  }

  return (
    <div class="flex flex-col items-center gap-6">
      <div class="monto text-5xl tracking-widest text-[var(--gold)]" aria-live="polite">
        {pin.replace(/./g, '•').padEnd(4, '·')}
      </div>

      {error && <p class="text-[var(--principal-color)]">{error}</p>}

      <div class="grid grid-cols-3 gap-3">
        {TECLAS.map((tecla) => (
          <button
            key={tecla}
            type="button"
            disabled={enviando}
            onClick={() => tocar(tecla)}
            class="boton-pos w-20 rounded-lg bg-[var(--background_color_2)] text-2xl text-[var(--text_color_1)] active:bg-[var(--accent_color)]"
          >
            {tecla === 'borrar' ? '←' : tecla === 'entrar' ? '✓' : tecla}
          </button>
        ))}
      </div>
    </div>
  );
}
