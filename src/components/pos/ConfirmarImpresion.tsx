interface ConfirmarImpresionProps {
  mensaje?: string;
  onImprimir: () => void;
  onSaltar: () => void;
}

/** El tiquete para el cliente es opcional — no todos lo piden (§3.10). */
export default function ConfirmarImpresion({ mensaje, onImprimir, onSaltar }: ConfirmarImpresionProps) {
  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div class="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-[var(--background_color_1)] p-6">
        <h2 class="marca text-2xl">¿Imprimir tiquete?</h2>
        {mensaje && <p class="text-[var(--text_color_2)]">{mensaje}</p>}
        <div class="flex gap-3">
          <button
            type="button"
            onClick={onSaltar}
            class="boton-pos flex-1 rounded-lg bg-[var(--background_color_2)] font-bold"
          >
            Saltar
          </button>
          <button
            type="button"
            onClick={onImprimir}
            class="boton-pos flex-1 rounded-lg bg-[var(--principal-color)] font-bold"
          >
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
