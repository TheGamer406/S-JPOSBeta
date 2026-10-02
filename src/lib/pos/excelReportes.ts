import ExcelJS from 'exceljs';
import type { FilaReporte, ReporteVentas } from './reportes';

function agregarHoja(libro: ExcelJS.Workbook, nombre: string, columnaEtiqueta: string, filas: FilaReporte[]) {
  const hoja = libro.addWorksheet(nombre);
  hoja.columns = [
    { header: columnaEtiqueta, key: 'etiqueta', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Monto (₡)', key: 'monto', width: 15 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const fila of filas) hoja.addRow(fila);
}

/** Exportar reportes a Excel (§3.9), una hoja por corte. */
export function generarExcelReporte(reporte: ReporteVentas): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'S&J POS';
  libro.created = new Date();

  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [{ header: 'Indicador', key: 'indicador', width: 25 }, { header: 'Valor', key: 'valor', width: 20 }];
  resumen.getRow(1).font = { bold: true };
  resumen.addRow({ indicador: 'Total de ventas', valor: reporte.totalVentas });
  resumen.addRow({ indicador: 'Monto total (₡)', valor: reporte.totalMonto });

  agregarHoja(libro, 'Por día', 'Día', reporte.porDia);
  agregarHoja(libro, 'Por producto', 'Producto', reporte.porProducto);
  agregarHoja(libro, 'Por medio de pago', 'Medio', reporte.porMedioPago);
  agregarHoja(libro, 'Por cajero', 'Cajero', reporte.porCajero);
  agregarHoja(libro, 'Por evento', 'Evento', reporte.porEvento);

  return libro;
}
