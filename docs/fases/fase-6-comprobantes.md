# Fase 6 — Comprobantes: todos imprimibles o saltables

> Ronda 2. Objetivo: repasar **absolutamente todas** las partes de la app que ofrecen
> un comprobante/tiquete y garantizar que cada una se pueda **imprimir o saltar** —
> nunca que se dispare sola sin preguntar, ni que bloquee el flujo. **Decisión del
> usuario (2026-10-03): nada de guardar/descargar — solo imprimir o saltar.**
> PLAN_POS_SJ.md §3.10, §6 ("el tiquete se guarda siempre en el sistema y se puede
> reimprimir; si la impresora falla, se muestra en pantalla y se avisa").

## Inventario de comprobantes (estado real antes de esta fase)

Todos pasan por `emitirTicket()` (`src/lib/tickets/index.ts`): si hay impresora,
imprime; si no, cae a vista previa HTML en pantalla (`VistaPreviaTicket`).

| Comprobante | Origen | ¿Imprimir o saltar hoy? |
|---|---|---|
| Tiquete de venta | `PantallaVenta` → `ConfirmarImpresion` | ✅ sí |
| Cargo a cuenta | mismo flujo (venta a cuenta/parcial) | ✅ sí |
| Comanda de cocina | checkbox antes de cobrar en `PantallaVenta` | ✅ sí (se decide antes, no después) |
| Apertura de cuenta | `BuscadorCliente` → `ConfirmarImpresion` | ✅ sí |
| Abono | `PantallaCuentas` → `ConfirmarImpresion` | ✅ sí |
| Estado de cuenta | botón a pedido en `PantallaCuentas` | ✅ sí (opt-in, no hace falta preguntar) |
| **Tiquete de cierre** | `FormularioCierre.cerrar()` | ❌ **se dispara solo, sin preguntar** |
| **Despacho de programado** | `ModalGestionProgramado.despachar()` | ❌ **no emite ningún comprobante** |

## Checklist

- [x] **Tiquete de cierre**: agregar el mismo paso `ConfirmarImpresion` que ya usan
      venta/abono/apertura, en vez de llamar a `/api/tickets/cierre` automáticamente
      al confirmar el cierre (`FormularioCierre.tsx`).
- [x] **Despacho de programado emite comprobante**: `despacharDeProgramado` ya crea
      una `venta` real (`tipo: 'mostrador'`), así que `/api/tickets/venta` funciona
      sin tocarla — solo faltaba conectarlo desde `ModalGestionProgramado.tsx`, con el
      mismo patrón imprimir/saltar que `PantallaVenta` (tiquete de venta o de cargo a
      cuenta según el método de pago usado).
- [x] Confirmar que ningún comprobante quedó con descarga de archivo — por decisión
      explícita, se revierte cualquier intento de agregar "Descargar" (los 2 PDFs de
      gestión — cierre completo y hoja de despacho — no son "comprobantes" en este
      sentido y se quedan como están, son reportes internos, no tiquetes de cliente).

## Referencias al plan

§3.10 (tiquetes y comanda), §6 (nunca se pierde un tiquete; se puede reimprimir).
Código: `src/components/pos/{ConfirmarImpresion,VistaPreviaTicket,FormularioCierre,
ModalGestionProgramado,PantallaVenta}.tsx`, `src/pages/api/tickets/{venta,cierre}.ts`,
`src/lib/pos/programados.ts` (`despacharDeProgramado`).
