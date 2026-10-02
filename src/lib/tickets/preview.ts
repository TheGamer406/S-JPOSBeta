import type { Ticket } from './tipos';

/**
 * Renderiza el mismo Ticket que printer.ts manda a la Epson, pero como HTML en
 * pantalla. Es la ruta de prueba mientras no hay papel térmico o impresora a la
 * mano (§6: "si la impresora falla, se muestra en pantalla y se avisa") — y
 * también sirve para revisar el diseño de cada tiquete antes de imprimir de verdad.
 */
export function renderizarTicketHtml(ticket: Ticket, anchoMm: 58 | 80 = 80): string {
  const anchoPx = anchoMm === 80 ? 384 : 280; // ~ ancho real de rollo a 96dpi

  const lineasHtml = ticket.lineas
    .map((linea) => {
      switch (linea.tipo) {
        case 'texto': {
          const alineacion =
            linea.align === 'centro' ? 'center' : linea.align === 'derecha' ? 'right' : 'left';
          const peso = linea.negrita ? 'bold' : 'normal';
          const tamano = linea.grande ? '1.5em' : '1em';
          return `<div style="text-align:${alineacion};font-weight:${peso};font-size:${tamano};white-space:pre-wrap">${escaparHtml(linea.texto)}</div>`;
        }
        case 'separador':
          return '<hr style="border:none;border-top:1px dashed #000;margin:4px 0" />';
        case 'espacio':
          return '<div style="height:1em"></div>';
        case 'firma':
          return `<div style="text-align:center;margin-top:1.5em">
            <div style="border-top:1px solid #000;width:80%;margin:0 auto"></div>
            <div>${escaparHtml(linea.etiqueta)}</div>
          </div>`;
        case 'qr':
          return `<div style="text-align:center;font-size:0.75em">[QR: ${escaparHtml(linea.datos)}]</div>`;
      }
    })
    .join('\n');

  return `<div style="width:${anchoPx}px;background:#fff;color:#000;font-family:'Courier New',monospace;padding:12px;box-shadow:0 0 6px rgba(0,0,0,0.3)">
    ${lineasHtml}
    ${ticket.copias > 1 ? `<div style="text-align:center;margin-top:8px;font-size:0.75em;color:#555">(se imprimen ${ticket.copias} copias)</div>` : ''}
  </div>`;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
