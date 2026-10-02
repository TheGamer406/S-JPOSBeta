import { resolve, join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export const DB_PATH = resolve(process.env.SJ_POS_DB_PATH ?? 'sj-pos.db');

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL'); // resiste apagones de golpe (§6, §8)
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

/**
 * En la app empaquetada (Electron) la base vive en la carpeta del usuario y
 * empieza vacía: hay que migrarla al arrancar. Se aplican los .sql a mano en
 * vez de usar el migrador de Drizzle porque ese crashea (core dump) corriendo
 * bajo el Node que trae Electron. Esto es solo leer archivos y ejecutarlos.
 * En desarrollo no corre: ahí se usa `npm run db:migrate`.
 */
const carpetaMigraciones = process.env.SJ_POS_MIGRACIONES;
if (carpetaMigraciones && existsSync(carpetaMigraciones)) {
  sqlite.exec('CREATE TABLE IF NOT EXISTS migraciones_aplicadas (archivo TEXT PRIMARY KEY)');

  const yaAplicadas = new Set(
    (sqlite.prepare('SELECT archivo FROM migraciones_aplicadas').all() as { archivo: string }[]).map(
      (fila) => fila.archivo,
    ),
  );

  const pendientes = readdirSync(carpetaMigraciones)
    .filter((archivo) => archivo.endsWith('.sql') && !yaAplicadas.has(archivo))
    .sort();

  for (const archivo of pendientes) {
    const sql = readFileSync(join(carpetaMigraciones, archivo), 'utf-8');
    // Drizzle separa las sentencias con este marcador.
    const sentencias = sql
      .split('--> statement-breakpoint')
      .map((parte) => parte.trim())
      .filter(Boolean);

    sqlite.transaction(() => {
      for (const sentencia of sentencias) sqlite.exec(sentencia);
      sqlite.prepare('INSERT INTO migraciones_aplicadas (archivo) VALUES (?)').run(archivo);
    })();
  }

  sqlite.exec(`
    INSERT INTO contadores (nombre, valor)
    SELECT 'cuenta', 0 WHERE NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'cuenta');
    INSERT INTO contadores (nombre, valor)
    SELECT 'orden_dia', 0 WHERE NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'orden_dia');
  `);
}

export { sqlite };
