import { useEffect, useState } from 'preact/hooks';

interface Item {
  nombreSnapshot: string;
  cantidad: number;
  nota: string | null;
}

interface Venta {
  id: string;
  numeroOrdenDia: number | null;
  nombreReferencia: string | null;
  estadoPedido: 'pendiente' | 'preparacion' | 'listo' | 'entregado' | 'anulado';
  creadoEn: string;
}

interface Pedido {
  venta: Venta;
  items: Item[];
}

const SIGUIENTE_ESTADO: Record<string, { estado: 'preparacion' | 'listo' | 'entregado'; etiqueta: string }> = {
  pendiente: { estado: 'preparacion', etiqueta: 'En preparación' },
  preparacion: { estado: 'listo', etiqueta: 'Listo' },
  listo: { estado: 'entregado', etiqueta: 'Entregado' },
};

const MINUTOS_ALERTA = 15;

/**
 * Pantalla de cocina (§2, §3.4): solo la cola de pedidos, sin montos ni medios de
 * pago — cocina no ve dinero. Pensada para quedarse abierta en una tablet o TV.
 */
export default function VistaCocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  async function cargar() {
    const respuesta = await fetch('/api/pedidos');
    const cuerpo = await respuesta.json();
    setPedidos(cuerpo.pedidos ?? []);
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 5000);
    return () => clearInterval(intervalo);
  }, []);

  async function avanzarEstado(ventaId: string, estado: 'preparacion' | 'listo' | 'entregado') {
    await fetch('/api/pedidos/estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ventaId, estado }),
    });
    cargar();
  }

  const activos = pedidos.filter(({ venta }) => venta.estadoPedido !== 'entregado' && venta.estadoPedido !== 'anulado');

  return (
    <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {activos.map(({ venta, items }) => {
        const minutos = (Date.now() - new Date(venta.creadoEn).getTime()) / 60000;
        const tarde = minutos > MINUTOS_ALERTA;
        const siguiente = SIGUIENTE_ESTADO[venta.estadoPedido];

        return (
          <div key={venta.id} class={`rounded-xl p-5 ${tarde ? 'bg-[var(--principal-color)]' : 'bg-[var(--background_color_2)]'}`}>
            <div class="flex items-center justify-between">
              <span class="text-3xl font-bold">
                {venta.numeroOrdenDia ? `#${String(venta.numeroOrdenDia).padStart(3, '0')}` : 'Programado'}
              </span>
              <span class="text-xl">{Math.round(minutos)} min</span>
            </div>
            {venta.nombreReferencia && <p class="text-xl">{venta.nombreReferencia}</p>}
            <ul class="mt-3 flex flex-col gap-1 text-2xl">
              {items.map((item, indice) => (
                <li key={indice}>
                  {item.cantidad}x {item.nombreSnapshot}
                  {item.nota && <em class="block text-lg"> {item.nota}</em>}
                </li>
              ))}
            </ul>

            {siguiente && (
              <button
                type="button"
                onClick={() => avanzarEstado(venta.id, siguiente.estado)}
                class="boton-pos mt-4 w-full rounded-lg bg-[var(--accent_color)] text-xl font-bold"
              >
                {siguiente.etiqueta}
              </button>
            )}
          </div>
        );
      })}
      {activos.length === 0 && <p class="text-xl text-[var(--text_color_2)]">No hay pedidos pendientes.</p>}
    </div>
  );
}
