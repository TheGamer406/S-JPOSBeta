# Fase 7 — Cobro unificado: Cuentas y Programados como Ventas

> Ronda 2. Objetivo: que **cuentas por cobrar** y **pedidos programados** cobren
> igual o muy parecido a una venta de mostrador — mismos botones, mismos atajos,
> mismo comprobante. Hoy cada pantalla reimplementa su propio modal de pago y divergen.
> PLAN_POS_SJ.md §3.1–§3.3 (cobro), §3.5 (programados), §3.6 (cuentas).

## Qué encontramos al revisar (estado real)

Los tres flujos reimplementan por separado la selección de método de pago y los atajos
de efectivo/billetes $:

| | Modal | Pago dividido | Métodos | Atajos ₡/$ | Comprobante al cobrar |
|---|---|---|---|---|---|
| **Ventas** | `ModalCobro` | ✅ sí (varios medios hasta el total) | todos + a cuenta | ✅ | ✅ venta / cargo (saltable) |
| **Cuentas (abono)** | `ModalAbono` | ❌ un solo medio | efectivo/$, sinpe, datáfonos | ✅ | ✅ abono (saltable) |
| **Programados** | `ModalGestionProgramado` | ❌ un solo medio | todos + a cuenta | ✅ | ❌ **ninguno** |

Divergencias concretas a cerrar:
- **Pago dividido** existe solo en ventas. Un programado grande o un abono fuerte
  podrían pagarse en dos medios y hoy no se puede.
- **Programados no emite comprobante** tras `POST /api/programados/despachar` (el modal
  solo hace `onListo()`), aunque es una venta real. Hueco frente a ventas (también en
  Fase 6).
- Tres implementaciones paralelas de lo mismo = tres lugares donde arreglar un bug de
  cobro. El comentario en `ModalAbono` ya dice "se cobra igual que una venta" — conviene
  que sea literalmente el mismo componente.

## Enfoque propuesto: un componente de cobro compartido

Extraer el núcleo de pago de `ModalCobro` a un componente reutilizable (p. ej.
`SelectorPago` / `PanelCobro`) que maneje: lista de métodos, atajos de efectivo ₡
(Exacto/₡10k/₡20k) y billetes $, referencia de SINPE/datáfono, "a cuenta" con
`BuscadorCliente`, y **pago dividido opcional** (acumular pagos hasta el total). Luego:

- **Ventas** lo usan tal cual (es de donde sale).
- **Abono (cuentas)** lo usa con el total = monto a abonar; sin la opción "a cuenta"
  (no tiene sentido abonar una cuenta cargándola a otra), con split habilitado.
- **Programados** lo usan para cobrar lo que se saca del plan + adicionales, con la
  opción "a cuenta" (modo `contra_entrega` vs `cuenta`), con split habilitado.

## Checklist

- [x] Extraído `SelectorPago` compartido (`src/components/pos/SelectorPago.tsx`):
      métodos, atajos ₡/$, referencia, a cuenta (con `BuscadorCliente` embebido o con
      `cuentaFija` cuando el cliente ya se conoce de antemano) y pago dividido —
      acumula pagos hasta completar el total, un solo lugar para la lógica.
- [x] `ModalCobro` (ventas) consume el componente compartido — sin cambio de UX,
      confirmado por click-through (venta simple, dividida, y a cuenta con cliente
      nuevo vía `BuscadorCliente` embebido).
- [x] `ModalAbono` (cuentas) consume el componente compartido con **pago dividido**
      real: el backend (`registrarAbono`, `esquemaRegistrarAbono`) pasó de aceptar un
      solo método a una lista `pagos[]`, insertando un `pago` + un `movimientoCuenta`
      "abono" por cada medio usado. El tiquete de abono (`ticketAbono`) ahora lista
      todos los medios usados en una sola emisión (`/api/tickets/abono` recibe
      `pagoIds[]`, ya no un solo `pagoId`).
- [x] `ModalGestionProgramado` consume el componente compartido con **pago dividido**
      y **a cuenta con `cuentaFija`** (el cliente del pedido, sin buscador — ya se sabe
      de quién es). Backend (`despacharDeProgramado`, `esquemaDespacharProgramado`)
      pasó de un solo `pago` a `pagos[]`, reusando `esquemaPago` (el mismo de ventas) y
      la misma validación "lo pagado debe sumar exacto el total" que ya tenía
      `crearVenta`.
- [x] Programados ya emite comprobante al despachar (Fase 6) — con el cambio a
      `pagos[]`, `estadoPago` se calcula igual que en ventas (`pagada`/`a_cuenta`/
      `parcial`), así que `/api/tickets/venta` elige solo el tiquete correcto
      (venta o cargo a cuenta) sin tocarla.
- [x] Aviso de **límite de crédito** en programados: `despacharDeProgramado` ahora
      calcula `saldoCliente.pasaLimite` igual que `crearVenta`, y
      `ModalGestionProgramado` lo muestra junto al tiquete. No se pudo disparar en la
      prueba porque no hay UI todavía para poner un límite de crédito al cliente (el
      cálculo en sí está verificado por código, espejo exacto del de ventas).

Probado con Playwright contra la imagen Docker: venta con split (efectivo + SINPE),
venta a cuenta con cliente nuevo, despacho de programado con split (efectivo parcial +
resto a cuenta — el saldo de la cuenta quedó exacto), abono dividido (SINPE + efectivo,
tiquete con ambos medios, saldo recalculado exacto). Cero errores de JS.

## Cuidado al refactorizar
- No romper el `idempotencyKey` (protección de doble toque) que ya traen `ModalCobro` y
  `ModalGestionProgramado`.
- `ModalGestionProgramado` mezcla **gestión de entrega** (sacar cantidades del plan +
  adicionales) con **cobro**. Solo se unifica la parte de cobro; la de entrega es propia
  de programados y se queda.
- Verificar por API (curl) cada flujo después del refactor, como en las fases 1–3, y
  luego el click-through en navegador.

## Referencias al plan

§3.1–§3.3 (venta y cobro), §3.5 (programados, entregas parciales), §3.6 (abonos entran
al cierre). Código: `src/components/pos/{ModalCobro,ModalAbono,ModalGestionProgramado,
PantallaVenta,PantallaCuentas,ColaProgramados}.tsx`, `src/pages/api/{ventas,
programados/despachar,clientes/[id]/abono}.ts`.
