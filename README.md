# S&J POS

Sistema de ventas, pedidos y cierre de caja para S&J Parrilladas y Catering Service.

El plan completo está en [`PLAN_POS_SJ.md`](./PLAN_POS_SJ.md). El trabajo está partido
por fases en [`docs/fases/`](./docs/fases/README.md) — empezar ahí para saber qué sigue
y qué ya está hecho.

## Abrir el POS con doble clic

En la laptop del evento, una sola vez:

```bash
./instalar-acceso-directo.sh
```

Eso crea el ícono **S&J POS** en el escritorio y en el menú de aplicaciones.
De ahí en adelante se abre con doble clic: el script instala lo que falte,
crea la base si no existe, levanta el servidor y abre el navegador. También
muestra la dirección para entrar desde una tablet en el mismo WiFi (útil para
la pantalla de cocina).

La ventana de terminal que queda abierta **es** el POS: cerrarla lo apaga.

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

## Impresora térmica

§8 decisión 4, ya resuelta: es una **AON por USB, papel de 80 mm**. No hace falta que
sea Epson — casi cualquier impresora térmica de recibo (AON, Epson, clones genéricos)
habla el mismo protocolo ESC/POS, que es lo que ya usa `src/lib/tickets/printer.ts`.

Para activarla, definir antes de `npm run dev` (o en `.env`):

```bash
SJ_POS_IMPRESORA_INTERFAZ=/dev/usb/lp0   # en Linux, la ruta que aparece al conectarla
SJ_POS_IMPRESORA_ANCHO=80                # 80 o 58
SJ_POS_IMPRESORA_GAVETA=false            # true si tiene gaveta de dinero conectada
```

En Linux, el usuario que corre la app necesita estar en el grupo `lp` (dueño del
dispositivo `/dev/usb/lp0`):

```bash
sudo usermod -aG lp "$USER"
# cerrar sesión y volver a entrar para que el grupo nuevo tome efecto
```

Sin `SJ_POS_IMPRESORA_INTERFAZ` configurada (o si falla el envío), `emitirTicket()`
cae sola a la vista previa en pantalla — nunca se pierde un tiquete. Para ver el
diseño sin tocar nada de esto:

```
http://localhost:4321/tickets-demo
```

Esa página usa el mismo código (`src/lib/tickets/`) que se usa para imprimir de
verdad — el diseño no cambia según a dónde se manda.

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
