import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DB_PATH, sqlite } from '@/db/client';
import { construirReporteCierre } from './reporteCierre';
import { generarPdfCierre } from './pdfCierre';

/**
 * Carpeta de respaldos (§8): "Documentos/SJ-POS/respaldos/" en la laptop. Se puede
 * cambiar con SJ_POS_RESPALDOS_DIR si el sistema no usa "Documents" como nombre
 * de carpeta (ej. "Documentos" en Windows/Linux en español).
 */
function carpetaRespaldos(): string {
  const carpeta = process.env.SJ_POS_RESPALDOS_DIR ?? join(homedir(), 'Documents', 'SJ-POS', 'respaldos');
  mkdirSync(carpeta, { recursive: true });
  return carpeta;
}

function nombreSeguro(fecha: string): string {
  return fecha.replace(/[:\s]/g, '-');
}

/**
 * Al cerrar la caja (§8): copia sj-pos.db y guarda el PDF del cierre en la carpeta
 * de respaldos, sin que el cajero tenga que acordarse de darle clic a nada. Si esto
 * falla, no debe tumbar el cierre — ya quedó guardado en la base de datos.
 */
export async function respaldarCierre(sesionCajaId: string): Promise<{ dbPath: string; pdfPath: string }> {
  const carpeta = carpetaRespaldos();
  const reporte = await construirReporteCierre(sesionCajaId);
  const fecha = nombreSeguro(reporte.sesion.cerradaEn ?? reporte.sesion.abiertaEn);

  // Modo WAL (§8): sin esto, los cambios más recientes pueden seguir en el
  // archivo -wal y no quedar en la copia de sj-pos.db.
  sqlite.pragma('wal_checkpoint(FULL)');

  const dbPath = join(carpeta, `sj-pos-${fecha}.db`);
  copyFileSync(DB_PATH, dbPath);

  const pdfPath = join(carpeta, `cierre-${fecha}.pdf`);
  const doc = generarPdfCierre(reporte);
  const trozos: Buffer[] = [];
  doc.on('data', (trozo: Buffer) => trozos.push(trozo));
  await new Promise<void>((resolve) => {
    doc.on('end', () => resolve());
    doc.end();
  });
  writeFileSync(pdfPath, Buffer.concat(trozos));

  return { dbPath, pdfPath };
}
