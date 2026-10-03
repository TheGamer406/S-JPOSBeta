# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

POS de escritorio (Electron + navegador) para S&J Parrilladas y Catering Service — un
negocio que vende en eventos (ferias, catering) con WiFi local y sin internet
garantizado. Todo corre local: Astro (SSR) + Preact + SQLite (better-sqlite3/Drizzle),
empaquetado como app de Electron o en Docker. El plan de producto completo está en
`PLAN_POS_SJ.md`; el trabajo real está partido por fases en `docs/fases/` (empezar por
`docs/fases/README.md` para ver qué fase es la actual y qué falta). Cada archivo de fase
tiene un checklist con secciones del plan como referencia — si vas a tocar una feature,
lee primero la sección del plan y la fase correspondiente.

## Comandos

```bash
npm run dev              # astro dev en http://localhost:4321
npm run db:generate      # genera migración SQL en drizzle/ a partir de src/db/schema.ts
npm run db:migrate       # aplica migraciones a sj-pos.db (tsx src/db/migrate.ts)
npm run db:seed          # categorías/productos desde seed/productos.csv + usuario Admin
npm run build            # astro build
npm run electron:dev     # astro dev + ventana de Electron juntos (concurrently)
npm run electron:build   # build + electron-builder --linux (AppImage)
```

No hay test runner ni linter configurado en `package.json` — no inventar comandos de
`npm test`/`npm run lint`. Verificar cambios corriendo `npm run dev` y probando a mano
(curl a las rutas de `src/pages/api/`, o click-through en el navegador), o usar la skill
`run`/`verify` de Claude Code.

Docker (empaquetado real, usado en el evento — ver `docs/fases/fase-5-docker.md`):

```bash
npm run docker:build
npm run docker:up       # Linux, pasa /dev/usb/lp0 si hay impresora
npm run docker:up:win   # Windows, impresión vía puente en el host
npm run docker:down
```

## Arquitectura

**Flujo de capas**: páginas Astro en `src/pages/` renderizan SSR y montan islas Preact
de `src/components/pos/`. Las islas llaman a `src/pages/api/*.ts` (rutas `APIRoute` de
Astro), que validan con Zod (`src/lib/pos/esquemas.ts`), chequean sesión/rol, y delegan
la lógica de negocio a funciones en `src/lib/pos/*.ts` (`ventas.ts`, `caja.ts`,
`cuentas.ts`, `programados.ts`, `usuarios.ts`, etc.), que son las que tocan `db`
directamente. El patrón de una ruta API típica (ver `src/pages/api/ventas.ts`):
autenticar vía cookie → chequear permiso (`src/lib/permisos.ts`) → chequear caja abierta
(`sesionActual.ts`) → `safeParse` del body → llamar la función de `lib/pos/` dentro de un
try/catch que distingue errores de negocio (`VentaError` y similares, → 400) de errores
inesperados (re-throw).

**Base de datos** (`src/db/schema.ts`, Drizzle + SQLite, WAL activado): montos en
colones como enteros (sin céntimos); IDs son UUID generados en la app (no autoincrement,
pensando en una futura sincronización); todo tiene `idempotencyKey` o equivalente para
evitar doble-toque en pantallas táctiles (§6 del plan). `movimientosCuenta` es un libro
mayor append-only (nunca se edita; el saldo se calcula sumando). Un pedido **programado**
(`ventas.tipo = 'programado'`) es un plan/saldo que vive sin sesión de caja hasta que se
despacha: cada despacho parcial crea una **venta real** separada que apunta de vuelta al
programado vía `programadoOrigenId` / `planItemId` — el programado en sí nunca lleva
pagos ni número de orden propio. En la app empaquetada (Electron) las migraciones se
aplican a mano leyendo los `.sql` de `drizzle/` (ver comentario en `src/db/client.ts`) en
vez de con el migrador de Drizzle, que crashea bajo el Node de Electron; en desarrollo se
usa `npm run db:migrate` normalmente.

**Auth y roles**: login por PIN (bcrypt) en `src/pages/api/auth.ts`, sesión en cookie
`sj_pos_usuario` (sin JWT ni sesión en la nube — uso 100% local). Tres roles (`admin`,
`cajero`, `cocina`) definidos en `src/lib/permisos.ts`; algunas acciones (anular venta,
descuento, reabrir cierre, etc.) exigen PIN de admin aunque haya un cajero logueado —
`requierePinAdmin()` es la fuente de verdad de cuáles.

**Tiquetes/impresión** (`src/lib/tickets/`): `emitirTicket()` en `index.ts` es el único
punto de entrada — intenta imprimir ESC/POS (`printer.ts`, protocolo genérico de
impresoras térmicas, no específico de ninguna marca) y si falla o no hay impresora
configurada (`configuracionImpresora.ts`, lee env vars `SJ_POS_IMPRESORA_*`) cae sola a
una vista previa HTML (`preview.ts`) — nunca se pierde un tiquete. La ruta
`/tickets-demo` usa el mismo código para previsualizar diseños sin hardware. En Windows
el contenedor Docker (Linux) no ve el USB directo, así que la impresión pasa por un
puente separado en `scripts/print-bridge/` que corre en el host.

**Fechas y zona horaria** (`src/lib/fecha.ts`): SQLite guarda `CURRENT_TIMESTAMP` sin
zona horaria y `new Date()` de JS lo interpreta como hora local, no UTC — usar siempre
`epochDeFechaSqlite()` / `formatoFechaHora()` / `hoyISO()` de ahí en vez de parsear
fechas de la base a mano; ya hubo bugs reales por esto (minutos negativos en alertas de
pedido tardío, pedidos "de hoy" desapareciendo de la cola después de las 6pm hora CR).
El negocio opera en `America/Costa_Rica`; el servidor corre en UTC dentro de Docker.

**Respaldos**: al cerrar caja (Z) se copia `sj-pos.db` + el PDF del cierre a
`~/Documents/SJ-POS/respaldos/` (configurable con `SJ_POS_RESPALDOS_DIR`). Si el
respaldo falla, el cierre no se revierte (ya quedó en la base) pero se muestra el error
en pantalla — ver `src/lib/pos/respaldos.ts`.

## Alias e imports

`@/*` apunta a `src/*` (configurado en `tsconfig.json`). Usar siempre el alias, no rutas
relativas largas entre `lib/`, `components/`, `pages/`.

## Convenciones notables

- Comentarios en el código citan secciones del plan (`§3.5`, `§8 decisión 4`, etc.) —
  cuando un comentario referencia una sección, vale la pena leerla en `PLAN_POS_SJ.md`
  antes de cambiar ese código, porque suele documentar una decisión de negocio no obvia.
- Nombres de variables, campos de esquema y mensajes de error están en español — seguir
  esa convención en código nuevo de este repo.
- Sin impresora configurada (dev normal), los tiquetes se ven en pantalla — no es un
  error, es el comportamiento esperado documentado en §6.
