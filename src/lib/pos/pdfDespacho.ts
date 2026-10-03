import PDFDocument from 'pdfkit';
import type { ventaItems, ventas, clientes } from '@/db/schema';
import { FUENTE_REGULAR, FUENTE_BOLD } from './fuentesPdf';

const NOMBRE_TIEMPO: Record<string, string> = { almuerzo: 'Almuerzo', cafe: 'Café', cena: 'Cena' };

export interface PedidoDespacho {
  venta: typeof ventas.$inferSelect;
  items: (typeof ventaItems.$inferSelect)[];
  cliente?: typeof clientes.$inferSelect;
}

/**
 * Hoja de despacho imprimible por día (§3.5): reemplaza los PDF manuales. Por
 * empresa, lista lo pedido y deja espacio para marcar lo entregado a mano si el
 * cajero prefiere llevar la hoja impresa al momento de la entrega.
 */
export function generarPdfDespacho(
  fecha: string,
  tiempoComida: 'almuerzo' | 'cafe' | 'cena',
  pedidos: PedidoDespacho[],
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.registerFont('Regular', FUENTE_REGULAR);
  doc.registerFont('Bold', FUENTE_BOLD);
  doc.font('Regular');

  doc.fontSize(16).text('HOJA DE DESPACHO', { align: 'center' });
  doc.fontSize(12).text(`${fecha} — ${NOMBRE_TIEMPO[tiempoComida]}`, { align: 'center' });
  doc.moveDown();

  if (pedidos.length === 0) {
    doc.fontSize(11).text('No hay pedidos programados para este día y tiempo de comida.');
  }

  for (const pedido of pedidos) {
    doc.font('Bold').fontSize(13).text(pedido.cliente?.nombre ?? 'Cliente sin nombre');
    doc.font('Regular').fontSize(10);
    if (pedido.venta.nombreReferencia) doc.text(`Encargado: ${pedido.venta.nombreReferencia}`);
    doc.text(`Estado: ${pedido.venta.estadoPedido}`);
    doc.moveDown(0.3);

    for (const item of pedido.items) {
      const pendiente = item.cantidad - item.cantidadEntregada;
      doc.text(
        `  [ ]  ${item.nombreSnapshot} — pedido ${item.cantidad}, entregado ${item.cantidadEntregada}${
          pendiente > 0 ? `, faltan ${pendiente}` : ''
        }`,
      );
    }
    doc.moveDown();
  }

  return doc;
}
