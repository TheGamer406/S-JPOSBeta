import { useEffect, useState } from 'preact/hooks';
import { formatoCRC } from '@/lib/dinero';
import ModalCobro, { type ItemCarrito } from './ModalCobro';
import VistaPreviaTicket from './VistaPreviaTicket';

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
  agotado: boolean;
}

export default function PantallaVenta() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [nombreReferencia, setNombreReferencia] = useState('');
  const [tipoCambioUsd, setTipoCambioUsd] = useState(500);
  const [mostrarCobro, setMostrarCobro] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<{ html: string; aviso?: string } | null>(null);

  useEffect(() => {
    fetch('/api/productos')
      .then((respuesta) => respuesta.json())
      .then((cuerpo) => {
        setCategorias(cuerpo.categorias);
        setProductos(cuerpo.productos);
        setCategoriaActiva(cuerpo.categorias[0]?.id ?? null);
      });
    fetch('/api/caja')
      .then((respuesta) => respuesta.json())
      .then((cuerpo) => cuerpo.sesion && setTipoCambioUsd(cuerpo.sesion.tipoCambioUsd));
  }, []);

  function agregarAlCarrito(producto: Producto) {
    if (producto.agotado) return;
    setCarrito((actual) => {
      const existente = actual.find((item) => item.productoId === producto.id);
      if (existente) {
        return actual.map((item) =>
          item.productoId === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item,
        );
      }
      return [...actual, { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 }];
    });
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((actual) =>
      actual
        .map((item) => (item.productoId === productoId ? { ...item, cantidad: item.cantidad + delta } : item))
        .filter((item) => item.cantidad > 0),
    );
  }

  function cambiarNota(productoId: string, nota: string) {
    setCarrito((actual) => actual.map((item) => (item.productoId === productoId ? { ...item, nota } : item)));
  }

  async function marcarAgotado(producto: Producto) {
    const nuevoEstado = !producto.agotado;
    await fetch('/api/productos/agotado', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId: producto.id, agotado: nuevoEstado }),
    });
    setProductos((actual) =>
      actual.map((item) => (item.id === producto.id ? { ...item, agotado: nuevoEstado } : item)),
    );
  }

  async function alConfirmarVenta(ventaId: string, avisoLimite?: string) {
    setMostrarCobro(false);
    setCarrito([]);
    setNombreReferencia('');

    const respuesta = await fetch('/api/tickets/venta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventaId }),
    });
    const emision = await respuesta.json();
    const aviso = [avisoLimite, emision.error].filter(Boolean).join(' · ');
    if (emision.html) {
      setVistaPrevia({ html: emision.html, aviso: aviso || undefined });
    } else if (avisoLimite) {
      setVistaPrevia({ html: '', aviso: avisoLimite });
    }
  }

  const total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  const productosVisibles = productos.filter((producto) => producto.categoriaId === categoriaActiva);

  return (
    <div class="flex h-screen flex-col lg:flex-row">
      <div class="flex flex-1 flex-col gap-3 overflow-auto p-4">
        <div class="flex gap-2 overflow-x-auto">
          {categorias.map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              onClick={() => setCategoriaActiva(categoria.id)}
              class={`boton-pos whitespace-nowrap rounded-full px-5 ${
                categoria.id === categoriaActiva ? 'bg-[var(--principal-color)]' : 'bg-[var(--background_color_2)]'
              }`}
            >
              {categoria.nombre}
            </button>
          ))}
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {productosVisibles.map((producto) => (
            <div key={producto.id} class="relative">
              <button
                type="button"
                disabled={producto.agotado}
                onClick={() => agregarAlCarrito(producto)}
                class={`boton-pos w-full flex-col items-center justify-center rounded-xl p-3 text-center ${
                  producto.agotado
                    ? 'bg-[var(--background_color_2)] opacity-40'
                    : 'bg-[var(--background_color_2)] active:bg-[var(--accent_color)]'
                }`}
              >
                <div class="font-bold">{producto.nombre}</div>
                <div class="monto text-[var(--gold)]">{formatoCRC(producto.precio)}</div>
                {producto.agotado && <div class="text-[var(--principal-color)]">AGOTADO</div>}
              </button>
              <button
                type="button"
                onClick={() => marcarAgotado(producto)}
                class="absolute right-1 top-1 rounded bg-black/60 px-2 text-xs"
              >
                {producto.agotado ? 'disponible' : 'agotado'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div class="flex w-full flex-col gap-3 bg-[var(--background_color_2)] p-4 lg:w-96">
        <input
          placeholder="Nombre o mesa (opcional)"
          value={nombreReferencia}
          onInput={(evento) => setNombreReferencia((evento.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        />

        <ul class="flex flex-1 flex-col gap-2 overflow-auto">
          {carrito.map((item) => (
            <li key={item.productoId} class="rounded bg-[var(--background_color_1)] p-2">
              <div class="flex items-center justify-between">
                <span>{item.nombre}</span>
                <span class="monto text-[var(--gold)]">{formatoCRC(item.precio * item.cantidad)}</span>
              </div>
              <div class="mt-1 flex items-center gap-2">
                <button type="button" onClick={() => cambiarCantidad(item.productoId, -1)} class="rounded bg-[var(--background_color_2)] px-3">
                  −
                </button>
                <span>{item.cantidad}</span>
                <button type="button" onClick={() => cambiarCantidad(item.productoId, 1)} class="rounded bg-[var(--background_color_2)] px-3">
                  +
                </button>
                <input
                  placeholder="nota"
                  value={item.nota ?? ''}
                  onInput={(evento) => cambiarNota(item.productoId, (evento.target as HTMLInputElement).value)}
                  class="flex-1 rounded bg-[var(--background_color_2)] px-2 text-sm"
                />
              </div>
            </li>
          ))}
        </ul>

        <p class="monto text-right text-3xl font-bold text-[var(--gold)]">{formatoCRC(total)}</p>

        <button
          type="button"
          disabled={carrito.length === 0}
          onClick={() => setMostrarCobro(true)}
          class="boton-pos rounded-lg bg-[var(--principal-color)] text-xl font-bold disabled:opacity-40"
        >
          Cobrar
        </button>
      </div>

      {mostrarCobro && (
        <ModalCobro
          items={carrito}
          total={total}
          tipoCambioUsd={tipoCambioUsd}
          nombreReferencia={nombreReferencia || undefined}
          onConfirmado={alConfirmarVenta}
          onCancelar={() => setMostrarCobro(false)}
        />
      )}

      {vistaPrevia && (
        <VistaPreviaTicket html={vistaPrevia.html} aviso={vistaPrevia.aviso} onCerrar={() => setVistaPrevia(null)} />
      )}
    </div>
  );
}
