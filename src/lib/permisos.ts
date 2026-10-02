// Roles y permisos según PLAN_POS_SJ.md §2.

export type Rol = 'admin' | 'cajero' | 'cocina';

/** Acciones sensibles: piden PIN de admin aunque esté logueado un cajero (§2). */
const ACCIONES_SOLO_ADMIN = [
  'anular_venta',
  'aplicar_descuento',
  'reabrir_cierre',
  'cambiar_tipo_cambio_a_mitad_del_dia',
  'administrar_productos',
  'administrar_usuarios',
] as const;

export type AccionSensible = (typeof ACCIONES_SOLO_ADMIN)[number];

export function requierePinAdmin(accion: AccionSensible): boolean {
  return ACCIONES_SOLO_ADMIN.includes(accion);
}

export function puedeVender(rol: Rol): boolean {
  return rol === 'admin' || rol === 'cajero';
}

export function puedeVerDinero(rol: Rol): boolean {
  // Cocina/Despacho ve la cola de pedidos pero no dinero (§2).
  return rol === 'admin' || rol === 'cajero';
}

export function puedeVerCola(rol: Rol): boolean {
  return rol === 'admin' || rol === 'cajero' || rol === 'cocina';
}

export function esAdmin(rol: Rol): boolean {
  return rol === 'admin';
}
