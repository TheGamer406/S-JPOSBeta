# Fase 6 — Comprobantes: descargar o saltar en todos lados

> Ronda 2. Objetivo: repasar **absolutamente todas** las partes de la app que ofrecen
> un comprobante/tiquete y garantizar que cada una se pueda **descargar** (archivo) o
> **saltar** — nunca que obliguen a imprimir ni que se pierdan. PLAN_POS_SJ.md §3.10,
> §6 ("el tiquete se guarda siempre y se puede reimprimir; si la impresora falla, se
> muestra en pantalla y se avisa").

## Inventario de comprobantes hoy (punto de partida real)

Todos los tiquetes pasan por `emitirTicket()` (`src/lib/tickets/index.ts`): si hay
impresora, imprime; si no, cae a **vista previa HTML en pantalla** (`VistaPreviaTicket`).
Ninguno se puede **guardar como archivo** todavía.

| Comprobante | Endpoint / origen | ¿Se puede saltar hoy? | ¿Se puede descargar hoy? |
|---|---|---|---|
| Tiquete de venta | `/api/tickets/venta` (`ConfirmarImpresion` en `PantallaVenta`) | ✅ sí (botón Saltar) | ❌ no (solo preview) |
| Cargo a cuenta | `/api/tickets/venta` cuando es a cuenta/parcial | ✅ sí | ❌ no |
| Comanda de cocina | `/api/tickets/comanda` (checkbox en `PantallaVenta`) | ✅ sí (desmarcar) | ❌ no (interna) |
| Apertura de cuenta | `/api/tickets/apertura-cuenta` (`ConfirmarImpresion` en `BuscadorCliente`) | ✅ sí | ❌ no |
| Abono | `/api/tickets/abono` (`ConfirmarImpresion` en `PantallaCuentas`) | ✅ sí | ❌ no |
| Estado de cuenta | `/api/tickets/estado-cuenta` (botón a pedido) | ✅ sí (es a pedido) | ❌ no |
| Tiquete de cierre | `/api/tickets/cierre` (`FormularioCierre`) | ⚠️ revisar | ❌ no (hay PDF aparte) |
| **PDF de cierre** | `/api/caja/reporte-pdf` | — | ✅ sí (`attachment`) |
| **Hoja de despacho** | `/api/programados/despacho-pdf` | — | ✅ sí (`attachment`) |
| **Despacho de programado** | `/api/programados/despachar` | — | ❌ **no emite comprobante** |

### Lo que falta (resumen)
- **Descargar**: ningún tiquete tipo recibo se puede bajar como archivo. Solo existen
  los 2 PDFs grandes (cierre, despacho), que no son el "tiquete del cliente".
- **Despacho de programado no emite comprobante** — hueco frente a ventas (se cubre
  aquí y en la Fase 7).
- **Tiquete de cierre**: confirmar que `FormularioCierre` deja saltarlo explícitamente.

## Checklist

### Descargar cualquier tiquete (un solo punto para todos)
- [ ] Añadir botón **"Descargar"** en `VistaPreviaTicket` (y/o junto a cada
      `ConfirmarImpresion`). Como todos los tiquetes pasan por `emitirTicket`, basta un
      solo chokepoint: generar un archivo descargable a partir del modelo `Ticket`.
- [ ] Decidir formato de descarga: **PDF** (reusar `pdfkit`, ya está en el proyecto por
      `pdfCierre`/`pdfDespacho`) para que abra/imprima en cualquier lado. Alternativa
      liviana: descargar el HTML del preview. Recomendación: PDF, ancho de tiquete
      (58/80 mm) para que se vea como el papel.
- [ ] Endpoint o helper `ticket → PDF` que reciba el mismo `Ticket` y devuelva
      `application/pdf` con `Content-Disposition: attachment` (mismo patrón que
      `reporte-pdf.ts`). Nombre de archivo con tipo + consecutivo/fecha.

### Saltar en todos lados (cerrar los que falten)
- [ ] Verificar/garantizar que **cada** disparo de tiquete tenga una salida sin
      imprimir: venta ✅, cargo ✅, comanda ✅, apertura ✅, abono ✅, estado de cuenta ✅
      (a pedido), **cierre ⚠️ revisar `FormularioCierre`**.
- [ ] Donde el tiquete se dispara "automático" (p. ej. apertura al crear cliente), que
      la opción de saltar quede siempre visible — ya lo hace `BuscadorCliente`, revisar
      que no haya ningún disparo forzado sin `ConfirmarImpresion`.

### Programados (enlaza con Fase 7)
- [ ] El despacho de un programado debe emitir su comprobante (tiquete de venta o cargo
      a cuenta, según cómo se cobró), con las mismas opciones imprimir / descargar /
      saltar que una venta de mostrador.

## Referencias al plan

§3.10 (tiquetes y comanda), §6 (nunca se pierde un tiquete; se puede reimprimir).
Código: `src/lib/tickets/` (`index.ts`, `templates.ts`, `preview.ts`, `printer.ts`),
`src/components/pos/{ConfirmarImpresion,VistaPreviaTicket}.tsx`,
`src/lib/pos/{pdfCierre,pdfDespacho}.ts`, `src/pages/api/caja/reporte-pdf.ts` (patrón de
descarga).
