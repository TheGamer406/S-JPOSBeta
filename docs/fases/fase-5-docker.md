# Fase 5 — Empaquetado en Docker (Linux + Windows 11) ⭐

> Ronda 2. Objetivo: que el POS corra **empaquetado en Docker, sí o sí**, en este
> equipo (Linux CachyOS) y también en una laptop con Windows 11, con el mínimo de
> pasos manuales el día del evento. PLAN_POS_SJ.md §8 (dónde corre), §9 (stack).

## Por qué tiene sentido (y qué cambia)

- La app es un servidor Astro SSR (adaptador `@astrojs/node` en modo `standalone`) +
  SQLite (WAL) + `better-sqlite3` (módulo nativo). En Docker, `better-sqlite3` se
  compila contra **Node normal**, no contra el ABI de Electron — que fue justo lo que
  dejó trabado el empaquetado con Electron (`e509096 wip: ... bloqueado por el binario
  de better-sqlite3`). **Docker destraba ese problema**, no lo hereda.
- Una sola imagen corre igual en Linux y en Windows 11 (vía Docker Desktop / WSL2).
- Cambio de UX respecto a Electron: ya no hay una "ventana de escritorio". El
  contenedor levanta el servidor y el POS se abre en el **navegador** en
  `http://localhost:4321` — que es como ya se usa hoy en desarrollo y en la red local
  (tablet de cocina). El `INICIAR-POS.bat` / `iniciar-pos.sh` pasan a envolver
  `docker compose up` en vez de `npm`.

## Decisiones tomadas (2026-10-02)

1. **Docker es la forma principal de correr. Electron queda deprecado** (no se borra,
   pero no se mantiene). Las dos configs de empaquetado en conflicto (`build` en
   `package.json` y `electron-builder.json`) quedan como deuda sin tocar; ya no son el
   camino de distribución.
2. **La impresora AON imprime DIRECTO en Windows** — nada de PDF como sustituto. Como el
   contenedor es Linux y el USB está en Windows, se usa la **opción A (puente de
   impresión en el host de Windows)**: el contenedor manda los bytes ESC/POS por red a
   `host.docker.internal:9100` y un mini-servicio en el host los reenvía a la AON. En
   **este equipo (Linux)** se imprime directo con `--device=/dev/usb/lp0` (ya probado).
3. **Puerto y red:** el contenedor publica `4321` (`-p 4321:4321`); la tablet de cocina
   sigue entrando por `http://IP-de-la-laptop:4321`.

## Checklist

### Imagen y arranque
- [x] `Dockerfile` multi-stage: build (`npm ci` + `npm run build`, con toolchain para
      compilar `better-sqlite3`) y runtime slim que corre `dist/server/entry.mjs`.
- [x] `.dockerignore` (node_modules, dist, release/, dist-electron/, datos/, *.db, logs).
- [x] `docker-compose.yml` base (`-p 4321:4321`, env, volumen) + overrides
      `docker-compose.linux.yml` y `docker-compose.windows.yml` para la impresora.
- [x] Migración + seed al primer arranque, idempotente (`scripts/docker-entrypoint.sh`:
      `tsx src/db/migrate.ts` siempre; seed solo si no hay usuarios). Verificado:
      primer arranque siembra 4 categorías + 15 productos + Admin; reinicio NO re-siembra.
- [x] Usuario Admin inicial con PIN cambiable (`SJ_POS_ADMIN_PIN`). Verificado por curl:
      PIN correcto → 200, PIN incorrecto → 401.

### Persistencia (que no se pierda nada al reiniciar el contenedor)
- [x] Base en volumen: `SJ_POS_DB_PATH=/datos/sj-pos.db`, bind `./datos:/datos`.
      Verificado: `datos/sj-pos.db` queda en el host y sobrevive a `docker compose down`.
- [x] Respaldos del cierre en el mismo volumen: `SJ_POS_RESPALDOS_DIR=/datos/respaldos`
      (carpeta creada por el entrypoint). Falta: ejecutar un cierre real en el
      contenedor y confirmar que el `.db` + PDF del respaldo caen en `datos/respaldos`.
- [x] Datos documentados: quedan en `./datos` del proyecto (gitignored), igual en ambos SO.

### Arranque de doble clic (mantener la experiencia actual)
- [x] `iniciar-pos.sh` (Linux): detecta Docker, construye la imagen si falta, calcula el
      GID de `lp`, incluye el override de impresora solo si `/dev/usb/lp0` existe, abre
      el navegador, imprime la IP de red para la tablet y apaga el contenedor al cerrar
      la ventana. Verificado de punta a punta en este equipo.
- [x] `INICIAR-POS.bat` (Windows): detecta Docker Desktop, arranca el puente de
      impresión, construye si falta, levanta y abre el navegador. **Escrito, sin probar
      en Windows todavía** (este equipo es Linux).
- [x] La ventana que queda abierta explica cómo apagar (cerrarla → `docker compose down`).

### Impresora en Linux (este equipo — camino ESC/POS ya probado en Fase 1)
- [x] Dispositivo al contenedor vía `devices: /dev/usb/lp0` + `group_add` con el GID de
      `lp` (`docker-compose.linux.yml`, GID calculado por `iniciar-pos.sh`).
- [ ] Pendiente con la impresora conectada: `POST /api/tickets/venta` imprimiendo físico
      **desde el contenedor** (hoy no estaba conectada; el camino ESC/POS ya se probó
      fuera de Docker en Fase 1).

### Impresora AON en Windows 11 — opción A (puente en el host), elegida
- [x] Puente `scripts/print-bridge/bridge-impresion.ps1`: escucha TCP 9100 y reenvía el
      ESC/POS a la AON compartida (`copy /b` RAW). Contenedor apuntado con
      `SJ_POS_IMPRESORA_INTERFAZ=tcp://host.docker.internal:9100` + `extra_hosts`.
- [ ] **Probar en la laptop Windows**: instalar y compartir la AON, correr el puente,
      e imprimir un tiquete real desde el contenedor. No se puede verificar desde Linux.
- [x] Fallback vivo mientras tanto: sin impresora (o si falla), `emitirTicket()` cae a
      vista previa en pantalla; la descarga de PDF llega con la Fase 6.

## La impresora AON en Windows 11 dentro de un contenedor

El contenedor es Linux (aunque la laptop sea Windows). Un USB conectado a Windows **no
aparece** solo dentro del contenedor. **Decisión: opción A (puente en el host)**, porque
imprime directo en Windows sin depender de pasar el USB al contenedor.

- **A — Puente de impresión en el host (ELEGIDA).** La AON se instala y se **comparte**
  en Windows; el contenedor NO toca el USB. El contenedor manda el ESC/POS por TCP a
  `host.docker.internal:9100`, donde escucha `scripts/print-bridge/bridge-impresion.ps1`,
  que reenvía los bytes RAW a la impresora compartida (`copy /b`). `printer.ts` ya habla
  ESC/POS por `tcp://`; solo cambia la `interfaz`.
- **B — `usbipd-win` → WSL2 → `--device`** (descartada). Además de frágil y con pasos
  manuales al reconectar, el kernel por defecto de WSL2 no trae el módulo `usblp`, así
  que `/dev/usb/lp0` ni siquiera aparecería sin recompilar el kernel. Inviable para el
  día del evento.
- **C — Solo descarga/pantalla en Windows** (descartada por pedido explícito: en Windows
  tiene que imprimir directo). Igual queda como red de seguridad vía Fase 6.

La impresión en **este equipo (Linux)** no depende de esto — va por `--device` y el
camino ESC/POS ya se probó (ver Fase 1).

## Referencias al plan

§8 (dónde corre: local, sin nube, red local para tablet), §9 (stack y estructura),
Fase 1 (decisión §8.4 impresora AON/ESC/POS ya resuelta en Linux),
`src/lib/pos/respaldos.ts`, `src/lib/pos/configuracionImpresora.ts`,
`src/lib/tickets/printer.ts`.
