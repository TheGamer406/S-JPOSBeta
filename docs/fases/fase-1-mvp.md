# Fase 1 — MVP para vender en un evento ⭐

> Estimado original: 1–2 semanas · PLAN_POS_SJ.md §10 · con esta fase ya se puede
> trabajar un evento completo.

## Alcance

- Apertura de caja con fondo.
- Pantalla de venta: cuadrícula, carrito, notas, agotado.
- Cobro: efectivo con vuelto, SINPE, BAC, BN y pago dividido.
- A cuenta con clientes registrados y numeración `S&J0001`.
- Cola de pedidos: pendiente → listo → entregado.
- Anulación con PIN de admin.
- Cierre de caja con conteo por denominación, verificación de SINPE, lotes de
  datáfono y reporte imprimible.
- Clientes con nombre + cédula + `S&J000X`.
- Impresión en Epson: tiquete de venta, apertura de cuenta y cargo a cuenta con firma.

## Checklist

### Venta y cobro
- [ ] Pantalla de apertura de caja: fondo inicial, tipo de cambio del día, evento opcional.
- [ ] Bloqueo total de venta sin caja abierta.
- [ ] Cuadrícula de productos por categoría + carrito (+/–, nota por línea).
- [ ] Botón de "producto agotado".
- [ ] Nombre de cliente / n.º de mesa opcional en la venta.
- [ ] Número de orden del día (#001, #002…) reiniciado cada día de sesión.
- [ ] Modal de cobro: efectivo ₡ con vuelto y botones rápidos (Exacto, ₡10 000, ₡20 000).
- [ ] Efectivo $ (solo billetes) convertido con el TC del día, vuelto siempre en ₡,
      redondeado a múltiplos de ₡10 (`src/lib/dinero.ts` ya tiene las funciones).
- [ ] SINPE Móvil con comprobante → queda "por verificar".
- [ ] Datáfono BAC / BN con n.º de autorización.
- [ ] A cuenta: buscar cliente por nombre/cédula/n.º de cuenta, crear cliente al vuelo,
      aviso de límite de crédito.
- [ ] Pago dividido (varios métodos hasta completar el total).
- [ ] Protección contra doble toque (`idempotency_key`, ya está en el esquema).
- [ ] Imprimir tiquete de venta al confirmar (usar `emitirTicket` de
      `src/lib/tickets/index.ts`, que ya cae a vista previa en pantalla si no hay
      impresora o no hay papel — ver `/tickets-demo` para ver el diseño ahora mismo).

### Pedidos
- [ ] Cola con estados `pendiente → preparacion → listo → entregado` (y `anulado`).
- [ ] Vista con filtros (Pendientes · Listos · Entregados · Todos) y alerta de tiempo.
- [ ] Anulación con motivo + PIN de admin (`permisos.ts` ya marca qué acciones lo piden).

### Cierre de caja
- [ ] Conteo por denominación (₡ y $ por separado, nunca mezclados).
- [ ] Verificación manual de SINPEs.
- [ ] Ingreso de lotes BAC/BN y cálculo de diferencias.
- [ ] Reporte de cierre imprimible (tiquete resumido con `ticketCierre` + PDF completo).

### Clientes
- [ ] Alta de cliente con nombre + cédula (validación de formato física/jurídica/DIMEX)
      + número de cuenta automático `S&J000X`.
- [ ] Aviso si la cédula ya existe (mostrar la cuenta existente, no duplicar).
- [ ] Tiquete de apertura de cuenta con firma, 2 copias (`ticketAperturaCuenta` ya existe).
- [ ] Tiquete de cargo a cuenta con firma, 2 copias (`ticketCargoCuenta` ya existe).

## Ya construido en Fase 0 que esta fase reutiliza

- `src/lib/dinero.ts` — vuelto en ₡ y en $, redondeo a múltiplos de ₡10.
- `src/lib/permisos.ts` — qué acciones piden PIN de admin.
- `src/lib/tickets/` — plantillas + impresión ESC/POS + vista previa HTML.
- `src/db/schema.ts` y `src/db/contadores.ts` — tablas y consecutivos ya listos.

## Decisión pendiente antes de imprimir de verdad

PLAN_POS_SJ.md §8, tabla de "Decisiones pendientes", punto 4: falta confirmar el
**modelo de la Epson**, si es **USB o red**, el **ancho de papel** (80/58 mm) y si tiene
**gaveta**. Hasta no tener la impresora (y el papel) a la mano, usar siempre
`/tickets-demo` o `emitirTicket(ticket, null)` para ver el diseño en pantalla.

## Referencias al plan

§3.1–§3.3, §3.4, §3.6, §3.8, §3.10, §6 (riesgos), §11 (checklist de pruebas antes del
primer evento — correrlo completo antes de usar esto en un evento real).
