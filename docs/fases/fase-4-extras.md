# Fase 4 — Extras

> PLAN_POS_SJ.md §10. Sin estimado propio en el plan original; se ataca después de
> que las Fases 1–3 estén probadas en un evento real.

## Alcance

- Pantalla de cocina (otra tablet o TV, solo ve la cola, no ve dinero — §2).
- Reportes por evento, producto y cajero; exportar a Excel.
- Comanda de cocina impresa (`ticketComandaCocina` ya existe en
  `src/lib/tickets/templates.ts`).
- Red local para tablet/celular (hotspot de la laptop, PIN de acceso — §8).
- Si algún día hace falta: sincronización a la nube (explícitamente fuera del plan
  original, §8).

## Checklist

- [x] Vista de solo-cocina (`/cocina`, `VistaCocina.tsx`): solo número de orden,
      productos y notas — sin montos ni medio de pago. `BarraNav` le oculta todos
      los demás links y las páginas de dinero (`/pedidos`, `/cuentas`, `/caja/*`,
      `/programados*`) redirigen a `/cocina` si el rol es `cocina`. Probado con
      curl: las 4 redirecciones dan 302 a `/cocina` como se esperaba.
- [x] Imprimir comanda de cocina al cobrar (`POST /api/tickets/comanda`, checkbox
      "Imprimir comanda de cocina" en `PantallaVenta.tsx`, activado por defecto).
      Probado con curl: la comanda sale con la nota de línea ("sin cebolla").
- [x] Reportes: ventas por día, evento, producto, medio de pago y cajero
      (`src/lib/pos/reportes.ts`, `/admin/reportes`). Solo admin — probado que un
      cajero recibe 403 en la API y redirect en la página.
- [x] Exportar reportes a Excel (`exceljs`, `GET /api/admin/reportes-excel`) — un
      libro con 6 hojas (Resumen + los 5 cortes). Probado con curl + verificado que
      el .xlsx trae las 6 hojas.
- [x] Bitácora de auditoría visible en Admin (`/admin/auditoria`) — probado
      anulando una venta y viendo el registro aparecer con el motivo.
- [x] Red local / PIN de acceso: `server.host` ya estaba activo desde Fase 0
      (`astro.config.mjs`). La "pantalla de PIN de acceso" que pide el plan §8 ya
      es, en la práctica, el mismo login por PIN que usa toda la app — cualquier
      tablet que entre a `http://192.168.x.x:4321` pasa por la misma pantalla de
      `/`. No hizo falta una capa de acceso separada.

## Ronda 2 (ajustes nuevos)

- [ ] **"Cocina" en el header para admin (y cocinero).** Hoy `BarraNav.astro` solo le
      muestra el link "Cocina" al rol `cocina`; admin y cajero no lo tienen. Agregar el
      link `/cocina` a la barra de admin (el cocinero ya lo tiene). Decidir si el cajero
      también lo ve — el plan §2 dice que cocina no ve dinero, pero admin/cajero sí
      pueden querer ojear la cola. Cambio de ~1 línea en `src/components/pos/BarraNav.astro`.

## Pendiente / fuera de esta pasada

- [ ] Click-through manual en navegador de `/cocina`, `/admin/reportes` y
      `/admin/auditoria` (se probó todo por API/redirects con curl).
- [ ] El filtro de reportes por evento funciona (`eventoId`), pero no hay pantalla
      para crear/editar eventos — solo se puede asociar uno al abrir caja si ya
      existe un registro en la tabla `eventos` (no construida en ninguna fase).

## Referencias al plan

§2 (cocina no ve dinero), §3.4 (pantalla de cocina opcional), §3.9 Administración,
§3.10 (comanda de cocina), §8 (red local, decisión pendiente #5).
