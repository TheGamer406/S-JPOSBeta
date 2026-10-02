/**
 * Plantilla para cargar pedidos programados en lote (§3.5 del plan).
 *
 * Los datos reales de S&J (nombres de empresas, encargados y qué pide cada
 * persona del personal) NO están en este repo: es público y esos son datos
 * personales de terceros (ver PLAN_POS_SJ.md §6, Ley 8968 / Prodhab). Viven
 * solo en la laptop, en `scripts/importar-pedidos-reales.ts`, que está en
 * .gitignore. Este archivo es la misma estructura con datos de ejemplo.
 *
 * Uso: npx tsx scripts/importar-pedidos-ejemplo.ts
 *
 * Alternativa sin tocar código: la pantalla /programados/nuevo importa el mismo
 * formato de hoja desde CSV (empresa,encargado,<producto>,...).
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { productos, usuarios } from '../src/db/schema';
import { crearCliente, ClienteError } from '../src/lib/pos/clientes';
import { crearPedidoProgramado } from '../src/lib/pos/programados';

const FECHAS = {
  viernes: '2026-10-02',
  sabado: '2026-10-03',
  domingo: '2026-10-04',
} as const;

type Dia = keyof typeof FECHAS;
type TiempoComida = 'almuerzo' | 'cafe' | 'cena';

interface ItemPedido {
  producto: string; // nombre exacto como está en el catálogo (seed/productos.csv)
  cantidad: number;
  nota?: string;
}

/** Empresas: un pedido por día. Cédula jurídica (10 dígitos). */
const EMPRESAS: {
  empresa: string;
  cedula: string;
  encargado?: string;
  pedidos: Partial<Record<Dia, ItemPedido[]>>;
}[] = [
  {
    empresa: 'Empresa de Ejemplo S.A.',
    cedula: '3101000001',
    encargado: 'Nombre del encargado',
    pedidos: {
      viernes: [
        { producto: 'Perro caliente', cantidad: 9 },
        { producto: 'Arroz con pollo', cantidad: 9 },
      ],
      sabado: [{ producto: 'Chifrijo', cantidad: 9 }],
    },
  },
];

/**
 * Personal: un pedido SEPARADO por persona, día y tiempo de comida. Así se
 * puede entregar el almuerzo de alguien sin tocar su café ni su cena.
 * Cédula física (9 dígitos).
 */
const PERSONAL: {
  persona: string;
  cedula: string;
  organizacion?: string;
  pedidos: Partial<Record<Dia, Partial<Record<TiempoComida, ItemPedido>>>>;
}[] = [
  {
    persona: 'Persona de Ejemplo',
    cedula: '100000001',
    organizacion: 'Organización',
    pedidos: {
      viernes: {
        cafe: { producto: 'Perro caliente', cantidad: 1, nota: 'con papas tostadas' },
        cena: { producto: 'Casado con bisteck', cantidad: 1 },
      },
      sabado: {
        almuerzo: { producto: 'Casado con carne en salsa', cantidad: 1 },
        cena: { producto: 'Chifrijo', cantidad: 1 },
      },
    },
  },
];

async function main() {
  const [admin] = await db.select().from(usuarios).where(eq(usuarios.rol, 'admin'));
  if (!admin) throw new Error('No hay ningún usuario admin — correr primero `npm run db:seed`.');

  const todosLosProductos = await db.select().from(productos);
  const idPorNombre = new Map(todosLosProductos.map((p) => [p.nombre.toLowerCase(), p.id]));

  const resolver = (items: ItemPedido[]) =>
    items.map((item) => {
      const productoId = idPorNombre.get(item.producto.toLowerCase());
      if (!productoId) throw new Error(`Producto no encontrado en el catálogo: "${item.producto}"`);
      return { productoId, cantidad: item.cantidad, nota: item.nota };
    });

  let clientes = 0;
  let pedidos = 0;

  async function obtenerOCrear(opciones: {
    tipo: 'empresa' | 'personal_nunu';
    nombre: string;
    cedula: string;
    organizacion?: string;
    contactoEncargado?: string;
  }) {
    try {
      const cliente = await crearCliente({
        ...opciones,
        tipoCedula: opciones.tipo === 'empresa' ? 'juridica' : 'fisica',
        modoPagoDefault: 'cuenta',
      });
      clientes += 1;
      return cliente;
    } catch (error) {
      // Si ya existe (misma cédula), se reutiliza en vez de duplicar.
      if (error instanceof ClienteError && error.clienteExistente) return error.clienteExistente;
      throw error;
    }
  }

  for (const empresa of EMPRESAS) {
    const cliente = await obtenerOCrear({
      tipo: 'empresa',
      nombre: empresa.empresa,
      cedula: empresa.cedula,
      organizacion: empresa.empresa,
      contactoEncargado: empresa.encargado,
    });

    for (const dia of Object.keys(empresa.pedidos) as Dia[]) {
      const items = empresa.pedidos[dia];
      if (!items?.length) continue;
      await crearPedidoProgramado(
        {
          clienteId: cliente.id,
          nombreReferencia: empresa.encargado,
          fechaProgramada: FECHAS[dia],
          tiempoComida: 'almuerzo',
          items: resolver(items),
        },
        admin.id,
      );
      pedidos += 1;
    }
  }

  for (const persona of PERSONAL) {
    const cliente = await obtenerOCrear({
      tipo: 'personal_nunu',
      nombre: persona.persona,
      cedula: persona.cedula,
      organizacion: persona.organizacion,
    });

    for (const dia of Object.keys(persona.pedidos) as Dia[]) {
      const tiempos = persona.pedidos[dia];
      if (!tiempos) continue;
      for (const tiempo of Object.keys(tiempos) as TiempoComida[]) {
        const item = tiempos[tiempo];
        if (!item) continue;
        await crearPedidoProgramado(
          { clienteId: cliente.id, fechaProgramada: FECHAS[dia], tiempoComida: tiempo, items: resolver([item]) },
          admin.id,
        );
        pedidos += 1;
      }
    }
  }

  console.log(`Listo: ${clientes} clientes nuevos y ${pedidos} pedidos programados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
