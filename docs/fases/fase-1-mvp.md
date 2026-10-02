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
- [x] Pantalla de apertura de caja: fondo inicial, tipo de cambio del día
      (`src/pages/caja/abrir.astro`, `src/lib/pos/caja.ts`). Evento opcional soportado
      en el esquema/API pero sin selector en la UI todavía (no hay pantalla de eventos).
- [x] Bloqueo total de venta sin caja abierta (`POST /api/ventas` → 409 sin sesión;
      `vender.astro` redirige a `/caja/abrir`). Probado con curl.
- [x] Cuadrícula de productos por categoría + carrito (+/–, nota por línea)
      (`PantallaVenta.tsx`).
- [x] Botón de "producto agotado" (toggle por producto, `PATCH /api/productos/agotado`).
- [x] Nombre de cliente / n.º de mesa opcional en la venta (`nombreReferencia`).
- [x] Número de orden del día (#001, #002…) reiniciado al abrir cada sesión
      (`siguienteNumeroOrdenDia`). Probado con curl.
- [x] Modal de cobro: efectivo ₡ con vuelto y botones rápidos (Exacto, ₡10 000, ₡20 000)
      (`ModalCobro.tsx`).
- [x] Efectivo $ (solo billetes) convertido con el TC del día, vuelto siempre en ₡,
      redondeado a múltiplos de ₡10 (`src/lib/dinero.ts`, botones de billete en `ModalCobro.tsx`).
- [x] SINPE Móvil con comprobante → queda "por verificar" (`pagos.verificado = false`
      para `sinpe`, confirmado con curl).
- [x] Datáfono BAC / BN con n.º de autorización (opcional).
- [x] A cuenta: buscar cliente por nombre/cédula/n.º de cuenta, crear cliente al vuelo
      (`BuscadorCliente.tsx`). Aviso de límite de crédito calculado en `crearVenta`
      (`saldoCliente.pasaLimite`), falta mostrarlo de forma visible en el modal (hoy
      solo viaja en la respuesta de la API, no hay alerta en pantalla).
- [x] Pago dividido (varios métodos hasta completar el total) — probado con curl:
      SINPE ₡5 000 + efectivo ₡6 200 sobre un total de ₡11 200.
- [x] Protección contra doble toque (`idempotency_key`): probado reenviando la misma
      venta dos veces — devuelve la misma venta, no duplica.
- [x] Imprimir tiquete de venta al confirmar (`POST /api/tickets/venta`, cae a vista
      previa en pantalla porque no hay impresora configurada — probado con curl y en
      `/tickets-demo`).

### Pedidos
- [x] Cola con estados `pendiente → preparacion → listo → entregado` (y `anulado`)
      (`ColaPedidos.tsx`, `POST /api/pedidos/estado`). Probado con curl, las 3 transiciones.
- [x] Vista con filtros (Pendientes · Listos · Entregados · Todos) y alerta de tiempo
      (`ColaPedidos.tsx`, tarjeta en rojo pasados `MINUTOS_ALERTA`).
- [x] Anulación con motivo + PIN de admin (`POST /api/pedidos/anular`): probado con PIN
      incorrecto (401) y correcto (200); revierte el cargo a cuenta con un movimiento
      de ajuste y excluye los pagos del cierre.

### Cierre de caja
- [x] Conteo por denominación (₡ y $ por separado, nunca mezclados)
      (`FormularioCierre.tsx`, billetes/monedas de §3.8).
- [ ] Verificación manual de SINPEs: el campo `verificado` existe y se puede marcar por
      API, pero no hay botón en la UI de cierre para tildarlos uno por uno todavía.
- [x] Ingreso de lotes BAC/BN y cálculo de diferencias (`calcularCierre`, probado con curl:
      fondo ₡30 000 + 0 efectivo válido − 0 + 0 = esperado ₡30 000 vs. contado ₡33 800 →
      diferencia ₡3 800).
- [x] Reporte de cierre imprimible (tiquete resumido con `ticketCierre` vía
      `POST /api/tickets/cierre`). El PDF completo (mencionado en §3.8) no está hecho —
      por ahora solo existe la versión tiquete/pantalla.

### Clientes
- [x] Alta de cliente con nombre + cédula (validación de formato física/jurídica/DIMEX)
      + número de cuenta automático `S&J000X` (`src/lib/pos/clientes.ts`). Probado con
      curl: cédula jurídica válida, cédula corta rechazada (400).
- [x] Aviso si la cédula ya existe (mostrar la cuenta existente, no duplicar): probado
      con curl, devuelve 409 + el cliente existente.
- [x] Tiquete de apertura de cuenta con firma, 2 copias (`ticketAperturaCuenta`,
      disparado automáticamente al crear cliente desde `BuscadorCliente.tsx`).
- [x] Tiquete de cargo a cuenta con firma, 2 copias (`ticketCargoCuenta`, se usa en vez
      del tiquete de venta normal cuando `estadoPago` es `a_cuenta` o `parcial`).

### Pendiente / fuera de esta pasada
- [ ] Selector de evento en la apertura de caja (el campo existe, falta la pantalla).
- [ ] Botón para marcar un SINPE como verificado desde la pantalla de cierre.
- [ ] PDF completo del cierre (hoy solo hay tiquete/preview).
- [ ] Mostrar en el modal de cobro el aviso de "pasa el límite de crédito" que ya
      calcula el backend.
- [ ] Probar en un navegador real con clicks (esta pasada se probó el backend completo
      por API con curl y se revisó el código de los componentes; falta un click-through
      manual en Electron/navegador antes de usar esto en un evento real — ver §11).

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
