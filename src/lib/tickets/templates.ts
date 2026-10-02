import { formatoCRC, formatoUSD } from '@/lib/dinero';
import { PIE_LEGAL, type Ticket } from './tipos';

const NOMBRE_NEGOCIO = 'S&J PARRILLADAS Y CATERING';

const ENCABEZADO = [
  { tipo: 'texto', texto: NOMBRE_NEGOCIO, align: 'centro', negrita: true } as const,
  { tipo: 'separador' } as const,
];

export interface ItemVenta {
  nombre: string;
  cantidad: number;
  subtotal: number;
  nota?: string;
}

export type MedioPago =
  | 'efectivo'
  | 'efectivo_usd'
  | 'sinpe'
  | 'datafono_bac'
  | 'datafono_bn'
  | 'cuenta';

const NOMBRE_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: 'Efectivo ₡',
  efectivo_usd: 'Efectivo $',
  sinpe: 'SINPE Móvil',
  datafono_bac: 'Datáfono BAC',
  datafono_bn: 'Datáfono BN',
  cuenta: 'A cuenta',
};

export interface PagoVenta {
  metodo: MedioPago;
  monto: number;
  recibido?: number; // solo efectivo
  vuelto?: number; // efectivo o efectivo_usd
  montoUsd?: number; // solo efectivo_usd
  tipoCambio?: number; // solo efectivo_usd
}

/**
 * Tiquete de venta (§3.10): sale al cobrar, con lo que pagó y el vuelto. Acepta
 * varios pagos porque una venta se puede cobrar dividida entre varios medios.
 */
export function ticketVenta(datos: {
  numeroOrden: number;
  fechaHora: string;
  cajero: string;
  items: ItemVenta[];
  total: number;
  pagos: PagoVenta[];
}): Ticket {
  return {
    titulo: `Venta #${datos.numeroOrden}`,
    copias: 1,
    lineas: [
      ...ENCABEZADO,
      { tipo: 'texto', texto: `Orden #${String(datos.numeroOrden).padStart(3, '0')}`, grande: true },
      { tipo: 'texto', texto: datos.fechaHora },
      { tipo: 'texto', texto: `Cajero: ${datos.cajero}` },
      { tipo: 'separador' },
      ...datos.items.flatMap((item): LineaItem[] => [
        { tipo: 'texto', texto: `${item.cantidad}x ${item.nombre}  ${formatoCRC(item.subtotal)}` },
        ...(item.nota ? [{ tipo: 'texto', texto: `  (${item.nota})` } as const] : []),
      ]),
      { tipo: 'separador' },
      { tipo: 'texto', texto: `TOTAL: ${formatoCRC(datos.total)}`, negrita: true, grande: true },
      ...datos.pagos.flatMap((pago): LineaItem[] => [
        {
          tipo: 'texto',
          texto: `${NOMBRE_MEDIO_PAGO[pago.metodo]}: ${formatoCRC(pago.monto)}`,
        },
        ...(pago.metodo === 'efectivo' && pago.recibido !== undefined
          ? [
              { tipo: 'texto', texto: `  Recibido: ${formatoCRC(pago.recibido)}` } as const,
              { tipo: 'texto', texto: `  Vuelto: ${formatoCRC(pago.vuelto ?? 0)}`, negrita: true } as const,
            ]
          : []),
        ...(pago.metodo === 'efectivo_usd' && pago.montoUsd !== undefined
          ? [
              {
                tipo: 'texto',
                texto: `  Recibido: ${formatoUSD(pago.montoUsd)} (TC ₡${pago.tipoCambio})`,
              } as const,
              { tipo: 'texto', texto: `  Vuelto: ${formatoCRC(pago.vuelto ?? 0)}`, negrita: true } as const,
            ]
          : []),
      ]),
      ...PIE_LEGAL,
    ],
  };
}

/** Comanda de cocina (§3.10, opcional): solo productos y notas, sin precios, letra grande. */
export function ticketComandaCocina(datos: {
  numeroOrden: number;
  items: { nombre: string; cantidad: number; nota?: string }[];
}): Ticket {
  return {
    titulo: `Comanda #${datos.numeroOrden}`,
    copias: 1,
    lineas: [
      { tipo: 'texto', texto: `ORDEN #${String(datos.numeroOrden).padStart(3, '0')}`, grande: true, negrita: true },
      { tipo: 'separador' },
      ...datos.items.flatMap((item): LineaItem[] => [
        { tipo: 'texto', texto: `${item.cantidad}x ${item.nombre}`, grande: true },
        ...(item.nota ? [{ tipo: 'texto', texto: `  >> ${item.nota}` } as const] : []),
      ]),
    ],
  };
}

/** Apertura de cuenta (§3.10): 2 copias, con línea de firma del cliente. */
export function ticketAperturaCuenta(datos: {
  numeroCuenta: string;
  nombre: string;
  cedula: string;
  tipo: string; // ej. "Empresa (Vindi)" o "Personal NUNU"
  fechaHora: string;
  abrioUsuario: string;
}): Ticket {
  return {
    titulo: `Apertura ${datos.numeroCuenta}`,
    copias: 2,
    lineas: [
      ...ENCABEZADO,
      { tipo: 'texto', texto: 'APERTURA DE CUENTA', align: 'centro', negrita: true },
      { tipo: 'espacio' },
      { tipo: 'texto', texto: datos.numeroCuenta, align: 'centro', grande: true, negrita: true },
      { tipo: 'espacio' },
      { tipo: 'texto', texto: `Nombre: ${datos.nombre}` },
      { tipo: 'texto', texto: `Cédula: ${datos.cedula}` },
      { tipo: 'texto', texto: `Tipo: ${datos.tipo}` },
      { tipo: 'texto', texto: `Fecha: ${datos.fechaHora}` },
      { tipo: 'texto', texto: `Abrió: ${datos.abrioUsuario}` },
      { tipo: 'separador' },
      { tipo: 'texto', texto: 'El cliente autoriza a S&J a' },
      { tipo: 'texto', texto: 'registrar consumos a esta cuenta' },
      { tipo: 'texto', texto: 'para pago posterior.' },
      { tipo: 'espacio' },
      { tipo: 'firma', etiqueta: 'Firma del cliente' },
      ...PIE_LEGAL,
    ],
  };
}

/** Cargo a cuenta (§3.10): cada venta "No paga". 2 copias, firmada queda en S&J. */
export function ticketCargoCuenta(datos: {
  numeroOrden: number;
  fechaHora: string;
  cajero: string;
  items: ItemVenta[];
  total: number;
  numeroCuenta: string;
  nombre: string;
  saldoAnterior: number;
  saldoNuevo: number;
}): Ticket {
  return {
    titulo: `Cargo a cuenta ${datos.numeroCuenta}`,
    copias: 2,
    lineas: [
      ...ENCABEZADO,
      { tipo: 'texto', texto: 'CARGO A CUENTA', align: 'centro', negrita: true },
      { tipo: 'texto', texto: `Orden #${String(datos.numeroOrden).padStart(3, '0')}` },
      { tipo: 'texto', texto: datos.fechaHora },
      { tipo: 'texto', texto: `Cajero: ${datos.cajero}` },
      { tipo: 'separador' },
      ...datos.items.map(
        (item): LineaItem => ({
          tipo: 'texto',
          texto: `${item.cantidad}x ${item.nombre}  ${formatoCRC(item.subtotal)}`,
        }),
      ),
      { tipo: 'separador' },
      { tipo: 'texto', texto: `TOTAL: ${formatoCRC(datos.total)}`, negrita: true, grande: true },
      { tipo: 'separador' },
      { tipo: 'texto', texto: `Cuenta: ${datos.numeroCuenta} — ${datos.nombre}` },
      { tipo: 'texto', texto: `Saldo anterior: ${formatoCRC(datos.saldoAnterior)}` },
      { tipo: 'texto', texto: `Saldo nuevo: ${formatoCRC(datos.saldoNuevo)}`, negrita: true },
      { tipo: 'espacio' },
      { tipo: 'texto', texto: 'Acepto el cargo a mi cuenta', align: 'centro' },
      { tipo: 'firma', etiqueta: 'Firma del cliente' },
      ...PIE_LEGAL,
    ],
  };
}

/** Abono (§3.10): cuando el cliente paga su cuenta, total o parcial. */
export function ticketAbono(datos: {
  numeroCuenta: string;
  nombre: string;
  monto: number;
  medioPago: MedioPago;
  fechaHora: string;
  saldoPendiente: number;
}): Ticket {
  return {
    titulo: `Abono ${datos.numeroCuenta}`,
    copias: 1,
    lineas: [
      ...ENCABEZADO,
      { tipo: 'texto', texto: 'ABONO A CUENTA', align: 'centro', negrita: true },
      { tipo: 'texto', texto: `Cuenta: ${datos.numeroCuenta} — ${datos.nombre}` },
      { tipo: 'texto', texto: datos.fechaHora },
      { tipo: 'separador' },
      { tipo: 'texto', texto: `Monto abonado: ${formatoCRC(datos.monto)}`, negrita: true },
      { tipo: 'texto', texto: `Medio: ${NOMBRE_MEDIO_PAGO[datos.medioPago]}` },
      { tipo: 'texto', texto: `Saldo pendiente: ${formatoCRC(datos.saldoPendiente)}` },
      ...PIE_LEGAL,
    ],
  };
}

/** Estado de cuenta (§3.10): a pedido, lista de cargos/abonos y saldo final. */
export function ticketEstadoCuenta(datos: {
  numeroCuenta: string;
  nombre: string;
  movimientos: { fecha: string; tipo: 'cargo' | 'abono' | 'ajuste'; monto: number }[];
  saldoFinal: number;
}): Ticket {
  return {
    titulo: `Estado de cuenta ${datos.numeroCuenta}`,
    copias: 1,
    lineas: [
      ...ENCABEZADO,
      { tipo: 'texto', texto: 'ESTADO DE CUENTA', align: 'centro', negrita: true },
      { tipo: 'texto', texto: `Cuenta: ${datos.numeroCuenta} — ${datos.nombre}` },
      { tipo: 'separador' },
      ...datos.movimientos.map(
        (movimiento): LineaItem => ({
          tipo: 'texto',
          texto: `${movimiento.fecha}  ${movimiento.tipo.toUpperCase()}  ${formatoCRC(movimiento.monto)}`,
        }),
      ),
      { tipo: 'separador' },
      { tipo: 'texto', texto: `SALDO: ${formatoCRC(datos.saldoFinal)}`, negrita: true, grande: true },
      ...PIE_LEGAL,
    ],
  };
}

/** Cierre de caja (§3.8/§3.10): versión resumida para tiquete; el completo sale en PDF. */
export function ticketCierre(datos: {
  dispositivo: string;
  abrioUsuario: string;
  cerroUsuario: string;
  totalesPorMedio: { medio: MedioPago; cantidad: number; monto: number }[];
  totalVendido: number;
  abonosRecibidos: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferenciaEfectivo: number;
}): Ticket {
  return {
    titulo: `Cierre de caja ${datos.dispositivo}`,
    copias: 1,
    lineas: [
      ...ENCABEZADO,
      { tipo: 'texto', texto: 'CIERRE DE CAJA', align: 'centro', negrita: true },
      { tipo: 'texto', texto: `Caja: ${datos.dispositivo}` },
      { tipo: 'texto', texto: `Abrió: ${datos.abrioUsuario} · Cerró: ${datos.cerroUsuario}` },
      { tipo: 'separador' },
      ...datos.totalesPorMedio.map(
        (fila): LineaItem => ({
          tipo: 'texto',
          texto: `${NOMBRE_MEDIO_PAGO[fila.medio]}  ${fila.cantidad}  ${formatoCRC(fila.monto)}`,
        }),
      ),
      { tipo: 'separador' },
      { tipo: 'texto', texto: `TOTAL VENDIDO: ${formatoCRC(datos.totalVendido)}`, negrita: true },
      { tipo: 'texto', texto: `Abonos recibidos: ${formatoCRC(datos.abonosRecibidos)}` },
      { tipo: 'separador' },
      { tipo: 'texto', texto: `Efectivo esperado: ${formatoCRC(datos.efectivoEsperado)}` },
      { tipo: 'texto', texto: `Efectivo contado: ${formatoCRC(datos.efectivoContado)}` },
      {
        tipo: 'texto',
        texto: `Diferencia: ${formatoCRC(datos.diferenciaEfectivo)}`,
        negrita: true,
      },
      ...PIE_LEGAL,
    ],
  };
}

type LineaItem = import('./tipos').LineaTicket;
