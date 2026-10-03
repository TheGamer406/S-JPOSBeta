import { join } from 'node:path';

/**
 * Rutas a las fuentes que usan los PDFs (cierre, despacho). Se resuelven desde
 * `process.cwd()` en vez de una ruta relativa a `import.meta.url`: Astro empaqueta
 * cada módulo del build de producción a una profundidad distinta dentro de
 * `dist/server/` (uno queda en un chunk compartido, otro se inlinea directo en su
 * ruta), así que un "../../../assets/..." fijo apunta a un lugar distinto según
 * quién lo calcule y se rompe en silencio (ENOENT) — pasó con la hoja de despacho
 * en el build de Docker aunque `npm run dev` nunca lo mostró. `process.cwd()` es
 * estable: `/app` en el contenedor, la raíz del proyecto en dev/preview.
 */
const BASE = process.env.SJ_POS_ASSETS_DIR ?? join(process.cwd(), 'assets');

export const FUENTE_REGULAR = join(BASE, 'fonts', 'NotoSans-Regular.ttf');
export const FUENTE_BOLD = join(BASE, 'fonts', 'NotoSans-Bold.ttf');
