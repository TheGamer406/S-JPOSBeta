# S&J POS

Sistema de ventas, pedidos y cierre de caja para S&J Parrilladas y Catering Service.

El plan completo está en [`PLAN_POS_SJ.md`](./PLAN_POS_SJ.md). El trabajo está partido
por fases en [`docs/fases/`](./docs/fases/README.md) — empezar ahí para saber qué sigue
y qué ya está hecho.

## Abrir el POS con doble clic

El POS corre **empaquetado en Docker** (ver `docs/fases/fase-5-docker.md`). La base y
los respaldos quedan en la carpeta `datos/` y sobreviven a apagar/reiniciar.

### Windows (la laptop del evento)

Doble clic en **`INICIAR-POS.bat`**. Nada más.

La primera vez construye la imagen (tarda unos minutos) y crea la base de datos con un
usuario Admin de PIN `0000` — **cambialo desde Usuarios antes del evento**. Después de
eso, cada doble clic levanta el POS, arranca el puente de impresión y abre el navegador.

Requisito único: tener **Docker Desktop** instalado y corriendo. Si no está, el script
lo dice y no hace nada más. (Ya no hace falta Node.js para correr el POS.)

La ventana que queda abierta controla el POS: cerrarla lo apaga.

### Linux

```bash
./instalar-acceso-directo.sh
```

Crea el ícono **S&J POS** en el escritorio y en el menú de aplicaciones; de ahí
en adelante funciona igual que en Windows. Requisito: **Docker** instalado y corriendo.
El script detecta la impresora en `/dev/usb/lp0` y, si está conectada, la pasa al
contenedor automáticamente.

### Tablet para la pantalla de cocina

Al arrancar, el script muestra una dirección tipo `http://192.168.1.25:4321/cocina`.
Esa es la que se abre en la tablet, conectada al mismo WiFi que la laptop.

En Windows puede hacer falta permitir Node.js en el Firewall la primera vez
(sale un aviso: elegir "Redes privadas").

## Correr en Docker a mano (sin los scripts de doble clic)

```bash
npm run docker:build        # construye la imagen sj-pos:latest
npm run docker:up           # Linux  (incluye la impresora /dev/usb/lp0 si está)
npm run docker:up:win       # Windows (usa el puente de impresión en el host)
npm run docker:down         # apaga
```

El PIN del Admin inicial se fija con `SJ_POS_ADMIN_PIN=xxxx` antes de levantar la
primera vez (si no, queda `0000`). La base y los respaldos van a `./datos`.

## Arrancar en desarrollo (sin Docker)

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

**En Linux** (donde se probó físicamente): `iniciar-pos.sh` detecta `/dev/usb/lp0` y lo
pasa al contenedor solo, con el GID del grupo `lp` del sistema — no hay que configurar
nada a mano. Si querés correr el contenedor por tu cuenta, el override
`docker-compose.linux.yml` ya mapea el dispositivo y define
`SJ_POS_IMPRESORA_INTERFAZ=/dev/usb/lp0`.

**En Windows el contenedor es Linux y no ve el USB directo**, así que la impresión pasa
por un puente que corre en el host (`scripts/print-bridge/`, arrancado solo por
`INICIAR-POS.bat`). Hay que instalar la AON en Windows y **compartirla** con un nombre
(por defecto `AON`); el puente recibe el ESC/POS del contenedor y lo manda a esa
impresora. Detalle y diagnóstico en [`scripts/print-bridge/README.md`](./scripts/print-bridge/README.md).
Conviene probarlo antes del evento, no el mismo día.

El ancho y la gaveta se ajustan con variables (valen en ambos sistemas):

```bash
SJ_POS_IMPRESORA_ANCHO=80     # 80 o 58
SJ_POS_IMPRESORA_GAVETA=false # true si tiene gaveta de dinero conectada
```

Mientras no esté configurada (o si el envío falla), los tiquetes salen en pantalla y
nada se pierde.

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
