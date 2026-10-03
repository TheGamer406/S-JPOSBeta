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

- [ ] Extraer `SelectorPago` compartido desde `ModalCobro` (métodos, atajos ₡/$,
      referencia, a cuenta, pago dividido opcional). Un solo lugar para la lógica de
      vuelto, mínimos y validación de "falta/sobra".
- [ ] `ModalCobro` (ventas) pasa a consumir el componente compartido (sin cambio de UX).
- [ ] `ModalAbono` (cuentas) consume el componente compartido: habilitar **pago
      dividido** del abono; mantener el preview de vuelto.
- [ ] `ModalGestionProgramado` consume el componente compartido para la parte de cobro:
      habilitar **pago dividido**; alinear los atajos de `contra_entrega` (hoy inputs
      sueltos, ver Fase 3) con los de ventas.
- [ ] **Programados emite comprobante** al despachar (tiquete de venta o de cargo a
      cuenta según el pago), con imprimir / descargar / saltar (enlaza con Fase 6).
      Requiere que `/api/programados/despachar` devuelva el `ventaId`/`pagoId` para
      disparar el tiquete, igual que `/api/ventas`.
- [ ] Revisar que el aviso de **límite de crédito** (`saldoCliente.pasaLimite`) se
      muestre también al cargar un programado a cuenta, como ya se hace en ventas.

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
