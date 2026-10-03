# Fases del POS S&J

Este directorio parte el plan completo (`../../PLAN_POS_SJ.md`) en documentos por fase,
para poder trabajar y dar seguimiento a cada una por separado, como si fueran tickets.

Cada archivo tiene:
- **Alcance**: qué entra en esa fase (copiado/ajustado de PLAN_POS_SJ.md §10).
- **Checklist**: tareas concretas, marcadas `[x]` cuando ya están hechas en el repo.
- **Referencias**: a qué secciones del plan original hay que volver a ver el detalle.
- **Estado**: dónde va la fase hoy.

| Fase | Archivo | Estado |
|---|---|---|
| Fase 0 — Base | [fase-0-base.md](./fase-0-base.md) | 🟢 Completa (probada por API) |
| Fase 1 — MVP para vender en un evento | [fase-1-mvp.md](./fase-1-mvp.md) | 🟡 Backend completo y probado por API; falta click-through en navegador/Electron |
| Fase 2 — Cuentas por cobrar completas | [fase-2-cuentas.md](./fase-2-cuentas.md) | 🟡 Backend y API completos y probados; falta click-through en navegador |
| Fase 3 — Pedidos programados de empresas | [fase-3-programados.md](./fase-3-programados.md) | 🟡 Backend y API completos y probados; falta click-through en navegador |
| Fase 4 — Extras | [fase-4-extras.md](./fase-4-extras.md) | 🟡 Completa y probada por API; falta click-through + ajuste "Cocina en header" (ronda 2) |
| Versión 2 — Comprobantes electrónicos | [version-2-hacienda.md](./version-2-hacienda.md) | ⚪ Futuro, fuera de alcance de v1 |

No se vende nada en producción hasta que la Fase 1 esté completa y probada con el
checklist de PLAN_POS_SJ.md §11.

## Ronda 2 — ajustes pedidos después de la primera pasada

Trabajo nuevo que surge de revisar el POS ya armado. Son fases para **repasar juntas**
antes de implementar; cada doc deja marcadas sus decisiones pendientes.

| Fase | Archivo | Estado |
|---|---|---|
| Fase 5 — Empaquetado en Docker (Linux + Windows 11) ⭐ | [fase-5-docker.md](./fase-5-docker.md) | 🟡 Imagen + compose + lanzadores listos y probados en Linux; puente de impresión de Windows escrito pero sin probar en esa laptop |
| Fase 6 — Comprobantes: descargar o saltar | [fase-6-comprobantes.md](./fase-6-comprobantes.md) | 🔵 Planeada — hoy ningún tiquete se descarga; despacho de programado no emite comprobante |
| Fase 7 — Cobro unificado (Cuentas y Programados como Ventas) | [fase-7-cobro-unificado.md](./fase-7-cobro-unificado.md) | 🔵 Planeada — 3 modales de pago reimplementados por separado; unificar en uno con pago dividido |

Además, el ajuste "**Cocina en el header para admin**" quedó anotado dentro de la
[Fase 4](./fase-4-extras.md) por ser un cambio de navegación de ~1 línea.
