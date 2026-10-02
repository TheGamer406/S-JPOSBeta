import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientes, sesionesCaja, usuarios, ventaItems, ventas } from '@/db/schema';
import { calcularCierre } from './caja';

export interface ProductoVendido {
  nombre: string;
  cantidad: number;
}

export interface CuentaGenerada {
  numeroCuenta: string;
  nombre: string;
  monto: number;
}

export interface ReporteCierre {
  sesion: typeof sesionesCaja.$inferSelect;
  abrioUsuario: string;
  cerroUsuario: string;
  totalesPorMedio: { medio: string; cantidad: number; monto: number }[];
  totalVendido: number;
  abonosRecibidos: number;
  efectivoEsperado: number;
  dolaresPagados: number;
  loteSistemaBac: number;
  loteSistemaBn: number;
  anuladas: { cantidad: number; monto: number };
  productosVendidos: ProductoVendido[];
  cuentasGeneradas: CuentaGenerada[];
}

/**
 * Arma el reporte completo del cierre (§3.8): lo mismo que calcularCierre() más el
 * resumen de productos vendidos, ventas anuladas y cuentas por cobrar generadas en
 * la sesión — lo que se imprime en el PDF del cierre.
 */
export async function construirReporteCierre(sesionCajaId: string): Promise<ReporteCierre> {
  const base = await calcularCierre(sesionCajaId);

  const [abrio] = await db.select().from(usuarios).where(eq(usuarios.id, base.sesion.abiertaPor));
  const [cerro] = base.sesion.cerradaPor
    ? await db.select().from(usuarios).where(eq(usuarios.id, base.sesion.cerradaPor))
    : [undefined];

  const ventasSesion = await db.select().from(ventas).where(eq(ventas.sesionCajaId, sesionCajaId));
  const ventasValidas = ventasSesion.filter((venta) => venta.estadoPago !== 'anulada');
  const ventasAnuladas = ventasSesion.filter((venta) => venta.estadoPago === 'anulada');

  const idsVentasValidas = ventasValidas.map((venta) => venta.id);
  const itemsVendidos =
    idsVentasValidas.length > 0
      ? await db.select().from(ventaItems).where(inArray(ventaItems.ventaId, idsVentasValidas))
      : [];

  const cantidadPorProducto = new Map<string, number>();
  for (const item of itemsVendidos) {
    cantidadPorProducto.set(
      item.nombreSnapshot,
      (cantidadPorProducto.get(item.nombreSnapshot) ?? 0) + item.cantidad,
    );
  }
  const productosVendidos = [...cantidadPorProducto.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const ventasACuenta = ventasValidas.filter(
    (venta) => venta.estadoPago === 'a_cuenta' || venta.estadoPago === 'parcial',
  );
  const montoPorCliente = new Map<string, number>();
  for (const venta of ventasACuenta) {
    if (!venta.clienteId) continue;
    montoPorCliente.set(venta.clienteId, (montoPorCliente.get(venta.clienteId) ?? 0) + venta.total);
  }
  const clientesInvolucrados =
    montoPorCliente.size > 0
      ? await db.select().from(clientes).where(inArray(clientes.id, [...montoPorCliente.keys()]))
      : [];
  const cuentasGeneradas: CuentaGenerada[] = clientesInvolucrados.map((cliente) => ({
    numeroCuenta: cliente.numeroCuenta,
    nombre: cliente.nombre,
    monto: montoPorCliente.get(cliente.id) ?? 0,
  }));

  return {
    ...base,
    abrioUsuario: abrio?.nombre ?? '—',
    cerroUsuario: cerro?.nombre ?? '—',
    anuladas: {
      cantidad: ventasAnuladas.length,
      monto: ventasAnuladas.reduce((suma, venta) => suma + venta.total, 0),
    },
    productosVendidos,
    cuentasGeneradas,
  };
}
