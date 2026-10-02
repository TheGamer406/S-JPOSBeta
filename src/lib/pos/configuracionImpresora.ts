import type { ConfiguracionImpresora } from '@/lib/tickets/printer';

/**
 * Configuración de la impresora térmica (§3.10, §8 decisión 4). Por ahora viene de
 * variables de entorno — no hay todavía una pantalla de Administración para
 * elegirla, así que se define al arrancar la app (electron/main.cjs o .env).
 * Si SJ_POS_IMPRESORA_INTERFAZ no está definida, emitirTicket() cae sola a la
 * vista previa en pantalla (§6: nunca se pierde un tiquete).
 */
export function obtenerConfigImpresora(): ConfiguracionImpresora | null {
  const interfaz = process.env.SJ_POS_IMPRESORA_INTERFAZ;
  if (!interfaz) return null;

  return {
    interfaz,
    anchoMm: process.env.SJ_POS_IMPRESORA_ANCHO === '58' ? 58 : 80,
    abrirGaveta: process.env.SJ_POS_IMPRESORA_GAVETA === 'true',
  };
}
