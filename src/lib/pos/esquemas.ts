import { z } from 'zod';

// Validación en los límites del sistema (API): nunca se confía en lo que llega del
// cliente para montos o permisos — eso se recalcula siempre en la capa de negocio.

export const esquemaAbrirCaja = z.object({
  fondoInicial: z.number().int().nonnegative(),
  tipoCambioUsd: z.number().int().positive(),
  dispositivo: z.string().min(1).default('Principal'),
  eventoId: z.string().uuid().optional(),
});

export const esquemaCerrarCaja = z.object({
  sesionCajaId: z.string().uuid(),
  efectivoContado: z.number().int().nonnegative(),
  conteoDenominaciones: z.record(z.string(), z.number().int().nonnegative()),
  usdContado: z.number().int().nonnegative().default(0),
  conteoUsd: z.record(z.string(), z.number().int().nonnegative()).default({}),
  loteBac: z.number().int().nonnegative().optional(),
  loteBn: z.number().int().nonnegative().optional(),
  notasCierre: z.string().optional(),
});

export const esquemaItemVenta = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number().int().positive(),
  nota: z.string().optional(),
});

export const esquemaPago = z.object({
  metodo: z.enum(['efectivo', 'efectivo_usd', 'sinpe', 'datafono_bac', 'datafono_bn', 'cuenta']),
  monto: z.number().int().positive(), // parte del total que cubre este pago, en ₡
  recibido: z.number().int().positive().optional(), // solo efectivo: lo que entregó el cliente
  montoUsd: z.number().int().positive().optional(), // solo efectivo_usd: billetes recibidos
  referencia: z.string().optional(),
});

export const esquemaCrearVenta = z.object({
  clienteId: z.string().uuid().optional(),
  nombreReferencia: z.string().optional(),
  items: z.array(esquemaItemVenta).min(1),
  pagos: z.array(esquemaPago).min(1),
  idempotencyKey: z.string().min(10),
});

export const esquemaCrearCliente = z.object({
  tipo: z.enum(['empresa', 'personal_nunu', 'otro']),
  nombre: z.string().min(1),
  cedula: z.string().min(9),
  tipoCedula: z.enum(['fisica', 'juridica', 'dimex']),
  telefono: z.string().optional(),
  organizacion: z.string().optional(),
  contactoEncargado: z.string().optional(),
  limiteCredito: z.number().int().nonnegative().optional(),
  notas: z.string().optional(),
});

export const esquemaCambiarEstadoPedido = z.object({
  ventaId: z.string().uuid(),
  estado: z.enum(['preparacion', 'listo', 'entregado']),
});

export const esquemaRegistrarAbono = z.object({
  clienteId: z.string().uuid(),
  metodo: z.enum(['efectivo', 'efectivo_usd', 'sinpe', 'datafono_bac', 'datafono_bn']),
  monto: z.number().int().positive(),
  recibido: z.number().int().positive().optional(),
  montoUsd: z.number().int().positive().optional(),
  referencia: z.string().optional(),
});

export const esquemaMovimientoCaja = z.object({
  tipo: z.enum(['entrada', 'salida']),
  monto: z.number().int().positive(),
  motivo: z.string().min(3),
});

export const esquemaAnularVenta = z.object({
  ventaId: z.string().uuid(),
  motivo: z.string().min(3),
  pinAdmin: z.string().min(4).max(6),
});
