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

- [ ] Modelo: pedido programado por empresa + día + tiempo de comida (almuerzo/café/
      cena), encargado y cantidades por producto. (`ventas.tipo = 'programado'`,
      `fecha_programada`, `tiempo_comida` ya existen en el esquema).
- [ ] Pantalla tipo hoja para carga rápida (filas = empresas, columnas = productos).
- [ ] Importación desde Excel/CSV con el mismo formato que ya usan hoy.
- [ ] Vista del día: pedidos programados en la cola marcados como "Programado".
- [ ] Marcar entregado total o parcial por línea ("9 de 9 perros, faltan 2 arroces").
- [ ] Al entregar: cargo automático a la cuenta por cobrar de la empresa, o cobro
      inmediato si el cliente paga contra entrega.
- [ ] Hoja de despacho imprimible por día (reemplaza los PDF manuales actuales).
- [ ] Campo `modo_pago_default` en `clientes` (no está en el esquema v0 — agregar
      migración cuando se construya esta fase).

## Decisión que afecta esta fase

PLAN_POS_SJ.md §8, decisión #2: Personal NUNU = **una cuenta por persona**, ligada a
la organización NUNU (recomendación ya aceptada en el plan). Tenerlo en cuenta al
diseñar la carga por empresa/encargado.

## Referencias al plan

§3.5 Pedidos programados, §4 (`ventas.tipo`, `venta_items.cantidad_entregada`).
