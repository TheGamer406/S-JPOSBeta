# Versión 2 — Comprobantes electrónicos

> PLAN_POS_SJ.md §10 y §6. Fuera de alcance de la v1 — **decisión ya tomada**
> (§8, decisión pendiente #3: "✅ Decidido: versión 2").

## Alcance

- Facturas y tiquetes electrónicos de Hacienda, por medio de un proveedor autorizado.
- Usa la cédula que ya se guarda de cada cliente desde la Fase 1 (`clientes.cedula`),
  para poder facturar a nombre del cliente sin pedir el dato otra vez.

## Por qué no entra antes

Un tiquete interno **no es un comprobante fiscal**. La v1 imprime tiquetes internos
rotulados explícitamente como tales (`PIE_LEGAL` en
`src/lib/tickets/tipos.ts`: *"Tiquete interno - no es comprobante electrónico"*).

## Qué dejar listo desde antes (ya cubierto)

- `clientes.cedula` + `tipo_cedula` (física/jurídica/DIMEX) — Fase 1.
- Separación entre tiquete interno y comprobante fiscal en el diseño de tiquetes,
  para no tener que rehacer las plantillas cuando llegue esta versión.

## Referencias al plan

§6 ("Comprobantes electrónicos (Hacienda)"), §8 tabla de decisiones pendientes.
