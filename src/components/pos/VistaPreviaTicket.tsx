interface VistaPreviaTicketProps {
  html: string;
  aviso?: string;
  onCerrar: () => void;
}

/**
 * Overlay que muestra el tiquete en pantalla (preview.ts) cuando no hay impresora
 * configurada o falló el envío — nunca se pierde el tiquete (§6).
 */
export default function VistaPreviaTicket({ html, aviso, onCerrar }: VistaPreviaTicketProps) {
  return (
    <div class="fixed inset-0 z-50 flex flex-col items-center gap-4 overflow-auto bg-black/80 p-6">
      {aviso && (
        <p class="max-w-md rounded bg-[var(--principal-color)] px-4 py-2 text-center text-sm">
          {aviso} — se muestra en pantalla en vez de imprimirse.
        </p>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <button
        type="button"
        onClick={onCerrar}
        class="boton-pos rounded-lg bg-[var(--accent_color)] px-8 text-lg font-bold"
      >
        Cerrar
      </button>
    </div>
  );
}
