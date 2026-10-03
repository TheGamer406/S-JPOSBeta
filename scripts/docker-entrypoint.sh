#!/bin/sh
# Arranque del contenedor (Fase 5): migra la base, siembra si está vacía y levanta
# el servidor. Es idempotente — se puede reiniciar el contenedor sin duplicar nada.
set -e

DB_PATH="${SJ_POS_DB_PATH:-/datos/sj-pos.db}"
mkdir -p "$(dirname "$DB_PATH")" "${SJ_POS_RESPALDOS_DIR:-/datos/respaldos}"

echo "[entrypoint] Aplicando migraciones en $DB_PATH ..."
# Migrador plano de Drizzle (lleva su propia tabla de control: no re-aplica).
# SJ_POS_MIGRACIONES queda SIN definir a propósito, para que client.ts no intente
# migrar también por su cuenta (usa otra tabla de control y chocaría).
npx tsx src/db/migrate.ts

USUARIOS=$(node -e "const D=require('better-sqlite3');const db=new D(process.env.SJ_POS_DB_PATH||'/datos/sj-pos.db');let n=0;try{n=db.prepare('SELECT COUNT(*) AS c FROM usuarios').get().c}catch(e){n=0};console.log(n)")

if [ "$USUARIOS" = "0" ]; then
  echo "[entrypoint] Base sin usuarios: sembrando productos y usuario Admin (PIN ${SJ_POS_ADMIN_PIN:-0000})..."
  npx tsx seed/seed.ts
else
  echo "[entrypoint] Ya hay $USUARIOS usuario(s): no se siembra."
fi

echo "[entrypoint] Levantando el POS en ${HOST:-0.0.0.0}:${PORT:-4321} ..."
exec node dist/server/entry.mjs
