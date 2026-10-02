import { imprimirTicket, ImpresionFallidaError, type ConfiguracionImpresora } from './printer';
import { renderizarTicketHtml } from './preview';
import type { Ticket } from './tipos';

export * from './tipos';
export * from './templates';
export { imprimirTicket, ImpresionFallidaError, renderizarTicketHtml };
export type { ConfiguracionImpresora };

export interface ResultadoEmision {
  impreso: boolean;
  html?: string; // presente cuando impreso = false, para mostrar en pantalla
  error?: string;
}

/**
 * Punto único por el que debe pasar cada tiquete de la app: intenta imprimir en
 * la Epson y, si falla o no hay impresora configurada todavía (como ahora, sin
 * papel para probar), cae a la vista previa en pantalla en vez de perder el tiquete.
 */
export async function emitirTicket(
  ticket: Ticket,
  config: ConfiguracionImpresora | null,
): Promise<ResultadoEmision> {
  if (!config) {
    return { impreso: false, html: renderizarTicketHtml(ticket) };
  }

  try {
    await imprimirTicket(ticket, config);
    return { impreso: true };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return { impreso: false, html: renderizarTicketHtml(ticket, config.anchoMm), error: mensaje };
  }
}
