// DSL pequeño y compartido para describir un tiquete una sola vez y poder:
//   1) imprimirlo en la térmica Epson (printer.ts, ESC/POS), o
//   2) mostrarlo en pantalla (preview.ts) cuando no hay impresora o no hay papel.
// Así los dos "renderers" nunca se desincronizan (§3.10).

export type Alineacion = 'izquierda' | 'centro' | 'derecha';

export type LineaTicket =
  | { tipo: 'texto'; texto: string; align?: Alineacion; negrita?: boolean; grande?: boolean }
  | { tipo: 'separador' }
  | { tipo: 'espacio' }
  | { tipo: 'firma'; etiqueta: string }
  | { tipo: 'qr'; datos: string };

export interface Ticket {
  titulo: string; // para el nombre del archivo/registro, no se imprime necesariamente
  lineas: LineaTicket[];
  copias: number; // la mayoría 1; apertura de cuenta y cargo a cuenta van en 2 (§3.10)
}

export const PIE_LEGAL: LineaTicket[] = [
  { tipo: 'separador' },
  { tipo: 'texto', texto: 'Tiquete interno - no es', align: 'centro' },
  { tipo: 'texto', texto: 'comprobante electrónico', align: 'centro' },
];
