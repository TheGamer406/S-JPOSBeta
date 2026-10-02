# Fase 0 — Base

> Estimado original: 1–2 días · PLAN_POS_SJ.md §10

## Alcance

- Repo, Electron + Astro funcionando, esquema SQLite y seed de productos con la lista de precios.
- Login con PIN y roles.

## Checklist

- [x] Repo git inicializado con el plan (`PLAN_POS_SJ.md`).
- [x] `package.json` con Astro + adaptador Node, Preact, Tailwind 4, better-sqlite3,
      Drizzle ORM, Zod, bcryptjs, node-thermal-printer, Electron (`package.json`).
- [x] `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `electron/main.cjs`.
- [x] Estilos globales con los tokens de §7 (`src/styles/global.css`).
- [x] Esquema de base de datos completo según §4, en Drizzle (`src/db/schema.ts`).
- [x] Cliente SQLite en modo WAL (`src/db/client.ts`) — resiste apagones (§6, §8).
- [x] Contadores consecutivos atómicos para `S&J000X` y el número de orden del día
      (`src/db/contadores.ts`).
- [x] Script de migraciones (`src/db/migrate.ts`, `npm run db:migrate`).
- [x] Seed de productos desde la lista de precios (`seed/productos.csv`, `seed/seed.ts`).
- [x] Usuario admin inicial con PIN (vía seed, `SJ_POS_ADMIN_PIN`).
- [x] Pantalla de login con teclado numérico PIN (`src/pages/index.astro`,
      `src/components/pos/TecladoPin.tsx`) y endpoint de autenticación
      (`src/pages/api/auth.ts`) que valida contra `pin_hash` con bcrypt.
- [x] Helpers de roles y permisos (`src/lib/permisos.ts`) según la tabla de §2.
- [x] `npm install` corrido con éxito (hubo que subir `better-sqlite3` de ^11.5.0 a
      ^13.0.3 porque la versión del Node de esta máquina es muy reciente).
- [x] `npm run dev` levanta Astro y responde en `http://localhost:4321`. Falta probar
      `npm run electron:dev` abriendo la ventana real de Electron (solo se probó el
      servidor Astro solo, vía curl).
- [x] Login PIN probado de punta a punta contra la base migrada y sembrada: PIN
      correcto autentica y pone la cookie, PIN incorrecto da 401.

## Referencias al plan

- §2 Usuarios y roles
- §4 Modelo de datos
- §7 Diseño visual
- §8 Dónde corre (Electron + SQLite local)
- §9 Stack técnico y estructura de carpetas

## Notas

El esquema (`schema.ts`) no expresa todavía como restricción de base de datos la regla
"una venta `a_cuenta` debe tener `cliente_id`" (§4) — Drizzle-SQLite necesita un `CHECK`
crudo para eso. Se valida en la capa de app (Zod) en la Fase 1, cuando se construya el
flujo de cobro real.
