import { db } from '@/db/client';
import { clientes, productos } from '@/db/schema';
import { crearPedidoProgramado } from './programados';

export interface ErrorFilaImportacion {
  fila: number;
  empresa: string;
  motivo: string;
}

export interface ResultadoImportacion {
  creados: number;
  errores: ErrorFilaImportacion[];
  columnasDesconocidas: string[];
}

function parsearLineaCsv(linea: string): string[] {
  return linea.split(',').map((valor) => valor.trim());
}

/**
 * Importa pedidos programados desde el mismo formato de hoja que ya usan hoy
 * (§3.5): filas = empresas, columnas = productos. Encabezado esperado:
 * `empresa,encargado,<producto 1>,<producto 2>,...` — las celdas son cantidades.
 * Una fila con error (empresa no encontrada, etc.) no tumba el resto del archivo.
 */
export async function importarProgramadosCsv(
  csvTexto: string,
  fechaProgramada: string,
  tiempoComida: 'almuerzo' | 'cafe' | 'cena',
  usuarioId: string,
): Promise<ResultadoImportacion> {
  const lineas = csvTexto.trim().split('\n').filter((linea) => linea.trim().length > 0);
  if (lineas.length < 2) {
    return { creados: 0, errores: [], columnasDesconocidas: [] };
  }

  const encabezado = parsearLineaCsv(lineas[0]);
  const columnasProducto = encabezado.slice(2); // después de "empresa" y "encargado"

  const todosLosClientes = await db.select().from(clientes);
  const todosLosProductos = await db.select().from(productos);

  const clientePorNombreONumero = new Map(
    todosLosClientes.flatMap((cliente) => [
      [cliente.nombre.toLowerCase(), cliente],
      [cliente.numeroCuenta.toLowerCase(), cliente],
    ]),
  );
  const productoPorNombre = new Map(todosLosProductos.map((producto) => [producto.nombre.toLowerCase(), producto]));

  const columnasDesconocidas = columnasProducto.filter(
    (nombre) => nombre && !productoPorNombre.has(nombre.toLowerCase()),
  );

  const errores: ErrorFilaImportacion[] = [];
  let creados = 0;

  for (let indice = 1; indice < lineas.length; indice += 1) {
    const celdas = parsearLineaCsv(lineas[indice]);
    const empresaTexto = celdas[0] ?? '';
    const encargado = celdas[1] || undefined;

    const cliente = clientePorNombreONumero.get(empresaTexto.toLowerCase());
    if (!cliente) {
      errores.push({ fila: indice + 1, empresa: empresaTexto, motivo: `Cliente "${empresaTexto}" no encontrado` });
      continue;
    }

    const items = columnasProducto
      .map((nombreProducto, columna) => {
        const producto = productoPorNombre.get(nombreProducto.toLowerCase());
        const cantidad = Number(celdas[columna + 2]) || 0;
        return producto && cantidad > 0 ? { productoId: producto.id, cantidad } : null;
      })
      .filter((item): item is { productoId: string; cantidad: number } => item !== null);

    if (items.length === 0) {
      errores.push({ fila: indice + 1, empresa: empresaTexto, motivo: 'Sin cantidades en esta fila' });
      continue;
    }

    try {
      await crearPedidoProgramado(
        { clienteId: cliente.id, nombreReferencia: encargado, fechaProgramada, tiempoComida, items },
        usuarioId,
      );
      creados += 1;
    } catch (error) {
      errores.push({
        fila: indice + 1,
        empresa: empresaTexto,
        motivo: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { creados, errores, columnasDesconocidas };
}
