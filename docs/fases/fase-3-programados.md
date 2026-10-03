# Fase 3 — Pedidos programados de empresas

> Estimado original: 1 semana · PLAN_POS_SJ.md §10

## Alcance

- Carga tipo hoja e importación desde Excel/CSV con el formato que ya usan
  (filas = empresas, columnas = productos).
- Entregas parciales (`cantidad_entregada` por línea, ya está en el esquema).
- Cargo automático a cuenta, o cobro contra entrega según `modo_pago_default` del
  cliente (decisión pendiente #1 del §8 — queda configurable por cliente).
- Hoja de despacho imprimible por día.

## Checklist

- [x] Modelo: pedido programado por empresa + día + tiempo de comida (almuerzo/café/
      cena), encargado y cantidades por producto (`src/lib/pos/programados.ts`,
      `crearPedidoProgramado`). Se puede crear **sin caja abierta** — por eso
      `ventas.sesion_caja_id` y `numero_orden_dia` pasaron a ser opcionales (migración
      `0002_tranquil_iron_patriot.sql`) y se asignan hasta la primera entrega.
- [x] Pantalla manual de alta (`/programados/nuevo`, `FormularioPedidoProgramado.tsx`)
      — un producto por fila con cantidad, en vez de carrito con cobro.
- [x] Importación desde CSV con el mismo formato de hoja (`empresa,encargado,
      <producto>,...`), vía `/api/programados/importar` — una fila con error (cliente
      no encontrado) no tumba el resto del archivo. Probado con curl.
- [x] Vista del día: `/programados` (`ColaProgramados.tsx`) lista los pedidos
      programados por fecha + tiempo de comida, separada de `/pedidos` (mostrador)
      porque el flujo de entrega es distinto (ver nota de diseño abajo).
- [x] Marcar entregado total o parcial por línea — probado con curl exactamente el
      caso del plan: "9 de 9 perros, 0 de 5 arroces" → `parcial`, después completar
      los 5 arroces → `entregado`.
- [x] Al entregar: cargo automático a la cuenta (`modo_pago_default = 'cuenta'`) o
      cobro inmediato contra entrega (`'contra_entrega'`) — probado con curl ambos
      casos, incluyendo que `contra_entrega` **rechaza la entrega sin pago** con el
      monto exacto que falta.
- [x] Hoja de despacho imprimible por día (`GET /api/programados/despacho-pdf`,
      `src/lib/pos/pdfDespacho.ts`) — probada con `pdftotext`, lista por empresa con
      casillas `[ ]` y "faltan N" por línea.
- [x] Campo `modo_pago_default` en `clientes` (migración `0001_milky_patriot.sql`,
      default `'cuenta'` como recomienda el plan).

## Decisión de diseño: cola separada en vez de una sola

El plan dice que los programados "aparecen en la cola marcados como Programado",
pero el flujo de entrega (cantidad parcial por línea + a veces un cobro) es tan
distinto al de una venta de mostrador (un solo botón para avanzar de estado) que se
hizo una pantalla separada (`/programados`) en vez de mezclar ambos casos en
`ColaPedidos.tsx`. La visibilidad que pide el plan queda cubierta — solo que en su
propia pantalla en vez de un filtro dentro de la misma.

## Pendiente / fuera de esta pasada

- [x] **Click-through real en navegador (Ronda 2, 2026-10-03).** `/programados/nuevo`:
      alta manual (9 de un producto, 5 de otro, cliente elegido con `BuscadorCliente`),
      importación CSV (fila con cliente inexistente → error claro sin tumbar el resto;
      fila con cliente real → pedido creado). `/programados`: cola del día, "Gestionar"
      → sacar todo lo pendiente → cobrar en efectivo exacto → despacho confirmado. Sin
      errores de JS. Bug real encontrado y corregido: **la hoja de despacho en PDF
      crasheaba 500 en cualquier build de producción** (no solo Docker) — `pdfDespacho.ts`
      calculaba la ruta de la fuente con `../../../` relativo a su propio archivo, y
      Astro empaqueta ese módulo a una profundidad distinta que `pdfCierre.ts` en
      producción, así que el cálculo apuntaba a `dist/server/assets/...` en vez de
      `assets/...`. `npm run dev` nunca lo mostraba porque ahí no hay bundling.
      Corregido centralizando la resolución en `src/lib/pos/fuentesPdf.ts`, relativa a
      `process.cwd()` en vez de `import.meta.url`.
- [ ] El modo `contra_entrega` no tiene los atajos de efectivo/billetes $ de
      `ModalAbono`/`ModalCobro` — son inputs sueltos. Se puede alinear más adelante
      si se usa seguido.
- [ ] El despacho de un programado no emite ningún comprobante — ver Fase 6/7.

## Decisión que afecta esta fase

PLAN_POS_SJ.md §8, decisión #2: Personal NUNU = **una cuenta por persona**, ligada a
la organización NUNU (recomendación ya aceptada en el plan). No se tocó en esta fase
más allá de que `crearCliente` ya soporta `tipo = 'personal_nunu'` desde Fase 1.

## Referencias al plan

§3.5 Pedidos programados, §4 (`ventas.tipo`, `venta_items.cantidad_entregada`), §8
decisión 1 (`modo_pago_default`).
