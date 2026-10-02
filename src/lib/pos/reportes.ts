import { and, gte, lte, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { eventos, pagos, sesionesCaja, usuarios, ventaItems, ventas } from '@/db/schema';

export interface FiltrosReporte {
  fechaInicio?: string; // 'YYYY-MM-DD'
  fechaFin?: string; // 'YYYY-MM-DD'
  eventoId?: string;
}

export interface FilaReporte {
  etiqueta: string;
  cantidad: number;
  monto: number;
}

export interface ReporteVentas {
  porDia: FilaReporte[];
  porProducto: FilaReporte[];
  porMedioPago: FilaReporte[];
  porCajero: FilaReporte[];
  porEvento: FilaReporte[];
  totalVentas: number;
  totalMonto: number;
}

/**
 * Reportes de ventas (§3.9): por día, producto, medio de pago, cajero y evento.
 * Se agrega en memoria porque el volumen de un POS de eventos es chico — una base
 * de datos de un evento tiene cientos de ventas, no millones.
 */
export async function obtenerReporteVentas(filtros: FiltrosReporte): Promise<ReporteVentas> {
  // Los pedidos programados son el PLAN de un día futuro, no una venta hecha:
  // contarlos acá inflaba los reportes (y duplicaba, porque al despacharlos se
  // crea una venta real aparte con lo que sí salió). Solo cuentan las ventas.
  const condiciones = [ne(ventas.estadoPago, 'anulada'), ne(ventas.tipo, 'programado')];
  if (filtros.fechaInicio) condiciones.push(gte(ventas.creadoEn, filtros.fechaInicio));
  if (filtros.fechaFin) condiciones.push(lte(ventas.creadoEn, `${filtros.fechaFin} 23:59:59`));

  const todasLasSesiones = await db.select().from(sesionesCaja);
  const eventoPorSesion = new Map(todasLasSesiones.map((sesion) => [sesion.id, sesion.eventoId]));

  let ventasFiltradas = await db
    .select()
    .from(ventas)
    .where(and(...condiciones));

  if (filtros.eventoId) {
    ventasFiltradas = ventasFiltradas.filter(
      (venta) => venta.sesionCajaId && eventoPorSesion.get(venta.sesionCajaId) === filtros.eventoId,
    );
  }

  const idsVentas = ventasFiltradas.map((venta) => venta.id);

  const [todosLosItems, todosLosPagos, todosLosUsuarios, todosLosEventos] = await Promise.all([
    db.select().from(ventaItems),
    db.select().from(pagos),
    db.select().from(usuarios),
    db.select().from(eventos),
  ]);

  const itemsFiltrados = todosLosItems.filter((item) => idsVentas.includes(item.ventaId));
  const pagosFiltrados = todosLosPagos.filter(
    (pago) => !pago.anulado && pago.ventaId && idsVentas.includes(pago.ventaId),
  );
  const nombrePorUsuario = new Map(todosLosUsuarios.map((usuario) => [usuario.id, usuario.nombre]));
  const nombrePorEvento = new Map(todosLosEventos.map((evento) => [evento.id, evento.nombre]));

  const porDia = agrupar(ventasFiltradas, (venta) => venta.creadoEn.slice(0, 10), (venta) => venta.total);
  const porCajero = agrupar(
    ventasFiltradas,
    (venta) => nombrePorUsuario.get(venta.usuarioId) ?? venta.usuarioId,
    (venta) => venta.total,
  );
  const porEvento = agrupar(
    ventasFiltradas,
    (venta) => {
      if (!venta.sesionCajaId) return 'Sin sesión';
      const eventoId = eventoPorSesion.get(venta.sesionCajaId);
      return eventoId ? nombrePorEvento.get(eventoId) ?? 'Evento desconocido' : 'Sin evento';
    },
    (venta) => venta.total,
  );
  const porProducto = agrupar(itemsFiltrados, (item) => item.nombreSnapshot, (item) => item.subtotal, (item) => item.cantidad);
  const porMedioPago = agrupar(pagosFiltrados, (pago) => pago.metodo, (pago) => pago.monto);

  return {
    porDia,
    porProducto,
    porMedioPago,
    porCajero,
    porEvento,
    totalVentas: ventasFiltradas.length,
    totalMonto: ventasFiltradas.reduce((suma, venta) => suma + venta.total, 0),
  };
}

function agrupar<T>(
  filas: T[],
  claveDe: (fila: T) => string,
  montoDe: (fila: T) => number,
  cantidadDe?: (fila: T) => number,
): FilaReporte[] {
  const acumulado = new Map<string, { cantidad: number; monto: number }>();
  for (const fila of filas) {
    const clave = claveDe(fila);
    const actual = acumulado.get(clave) ?? { cantidad: 0, monto: 0 };
    actual.cantidad += cantidadDe ? cantidadDe(fila) : 1;
    actual.monto += montoDe(fila);
    acumulado.set(clave, actual);
  }
  return [...acumulado.entries()]
    .map(([etiqueta, valores]) => ({ etiqueta, ...valores }))
    .sort((a, b) => b.monto - a.monto);
}
