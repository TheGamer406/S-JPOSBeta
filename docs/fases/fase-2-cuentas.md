# Fase 2 — Cuentas por cobrar completas

> Estimado original: 3–5 días · PLAN_POS_SJ.md §10

## Alcance

- Estado de cuenta y abonos (que entran al cierre), con sus tiquetes.
- Límites de crédito y bloqueo de cliente.
- Reporte de antigüedad de saldos.
- Entradas y salidas de efectivo (movimientos de caja fuera de ventas).

## Checklist

- [ ] Pantalla "Cuentas": buscar cliente → ver estado de cuenta (cargos y abonos,
      saldo actual).
- [ ] Registrar abono (total o parcial, cualquier medio de pago) → genera
      `movimientos_cuenta` tipo `abono` y entra al cierre del día como "ingreso por
      abonos", separado de las ventas (§3.6).
- [ ] Tiquete de abono al registrar (`ticketAbono` ya existe en `src/lib/tickets/`).
- [ ] Tiquete de estado de cuenta a pedido (`ticketEstadoCuenta` ya existe).
- [ ] Aviso al cobrar "a cuenta" si se pasa el límite de crédito del cliente.
- [ ] Estado `bloqueado` impide nuevas ventas a cuenta para ese cliente.
- [ ] Reporte de antigüedad de saldos: quién debe, cuánto y desde cuándo.
- [ ] Movimientos de caja: pantalla para registrar entradas y salidas (hielo, gas,
      pago a ayudante, retiro parcial) con monto, motivo y usuario — tabla
      `movimientos_caja` ya existe en el esquema.
- [ ] Estos movimientos entran en el cálculo de "efectivo esperado" del cierre (§3.8).

## Referencias al plan

§3.6 Clientes y cuentas por cobrar, §3.7 Movimientos de efectivo, §3.8 Cierre de caja.
