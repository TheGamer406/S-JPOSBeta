import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import type { Ticket } from './tipos';

export interface ConfiguracionImpresora {
  // 'usb:...' en Linux/Windows según node-thermal-printer, o 'tcp://192.168.x.x' en red.
  interfaz: string;
  anchoMm: 58 | 80;
  abrirGaveta: boolean;
}

/**
 * Se lanza cuando la impresora física falla o no está configurada (sin papel,
 * desconectada, etc.). El llamador debe capturarla y mostrar la vista previa en
 * pantalla (preview.ts) — regla del §6: "el tiquete se guarda siempre en el sistema
 * y se puede reimprimir. Si la impresora falla, se muestra en pantalla y se avisa."
 */
export class ImpresionFallidaError extends Error {}

/**
 * Ninguna de las páginas de código ESC/POS que soporta node-thermal-printer tiene
 * el signo de colón (₡, U+20A1) — es un símbolo demasiado raro. Sale como "?" en
 * cualquier impresora térmica. Se sustituye solo en lo que se manda a imprimir;
 * en pantalla (preview.ts) y en el PDF (que usa una fuente propia) sigue el ₡ real.
 */
function paraImpresora(texto: string): string {
  return texto.replace(/₡/g, 'C ');
}

export async function imprimirTicket(
  ticket: Ticket,
  config: ConfiguracionImpresora,
): Promise<void> {
  const impresora = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: config.interfaz,
    width: config.anchoMm === 80 ? 48 : 32, // caracteres por línea aproximados
  });

  const conectada = await impresora.isPrinterConnected().catch(() => false);
  if (!conectada) {
    throw new ImpresionFallidaError(`No se detecta la impresora en "${config.interfaz}"`);
  }

  for (let copia = 0; copia < ticket.copias; copia += 1) {
    for (const linea of ticket.lineas) {
      switch (linea.tipo) {
        case 'texto':
          if (linea.align === 'centro') impresora.alignCenter();
          else if (linea.align === 'derecha') impresora.alignRight();
          else impresora.alignLeft();

          if (linea.negrita) impresora.bold(true);
          if (linea.grande) impresora.setTextDoubleHeight();

          impresora.println(paraImpresora(linea.texto));

          if (linea.grande) impresora.setTextNormal();
          if (linea.negrita) impresora.bold(false);
          break;

        case 'separador':
          impresora.alignLeft();
          impresora.drawLine();
          break;

        case 'espacio':
          impresora.newLine();
          break;

        case 'firma':
          impresora.alignCenter();
          impresora.println('______________________________');
          impresora.println(paraImpresora(linea.etiqueta));
          break;

        case 'qr':
          impresora.printQR(linea.datos);
          break;
      }
    }

    impresora.cut();
    if (config.abrirGaveta) impresora.openCashDrawer();
  }

  try {
    await impresora.execute();
  } catch (error) {
    throw new ImpresionFallidaError(
      `Falló el envío a la impresora: ${error instanceof Error ? error.message : error}`,
    );
  }
}
