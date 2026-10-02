# Fase 2 — Cuentas por cobrar completas

> Estimado original: 3–5 días · PLAN_POS_SJ.md §10

## Alcance

- Estado de cuenta y abonos (que entran al cierre), con sus tiquetes.
- Límites de crédito y bloqueo de cliente.
- Reporte de antigüedad de saldos.
- Entradas y salidas de efectivo (movimientos de caja fuera de ventas).

## Checklist

- [x] Pantalla "Cuentas": buscar cliente → ver estado de cuenta (cargos y abonos,
      saldo actual) (`/cuentas`, `PantallaCuentas.tsx`).
- [x] Registrar abono (cualquier medio de pago) → genera `movimientos_cuenta` tipo
      `abono` y entra al cierre del día como "ABONOS A CUENTAS RECIBIDOS", separado
      de "TOTAL VENDIDO" (§3.6). Probado con curl: abono de ₡5 000 sobre una deuda de
      ₡12 300 → saldo nuevo ₡7 300, y el cierre muestra ambos totales por separado.
- [x] Tiquete de abono al registrar (`POST /api/tickets/abono`, dispara solo al
      confirmar desde `PantallaCuentas.tsx`).
- [x] Tiquete de estado de cuenta a pedido (`POST /api/tickets/estado-cuenta`, botón
      "Imprimir estado de cuenta").
- [x] Aviso al cobrar "a cuenta" si se pasa el límite de crédito del cliente: el
      backend ya lo calculaba desde Fase 1 (`saldoCliente.pasaLimite`); ahora se
      muestra en el modal de cobro (vía `ModalCobro` → `PantallaVenta`) y en la
      pantalla de Cuentas. Probado con curl con un cliente con límite ₡5 000 y una
      venta de ₡12 300 a cuenta → `pasaLimite: true`.
- [x] Estado `bloqueado` impide nuevas ventas a cuenta para ese cliente (ya estaba
      en `crearVenta` desde Fase 1, sin cambios).
- [x] Reporte de antigüedad de saldos: quién debe, cuánto y desde cuándo
      (`GET /api/clientes/antiguedad`, tarjeta "Ver antigüedad de saldos" en
      `/cuentas`). La fecha es la del cargo más antiguo del cliente — no es un FIFO
      exacto contra abonos parciales, pero alcanza para priorizar cobros.
- [x] Movimientos de caja: pantalla para registrar entradas y salidas (hielo, gas,
      pago a ayudante, retiro parcial) con monto, motivo y usuario
      (`/caja/movimientos`, `FormularioMovimientoCaja.tsx`).
- [x] Estos movimientos entran en el cálculo de "efectivo esperado" del cierre
      (§3.8) — ya estaba cableado en `calcularCierre` desde que se escribió en
      Fase 1; faltaba el endpoint para crearlos. Probado con curl: salida de
      ₡12 500 (hielo y gas) → efectivo esperado bajó exactamente esa cantidad.

### Bug encontrado y corregido durante esta fase

`calcularCierre` sumaba los pagos de abono (`venta_id = null`) junto con los de
venta en "TOTAL VENDIDO" y en el desglose por medio — el reporte del §3.8 los pide
separados ("TOTAL VENDIDO" vs. "ABONOS A CUENTAS RECIBIDOS"), porque un abono no es
una venta nueva. Se separó en `src/lib/pos/caja.ts` (filtra por `ventaId !== null`
para armar "VENTAS" y usa todos los pagos solo para el efectivo físico esperado) y
se propagó a `reporteCierre.ts`, `pdfCierre.ts`, `ticketCierre` y la UI de cierre.

## Pendiente / fuera de esta pasada

- [ ] Click-through manual en navegador real de `/cuentas` y `/caja/movimientos`
      (se probó todo por API con curl, igual que en Fase 1).
- [ ] La antigüedad de saldos usa el cargo más antiguo, no un FIFO exacto que vaya
      descontando abonos cargo por cargo — suficiente para el MVP, revisar si algún
      día se necesita precisión contable real.

## Referencias al plan

§3.6 Clientes y cuentas por cobrar, §3.7 Movimientos de efectivo, §3.8 Cierre de caja.
