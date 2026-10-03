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
- [x] Estado "en espera" (ej. el cliente se fue un rato) + prioridad al reanudar:
      no es parte del flujo normal de `estado_pedido` (no se pierde el progreso que
      ya tenía la cocina) sino un flag aparte (`ventas.en_espera`), con un segundo
      flag `prioridad` que se activa solo al salir de espera. Lo cambia el cajero
      (`POST /api/pedidos/espera`); la cocina solo lo ve (atenuado y al fondo de la
      cola si está en espera, con un tag dorado "⭐ PRIORIDAD" al volver). Probado
      con curl: entra en espera sin cambiar `estadoPedido`, al reanudar queda
      `prioridad=true`, y no se puede poner en espera un pedido ya entregado.
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
      `POST /api/tickets/cierre`) y PDF completo con desglose de productos vendidos
      (`src/lib/pos/pdfCierre.ts`, `GET /api/caja/reporte-pdf`).
- [x] Respaldo automático en cada cierre (§8): copia de `sj-pos.db` + PDF del cierre
      en `~/Documents/SJ-POS/respaldos/`, sin depender de que alguien le dé clic a
      "descargar" (`src/lib/pos/respaldos.ts`). Probado con curl: el `.db` copiado
      tiene los 15 productos del seed y el PDF abre con `pdftotext`.

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
- [x] Mostrar en el modal de cobro el aviso de "pasa el límite de crédito" —
      resuelto en Fase 2 (`ModalCobro.tsx` → `PantallaVenta.tsx`).
- [x] **Click-through real en navegador (Ronda 2, 2026-10-03).** Probado con Playwright
      contra la imagen Docker (equivalente a producción, no `npm run dev`): login PIN,
      abrir caja, cuadrícula + carrito + nota por línea, marcar/desmarcar agotado, cobro
      en efectivo exacto, pago dividido (efectivo + SINPE), venta a cuenta creando
      cliente al vuelo, cola de pedidos (pendiente→preparación→listo→entregado),
      anulación con PIN incorrecto (rechazada) y correcto (aceptada), cierre de caja con
      conteo por denominación, diferencia ₡0, descarga de PDF y respaldo automático.
      Sin errores de JS en consola. Dos bugs reales encontrados y corregidos (solo
      visibles en navegador/producción, no por curl):
      - **Minutos "tardío" negativos**: `CURRENT_TIMESTAMP` de SQLite no lleva zona
        horaria; el navegador lo interpretaba como hora local y en Costa Rica (UTC-6)
        los pedidos mostraban "-357 min" — la alerta de pedido tardío (§3.4) nunca
        hubiera disparado en un evento real. Corregido con `src/lib/fecha.ts`
        (`epochDeFechaSqlite`), usado en `ColaPedidos.tsx` y `VistaCocina.tsx`.
      - **PDF del cierre crasheaba 500 en el build de producción**: la fuente
        `assets/fonts/NotoSans-Regular.ttf` no se copiaba al contenedor Docker — ver
        Fase 5. Corregido agregando `assets/` al `Dockerfile`.

## Ya construido en Fase 0 que esta fase reutiliza

- `src/lib/dinero.ts` — vuelto en ₡ y en $, redondeo a múltiplos de ₡10.
- `src/lib/permisos.ts` — qué acciones piden PIN de admin.
- `src/lib/tickets/` — plantillas + impresión ESC/POS + vista previa HTML.
- `src/db/schema.ts` y `src/db/contadores.ts` — tablas y consecutivos ya listos.

## Decisión del §8, punto 4 — ya resuelta

No es una Epson: es una **AON, por USB, papel de 80 mm**. No importa — ambas hablan
ESC/POS, que es lo que ya implementa `src/lib/tickets/printer.ts`. Probado con la
impresora física conectada:

- En Linux aparece como `/dev/usb/lp0`; el usuario que corre la app necesita estar
  en el grupo `lp` del sistema (`sudo usermod -aG lp "$USER"`, requiere volver a
  iniciar sesión).
- `obtenerConfigImpresora()` (`src/lib/pos/configuracionImpresora.ts`) lee
  `SJ_POS_IMPRESORA_INTERFAZ` / `_ANCHO` / `_GAVETA` de variables de entorno — ver
  README. Las 6 rutas de tiquetes (`venta`, `comanda`, `apertura-cuenta`, `abono`,
  `estado-cuenta`, `cierre`) ya la usan en vez de pasar `null` a mano.
- Probado con curl: `POST /api/tickets/venta` con `SJ_POS_IMPRESORA_INTERFAZ=/dev/usb/lp0`
  devolvió `{"impreso": true}` y el tiquete salió físicamente en la impresora
  (confirmado por el usuario: encabezado, producto, total, vuelto y corte de papel).
- **No probado todavía**: la gaveta de dinero (si la tiene conectada) y el ancho
  real de 58 mm (se asume 80 mm porque es lo que confirmó el usuario).
- Sin la variable de entorno configurada (como en cualquier otra máquina sin la
  impresora a mano), `emitirTicket()` sigue cayendo sola a la vista previa en
  pantalla — se puede seguir usando `/tickets-demo` para ver el diseño.

## Referencias al plan

§3.1–§3.3, §3.4, §3.6, §3.8, §3.10, §6 (riesgos), §11 (checklist de pruebas antes del
primer evento — correrlo completo antes de usar esto en un evento real).
