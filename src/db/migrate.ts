import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './client';

migrate(db, { migrationsFolder: './drizzle' });

// Contadores base, solo si no existen (primera vez que se crea sj-pos.db)
sqlite
  .prepare(`INSERT INTO contadores (nombre, valor)
            SELECT 'cuenta', 0 WHERE NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'cuenta')`)
  .run();
sqlite
  .prepare(`INSERT INTO contadores (nombre, valor)
            SELECT 'orden_dia', 0 WHERE NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'orden_dia')`)
  .run();

console.log('Migraciones aplicadas y contadores listos.');
