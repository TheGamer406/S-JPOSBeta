import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { auditoria, movimientosCuenta, pagos, usuarios, ventas } from '@/db/schema';

export class PedidoError extends Error {}

/** Cola de pedidos: pendiente → preparación → listo → entregado (§3.4). */
export async function cambiarEstadoPedido(
  ventaId: string,
  estado: 'preparacion' | 'listo' | 'entregado',
) {
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  if (!venta) throw new PedidoError('Venta no encontrada');
  if (venta.estadoPedido === 'anulado') throw new PedidoError('Esta venta está anulada');

  await db
    .update(ventas)
    .set({
      estadoPedido: estado,
      entregadoEn: estado === 'entregado' ? new Date().toISOString() : venta.entregadoEn,
    })
    .where(eq(ventas.id, ventaId))
    .run();
}

/**
 * "En espera" (ej. el cliente se fue un rato): no toca estado_pedido, así que la
 * cocina no pierde el progreso que ya tenía. Al reanudar (enEspera=false), el
 * pedido vuelve marcado con prioridad para que el cajero/cocina lo note primero.
 */
export async function cambiarEspera(ventaId: string, enEspera: boolean) {
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  if (!venta) throw new PedidoError('Venta no encontrada');
  if (venta.estadoPedido === 'anulado' || venta.estadoPedido === 'entregado') {
    throw new PedidoError('Este pedido ya no se puede poner en espera');
  }

  await db
    .update(ventas)
    .set({ enEspera, prioridad: enEspera ? venta.prioridad : true })
    .where(eq(ventas.id, ventaId))
    .run();
}

/** Verifica el PIN contra cualquier usuario admin activo (§2: acciones sensibles). */
export async function verificarPinAdmin(pin: string): Promise<typeof usuarios.$inferSelect | null> {
  const admins = await db.select().from(usuarios).where(eq(usuarios.rol, 'admin'));
  const coincidencia = admins.find((admin) => admin.activo && bcrypt.compareSync(pin, admin.pinHash));
  return coincidencia ?? null;
}

/**
 * Anula una venta (§3.4, §6): nunca se borra. Se marcan los pagos como anulados y,
 * si había un cargo a cuenta, se revierte con un movimiento de ajuste (el libro mayor
 * de movimientos_cuenta nunca se edita, solo se agregan asientos nuevos).
 */
export async function anularVenta(ventaId: string, motivo: string, adminId: string) {
  const [venta] = await db.select().from(ventas).where(eq(ventas.id, ventaId));
  if (!venta) throw new PedidoError('Venta no encontrada');
  if (venta.estadoPago === 'anulada') throw new PedidoError('Esta venta ya está anulada');

  sqlite.transaction(() => {
    db.update(ventas)
      .set({ estadoPago: 'anulada', estadoPedido: 'anulado', anuladaPor: adminId, anuladaMotivo: motivo })
      .where(eq(ventas.id, ventaId))
      .run();

    db.update(pagos).set({ anulado: true }).where(eq(pagos.ventaId, ventaId)).run();

    if (venta.clienteId && (venta.estadoPago === 'a_cuenta' || venta.estadoPago === 'parcial')) {
      const cargosVenta = sqlite
        .prepare("SELECT monto FROM movimientos_cuenta WHERE venta_id = ? AND tipo = 'cargo'")
        .all(ventaId) as { monto: number }[];
      const totalCargado = cargosVenta.reduce((suma, fila) => suma + fila.monto, 0);

      if (totalCargado > 0) {
        db.insert(movimientosCuenta)
          .values({
            id: randomUUID(),
            clienteId: venta.clienteId,
            tipo: 'ajuste',
            monto: -totalCargado,
            ventaId,
            nota: `Reversa por anulación: ${motivo}`,
            usuarioId: adminId,
          })
          .run();
      }
    }

    db.insert(auditoria)
      .values({
        id: randomUUID(),
        usuarioId: adminId,
        accion: 'anular_venta',
        entidad: 'ventas',
        entidadId: ventaId,
        detalle: { motivo },
      })
      .run();
  })();
}
