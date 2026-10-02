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

- [ ] Vista de solo-cocina (reutiliza `puedeVerCola` / bloquea `puedeVerDinero` de
      `src/lib/permisos.ts`).
- [ ] Imprimir comanda de cocina al cobrar (opcional, configurable).
- [ ] Reportes: ventas por día, evento, producto, medio de pago y cajero.
- [ ] Exportar reportes a Excel.
- [ ] Activar `server.host` en red local (ya configurado en `astro.config.mjs`) +
      pantalla de PIN de acceso para dispositivos conectados al hotspot.
- [ ] Bitácora de auditoría visible en Admin (tabla `auditoria` ya existe).

## Referencias al plan

§3.4 (pantalla de cocina opcional), §3.9 Administración, §3.10 (comanda de cocina),
§8 (red local, decisión pendiente #5).
