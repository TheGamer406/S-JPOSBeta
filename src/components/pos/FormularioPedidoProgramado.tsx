import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import BuscadorCliente from './BuscadorCliente';

interface Categoria {
  id: string;
  nombre: string;
  orden: number;
}
interface Producto {
  id: string;
  categoriaId: string;
  nombre: string;
  precio: number;
}
interface Cliente {
  id: string;
  numeroCuenta: string;
  nombre: string;
}

const TIEMPOS = [
  { valor: 'almuerzo', etiqueta: 'Almuerzo' },
  { valor: 'cafe', etiqueta: 'Café' },
  { valor: 'cena', etiqueta: 'Cena' },
] as const;

/** Alta de un pedido programado (§3.5): una empresa, un día, cantidades por producto. */
export default function FormularioPedidoProgramado() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [encargado, setEncargado] = useState('');
  const [fecha, setFecha] = useState('');
  const [tiempoComida, setTiempoComida] = useState<'almuerzo' | 'cafe' | 'cena'>('almuerzo');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [csv, setCsv] = useState('');
  const [reporteImportacion, setReporteImportacion] = useState<{
    creados: number;
    errores: { fila: number; empresa: string; motivo: string }[];
    columnasDesconocidas: string[];
  } | null>(null);

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then((cuerpo) => {
        setCategorias(cuerpo.categorias);
        setProductos(cuerpo.productos);
      });
  }, []);

  const total = productos.reduce((suma, producto) => suma + producto.precio * (Number(cantidades[producto.id]) || 0), 0);

  async function crearPedido(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);
    setExito(null);

    if (!cliente) {
      setError('Elegí una empresa');
      return;
    }

    const items = productos
      .map((producto) => ({ productoId: producto.id, cantidad: Number(cantidades[producto.id]) || 0 }))
      .filter((item) => item.cantidad > 0);

    if (items.length === 0) {
      setError('Poné al menos una cantidad');
      return;
    }

    const respuesta = await fetch('/api/programados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: cliente.id, nombreReferencia: encargado || undefined, fechaProgramada: fecha, tiempoComida, items }),
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo crear el pedido');
      return;
    }

    setExito(`Pedido creado para ${cliente.nombre} el ${fecha}.`);
    setCantidades({});
  }

  async function importar(evento: SubmitEvent) {
    evento.preventDefault();
    setReporteImportacion(null);
    const respuesta = await fetch('/api/programados/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, fechaProgramada: fecha, tiempoComida }),
    });
    const cuerpo = await respuesta.json();
    setReporteImportacion(cuerpo);
  }

  return (
    <div class="flex flex-col gap-8 p-4 lg:flex-row">
      <form onSubmit={crearPedido} class="flex w-full flex-col gap-4 lg:w-96">
        <h2 class="marca text-2xl">Pedido manual</h2>

        <label class="flex flex-col gap-1">
          <span class="text-[var(--text_color_2)]">Empresa</span>
          <BuscadorCliente onSeleccionar={(c) => setCliente(c)} />
          {cliente && <p class="font-bold">{cliente.numeroCuenta} — {cliente.nombre}</p>}
        </label>

        <input
          placeholder="Encargado"
          value={encargado}
          onInput={(e) => setEncargado((e.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        />

        <div class="flex gap-2">
          <input
            type="date"
            required
            value={fecha}
            onInput={(e) => setFecha((e.target as HTMLInputElement).value)}
            class="flex-1 rounded bg-[var(--background_color_2)] px-3 py-2"
          />
          <select
            value={tiempoComida}
            onChange={(e) => setTiempoComida((e.target as HTMLSelectElement).value as typeof tiempoComida)}
            class="rounded bg-[var(--background_color_2)] px-3 py-2"
          >
            {TIEMPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>

        {categorias.map((categoria) => (
          <div key={categoria.id}>
            <h3 class="mb-1 font-bold">{categoria.nombre}</h3>
            <ul class="flex flex-col divide-y divide-[var(--background_color_2)]">
              {productos
                .filter((producto) => producto.categoriaId === categoria.id)
                .map((producto) => (
                  <li key={producto.id} class="flex items-center justify-between gap-2 py-1">
                    <span class="flex-1">{producto.nombre}</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={cantidades[producto.id] ?? ''}
                      onInput={(e) => setCantidades((c) => ({ ...c, [producto.id]: (e.target as HTMLInputElement).value }))}
                      class="w-20 rounded bg-[var(--background_color_2)] px-2 py-1 text-right"
                    />
                  </li>
                ))}
            </ul>
          </div>
        ))}

        <p class="monto text-xl font-bold text-[var(--gold)]">Total: {formatoCRC(total)}</p>

        {error && <p class="text-[var(--principal-color)]">{error}</p>}
        {exito && <p class="text-[var(--accent_color)]">{exito}</p>}

        <button type="submit" class="boton-pos rounded-lg bg-[var(--principal-color)] text-xl font-bold">
          Crear pedido
        </button>
      </form>

      <form onSubmit={importar} class="flex w-full flex-col gap-3 lg:w-96">
        <h2 class="marca text-2xl">Importar desde hoja (CSV)</h2>
        <p class="text-sm text-[var(--text_color_2)]">
          Primera fila: <code>empresa,encargado,{'<producto 1>'},{'<producto 2>'}...</code>. Las demás filas son una
          empresa por fila con las cantidades. Usa el mismo día/tiempo de comida de arriba.
        </p>
        <textarea
          value={csv}
          onInput={(e) => setCsv((e.target as HTMLTextAreaElement).value)}
          placeholder={'empresa,encargado,Perro caliente,Arroz con pollo\nVindi,Marco,10,0\nPMI,Ana,0,5'}
          rows={10}
          class="rounded bg-[var(--background_color_2)] px-3 py-2 font-mono text-sm"
        />
        <button type="submit" class="boton-pos rounded-lg bg-[var(--accent_color)] font-bold">
          Importar
        </button>

        {reporteImportacion && (
          <div class="rounded bg-[var(--background_color_2)] p-3">
            <p class="font-bold">{reporteImportacion.creados} pedidos creados.</p>
            {reporteImportacion.columnasDesconocidas.length > 0 && (
              <p class="text-[var(--principal-color)]">
                Columnas sin producto conocido: {reporteImportacion.columnasDesconocidas.join(', ')}
              </p>
            )}
            {reporteImportacion.errores.length > 0 && (
              <ul class="mt-2 text-sm text-[var(--principal-color)]">
                {reporteImportacion.errores.map((err) => (
                  <li key={err.fila}>
                    Fila {err.fila} ({err.empresa}): {err.motivo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
