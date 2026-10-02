# S&J POS

Sistema de ventas, pedidos y cierre de caja para S&J Parrilladas y Catering Service.

El plan completo está en [`PLAN_POS_SJ.md`](./PLAN_POS_SJ.md). El trabajo está partido
por fases en [`docs/fases/`](./docs/fases/README.md) — empezar ahí para saber qué sigue
y qué ya está hecho.

## Arrancar en desarrollo

```bash
npm install
npm run db:generate   # genera las migraciones de Drizzle a partir de src/db/schema.ts
npm run db:migrate    # crea sj-pos.db y aplica las migraciones
npm run db:seed       # carga categorías/productos (seed/productos.csv) y un usuario Admin
npm run dev           # astro dev en http://localhost:4321
```

El PIN del usuario Admin inicial es `0000` a menos que se corra el seed con
`SJ_POS_ADMIN_PIN=xxxx npm run db:seed`. **Cámbialo** antes de usar esto en un evento real.

Para correr dentro de la ventana de Electron (en vez de solo el navegador):

```bash
npm run electron:dev
```

## Respaldo automático en cada cierre

Al cerrar la caja (Z), el servidor guarda solo una copia de `sj-pos.db` y el PDF del
cierre en `~/Documents/SJ-POS/respaldos/` (§8 del plan) — no hace falta acordarse de
descargar nada. La carpeta se puede cambiar con `SJ_POS_RESPALDOS_DIR` si el sistema
usa otro nombre (ej. "Documentos" en vez de "Documents"). Si el respaldo falla (disco
lleno, sin permisos), el cierre **no se revierte** — ya quedó guardado en la base de
datos — pero la pantalla de cierre muestra el error para que se resuelva a mano.

## Ver los tiquetes sin impresora ni papel

Mientras no se confirme el modelo de la Epson ni haya papel térmico a la mano
(ver `docs/fases/fase-1-mvp.md`), los tiquetes se pueden revisar en pantalla:

```
http://localhost:4321/tickets-demo
```

Esa página usa el mismo código (`src/lib/tickets/`) que se usará para imprimir de
verdad — el diseño no cambia cuando llegue la impresora, solo cambia a dónde se manda.

## Estructura

Ver `PLAN_POS_SJ.md` §9 para la justificación de cada pieza del stack
(Electron, Astro + Preact, Tailwind 4, SQLite + Drizzle, Zod, node-thermal-printer).

```
electron/main.cjs        ventana de Electron
src/db/                   esquema Drizzle, cliente SQLite (WAL), migraciones, contadores
src/lib/dinero.ts         formato y cálculos de vuelto (₡ y $)
src/lib/permisos.ts       roles y qué acciones piden PIN de admin
src/lib/tickets/          plantillas de tiquete + impresión ESC/POS + vista previa HTML
src/components/pos/       componentes Preact de la interfaz de venta
src/pages/                páginas Astro (login, venta, API)
seed/                     lista de precios inicial y script de siembra
docs/fases/               el plan partido en fases, con checklist por fase
```
