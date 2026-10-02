// Utilidades de dinero (§3.3). Todo se guarda y calcula como colones enteros:
// el colón no usa céntimos en la práctica, así se evitan errores de redondeo.

export function formatoCRC(monto: number): string {
  return `₡${Math.round(monto).toLocaleString('es-CR')}`;
}

export function formatoUSD(monto: number): string {
  return `$${monto.toLocaleString('en-US')}`;
}

/** Redondea a múltiplos de ₡10: es la moneda más pequeña en circulación. */
export function redondearA10(monto: number): number {
  return Math.round(monto / 10) * 10;
}

/** Dólares recibidos (solo billetes) convertidos a colones con el TC del día de la sesión. */
export function convertirUsdACrc(montoUsd: number, tipoCambio: number): number {
  return montoUsd * tipoCambio;
}

/**
 * Vuelto de un pago en efectivo ₡. Lanza si el monto recibido no alcanza el total
 * (regla dura del §3.3: "no deja confirmar si recibido < total").
 */
export function calcularVueltoCrc(total: number, recibido: number): number {
  if (recibido < total) {
    throw new Error('El monto recibido es menor que el total');
  }
  return recibido - total;
}

/**
 * Vuelto de un pago en efectivo $ (solo billetes). El vuelto siempre se da en colones
 * y se redondea a múltiplos de ₡10. Ej.: total ₡8 200, paga $20 con TC ₡505
 * → recibido ₡10 100 → vuelto ₡1 900.
 */
export function calcularVueltoUsd(
  totalCrc: number,
  montoUsdRecibido: number,
  tipoCambio: number,
): number {
  const recibidoCrc = convertirUsdACrc(montoUsdRecibido, tipoCambio);
  if (recibidoCrc < totalCrc) {
    throw new Error('El monto recibido en dólares es menor que el total');
  }
  return redondearA10(recibidoCrc - totalCrc);
}

export interface PagoDividido {
  metodo: 'efectivo' | 'efectivo_usd' | 'sinpe' | 'datafono_bac' | 'datafono_bn' | 'cuenta';
  monto: number; // ya convertido a colones
}

/** Suma de un pago dividido. El total de los pagos debe igualar el total de la venta. */
export function sumaPagos(pagos: PagoDividido[]): number {
  return pagos.reduce((acumulado, pago) => acumulado + pago.monto, 0);
}
