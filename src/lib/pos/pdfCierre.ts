import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { formatoCRC, formatoUSD } from '@/lib/dinero';
import type { ReporteCierre } from './reporteCierre';

// Helvetica (la fuente base de PDFKit) no tiene el glyph de ₡ (U+20A1) y lo
// rompe en el PDF. Noto Sans sí lo tiene y es libre de redistribuir (licencia OFL).
const FUENTE_REGULAR = fileURLToPath(new URL('../../../assets/fonts/NotoSans-Regular.ttf', import.meta.url));
const FUENTE_BOLD = fileURLToPath(new URL('../../../assets/fonts/NotoSans-Bold.ttf', import.meta.url));

const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: 'Efectivo ₡',
  efectivo_usd: 'Efectivo $',
  sinpe: 'SINPE Móvil',
  datafono_bac: 'Datáfono BAC',
  datafono_bn: 'Datáfono BN',
  cuenta: 'A cuenta (por cobrar)',
};

/** Reporte completo del cierre (§3.8) en PDF, con el resumen de productos vendidos. */
export function generarPdfCierre(reporte: ReporteCierre): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.registerFont('Regular', FUENTE_REGULAR);
  doc.registerFont('Bold', FUENTE_BOLD);
  doc.font('Regular');

  doc.fontSize(16).text('CIERRE DE CAJA', { align: 'center' });
  doc
    .fontSize(10)
    .text(`Caja: ${reporte.sesion.dispositivo}`, { align: 'center' })
    .text(
      `Abrió: ${reporte.abrioUsuario} ${reporte.sesion.abiertaEn} · Cerró: ${reporte.cerroUsuario} ${reporte.sesion.cerradaEn ?? '—'}`,
      { align: 'center' },
    );
  doc.moveDown();

  doc.fontSize(13).text('VENTAS');
  doc.fontSize(10);
  for (const fila of reporte.totalesPorMedio) {
    doc.text(`  ${NOMBRE_MEDIO[fila.medio] ?? fila.medio}: ${fila.cantidad} · ${formatoCRC(fila.monto)}`);
  }
  doc.font('Bold').text(`  TOTAL VENDIDO: ${formatoCRC(reporte.totalVendido)}`).font('Regular');
  doc.text(`  Anuladas: ${reporte.anuladas.cantidad} · ${formatoCRC(reporte.anuladas.monto)}`);
  doc.moveDown();

  doc.fontSize(13).text('EFECTIVO');
  doc.fontSize(10);
  doc.text(`  Fondo inicial: ${formatoCRC(reporte.sesion.fondoInicial)}`);
  doc.text(`  Efectivo esperado (₡): ${formatoCRC(reporte.efectivoEsperado)}`);
  doc.text(`  Efectivo contado (₡): ${formatoCRC(reporte.sesion.efectivoContado ?? 0)}`);
  doc
    .font('Bold')
    .text(`  DIFERENCIA: ${formatoCRC(reporte.sesion.diferenciaEfectivo ?? 0)}`)
    .font('Regular');
  doc.moveDown();

  doc.fontSize(13).text(`DÓLARES (TC del día ₡${reporte.sesion.tipoCambioUsd})`);
  doc.fontSize(10);
  doc.text(`  Pagos en $: ${formatoUSD(reporte.dolaresPagados)}`);
  doc.text(`  Dólares contados: ${formatoUSD(reporte.sesion.usdContado ?? 0)}`);
  doc.moveDown();

  doc.fontSize(13).text('DATÁFONOS');
  doc.fontSize(10);
  doc.text(
    `  BAC — Sistema: ${formatoCRC(reporte.loteSistemaBac)} · Lote: ${formatoCRC(reporte.sesion.loteBac ?? 0)}`,
  );
  doc.text(
    `  BN — Sistema: ${formatoCRC(reporte.loteSistemaBn)} · Lote: ${formatoCRC(reporte.sesion.loteBn ?? 0)}`,
  );
  doc.moveDown();

  doc.fontSize(13).text('PRODUCTOS VENDIDOS');
  doc.fontSize(10);
  if (reporte.productosVendidos.length === 0) {
    doc.text('  (sin ventas)');
  } else {
    for (const producto of reporte.productosVendidos) {
      doc.text(`  ${producto.nombre}: ${producto.cantidad}`);
    }
  }
  doc.moveDown();

  if (reporte.cuentasGeneradas.length > 0) {
    doc.fontSize(13).text('CUENTAS POR COBRAR GENERADAS HOY');
    doc.fontSize(10);
    for (const cuenta of reporte.cuentasGeneradas) {
      doc.text(`  ${cuenta.numeroCuenta} ${cuenta.nombre}: ${formatoCRC(cuenta.monto)}`);
    }
    doc.moveDown();
  }

  if (reporte.sesion.notasCierre) {
    doc.fontSize(13).text('NOTAS');
    doc.fontSize(10).text(`  ${reporte.sesion.notasCierre}`);
  }

  return doc;
}
