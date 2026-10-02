import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Esquema según PLAN_POS_SJ.md §4. Montos en colones como enteros (sin céntimos).
// IDs en UUID (generados en la app, no autoincrement) por si algún día se sincroniza.

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  rol: text('rol', { enum: ['admin', 'cajero', 'cocina'] }).notNull(),
  pinHash: text('pin_hash').notNull(),
  passwordHash: text('password_hash'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
});

export const eventos = sqliteTable('eventos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(), // ej. "Oktoberfest 2026"
  fechaInicio: text('fecha_inicio').notNull(),
  fechaFin: text('fecha_fin').notNull(),
  notas: text('notas'),
});

export const categorias = sqliteTable('categorias', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  orden: integer('orden').notNull().default(0),
});

export const productos = sqliteTable('productos', {
  id: text('id').primaryKey(),
  categoriaId: text('categoria_id').notNull().references(() => categorias.id),
  nombre: text('nombre').notNull(),
  precio: integer('precio').notNull(), // colones, entero
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  agotado: integer('agotado', { mode: 'boolean' }).notNull().default(false),
  orden: integer('orden').notNull().default(0),
  color: text('color'),
});

export const clientes = sqliteTable('clientes', {
  id: text('id').primaryKey(),
  numeroCuenta: text('numero_cuenta').notNull().unique(), // 'S&J0001'
  tipo: text('tipo', { enum: ['empresa', 'personal_nunu', 'otro'] }).notNull(),
  nombre: text('nombre').notNull(),
  cedula: text('cedula').notNull().unique(),
  tipoCedula: text('tipo_cedula', { enum: ['fisica', 'juridica', 'dimex'] }).notNull(),
  telefono: text('telefono'),
  organizacion: text('organizacion'),
  contactoEncargado: text('contacto_encargado'),
  limiteCredito: integer('limite_credito'),
  estado: text('estado', { enum: ['activo', 'bloqueado'] }).notNull().default('activo'),
  // Pedidos programados (§3.5, §8 decisión 1): si se cargan a cuenta al entregar
  // o si el cliente paga contra entrega. Configurable por cliente.
  modoPagoDefault: text('modo_pago_default', { enum: ['cuenta', 'contra_entrega'] })
    .notNull()
    .default('cuenta'),
  notas: text('notas'),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
});

export const sesionesCaja = sqliteTable('sesiones_caja', {
  id: text('id').primaryKey(),
  eventoId: text('evento_id').references(() => eventos.id),
  dispositivo: text('dispositivo').notNull(),
  abiertaPor: text('abierta_por').notNull().references(() => usuarios.id),
  abiertaEn: text('abierta_en').notNull().default(sql`(current_timestamp)`),
  fondoInicial: integer('fondo_inicial').notNull(),
  tipoCambioUsd: integer('tipo_cambio_usd').notNull(), // ₡ por $1, fijado al abrir

  cerradaPor: text('cerrada_por').references(() => usuarios.id),
  cerradaEn: text('cerrada_en'),
  efectivoContado: integer('efectivo_contado'),
  conteoDenominaciones: text('conteo_denominaciones', { mode: 'json' }),
  usdContado: integer('usd_contado'),
  conteoUsd: text('conteo_usd', { mode: 'json' }),
  loteBac: integer('lote_bac'),
  loteBn: integer('lote_bn'),
  diferenciaEfectivo: integer('diferencia_efectivo'),
  notasCierre: text('notas_cierre'),
  estado: text('estado', { enum: ['abierta', 'cerrada'] }).notNull().default('abierta'),
});

export const ventas = sqliteTable('ventas', {
  id: text('id').primaryKey(),
  // Nulo hasta que se asocia a una sesión real: un pedido programado (§3.5) se
  // puede crear días antes del evento, cuando todavía no hay caja abierta. Se
  // asignan al momento de la primera entrega, dentro de la sesión activa de ese día.
  sesionCajaId: text('sesion_caja_id').references(() => sesionesCaja.id),
  numeroOrdenDia: integer('numero_orden_dia'), // reinicia cada día
  tipo: text('tipo', { enum: ['mostrador', 'programado'] }).notNull(),

  clienteId: text('cliente_id').references(() => clientes.id),
  nombreReferencia: text('nombre_referencia'), // nombre o # de mesa, opcional
  usuarioId: text('usuario_id').notNull().references(() => usuarios.id),

  subtotal: integer('subtotal').notNull(),
  descuento: integer('descuento').notNull().default(0),
  total: integer('total').notNull(),

  estadoPago: text('estado_pago', {
    enum: ['pendiente', 'pagada', 'a_cuenta', 'parcial', 'anulada'],
  }).notNull().default('pendiente'),
  estadoPedido: text('estado_pedido', {
    enum: ['pendiente', 'preparacion', 'listo', 'entregado', 'anulado'],
  }).notNull().default('pendiente'),
  // "En espera" (ej. el cliente se fue a hacer otra cosa) es independiente del
  // avance normal de la cocina: no pierde el progreso que ya tenía. Al reanudar,
  // vuelve marcado con prioridad para que no se quede atrás en la cola.
  enEspera: integer('en_espera', { mode: 'boolean' }).notNull().default(false),
  prioridad: integer('prioridad', { mode: 'boolean' }).notNull().default(false),

  fechaProgramada: text('fecha_programada'),
  tiempoComida: text('tiempo_comida', { enum: ['almuerzo', 'cafe', 'cena'] }),

  // Cuando se despacha parte de un pedido programado (§3.5) se crea una venta
  // real SOLO con lo que se sacó (más lo adicional que pidan en el momento), y
  // esa venta apunta acá al programado del que salió. El programado queda como
  // el plan/saldo: nunca lleva pagos ni número de orden propios.
  programadoOrigenId: text('programado_origen_id'),

  nota: text('nota'),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
  entregadoEn: text('entregado_en'),

  anuladaPor: text('anulada_por').references(() => usuarios.id),
  anuladaMotivo: text('anulada_motivo'),

  idempotencyKey: text('idempotency_key').notNull().unique(), // evita doble toque (§6)
});

export const ventaItems = sqliteTable('venta_items', {
  id: text('id').primaryKey(),
  ventaId: text('venta_id').notNull().references(() => ventas.id),
  productoId: text('producto_id').notNull().references(() => productos.id),
  nombreSnapshot: text('nombre_snapshot').notNull(),
  precioSnapshot: integer('precio_snapshot').notNull(), // si cambia el precio, la venta vieja no cambia
  cantidad: integer('cantidad').notNull(),
  cantidadEntregada: integer('cantidad_entregada').notNull().default(0),
  nota: text('nota'),
  subtotal: integer('subtotal').notNull(),
  // Solo en líneas de una venta despachada desde un pedido programado: apunta a
  // la línea del plan de la que salió. Permite devolverle la cantidad exacta al
  // plan si la venta se anula (sin esto, un producto adicional del mismo tipo
  // haría ambiguo cuánto devolver). Null en ventas de mostrador y adicionales.
  planItemId: text('plan_item_id'),
});

export const pagos = sqliteTable('pagos', {
  id: text('id').primaryKey(),
  sesionCajaId: text('sesion_caja_id').notNull().references(() => sesionesCaja.id),
  ventaId: text('venta_id').references(() => ventas.id), // null = abono a cuenta
  clienteId: text('cliente_id').references(() => clientes.id),

  metodo: text('metodo', {
    enum: ['efectivo', 'efectivo_usd', 'sinpe', 'datafono_bac', 'datafono_bn', 'cuenta'],
  }).notNull(),
  montoUsd: integer('monto_usd'), // solo efectivo_usd
  tipoCambio: integer('tipo_cambio'), // solo efectivo_usd; el vuelto siempre se da en ₡

  monto: integer('monto').notNull(),
  recibido: integer('recibido'),
  vuelto: integer('vuelto'),
  referencia: text('referencia'), // comprobante SINPE o voucher de datáfono
  verificado: integer('verificado', { mode: 'boolean' }).notNull().default(false),

  usuarioId: text('usuario_id').notNull().references(() => usuarios.id),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
  anulado: integer('anulado', { mode: 'boolean' }).notNull().default(false),
});

export const movimientosCuenta = sqliteTable('movimientos_cuenta', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').notNull().references(() => clientes.id),
  tipo: text('tipo', { enum: ['cargo', 'abono', 'ajuste'] }).notNull(),
  monto: integer('monto').notNull(),
  ventaId: text('venta_id').references(() => ventas.id),
  pagoId: text('pago_id').references(() => pagos.id),
  nota: text('nota'),
  usuarioId: text('usuario_id').notNull().references(() => usuarios.id),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
  // saldo = SUM(cargos) - SUM(abonos) +/- ajustes — libro mayor, nunca se edita
});

export const movimientosCaja = sqliteTable('movimientos_caja', {
  id: text('id').primaryKey(),
  sesionCajaId: text('sesion_caja_id').notNull().references(() => sesionesCaja.id),
  tipo: text('tipo', { enum: ['entrada', 'salida'] }).notNull(),
  monto: integer('monto').notNull(),
  motivo: text('motivo').notNull(),
  usuarioId: text('usuario_id').notNull().references(() => usuarios.id),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
});

export const auditoria = sqliteTable('auditoria', {
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id').notNull().references(() => usuarios.id),
  accion: text('accion').notNull(),
  entidad: text('entidad').notNull(),
  entidadId: text('entidad_id').notNull(),
  detalle: text('detalle', { mode: 'json' }),
  creadoEn: text('creado_en').notNull().default(sql`(current_timestamp)`),
});

// Contadores consecutivos (números de cuenta y de orden del día) — §4
export const contadores = sqliteTable('contadores', {
  nombre: text('nombre').primaryKey(),
  valor: integer('valor').notNull(),
});
