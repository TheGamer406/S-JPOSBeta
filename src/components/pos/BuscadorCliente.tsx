import { useState } from 'preact/hooks';

interface Cliente {
  id: string;
  numeroCuenta: string;
  nombre: string;
  cedula: string;
  estado: string;
}

interface BuscadorClienteProps {
  onSeleccionar: (cliente: Cliente) => void;
}

/** Buscar por nombre/cédula/n.º de cuenta, o crear al vuelo (§3.3, §3.6). */
export default function BuscadorCliente({ onSeleccionar }: BuscadorClienteProps) {
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [mostrarFormularioNuevo, setMostrarFormularioNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCedula, setNuevaCedula] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<'empresa' | 'personal_nunu' | 'otro'>('otro');
  const [nuevoTipoCedula, setNuevoTipoCedula] = useState<'fisica' | 'juridica' | 'dimex'>('fisica');
  const [error, setError] = useState<string | null>(null);

  async function buscar(texto: string) {
    setConsulta(texto);
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    const respuesta = await fetch(`/api/clientes?q=${encodeURIComponent(texto)}`);
    const cuerpo = await respuesta.json();
    setResultados(cuerpo.clientes ?? []);
  }

  async function crearCliente(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);

    const respuesta = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: nuevoTipo,
        nombre: nuevoNombre,
        cedula: nuevaCedula,
        tipoCedula: nuevoTipoCedula,
      }),
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      if (cuerpo.clienteExistente) {
        setError(cuerpo.error);
        onSeleccionar(cuerpo.clienteExistente);
        setMostrarFormularioNuevo(false);
        return;
      }
      setError(cuerpo.error ?? 'No se pudo crear el cliente');
      return;
    }

    fetch('/api/tickets/apertura-cuenta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: cuerpo.cliente.id }),
    }).catch(() => {}); // la apertura ya quedó guardada aunque falle el tiquete

    onSeleccionar(cuerpo.cliente);
    setMostrarFormularioNuevo(false);
  }

  if (mostrarFormularioNuevo) {
    return (
      <form onSubmit={crearCliente} class="flex flex-col gap-3">
        <input
          required
          placeholder="Nombre"
          value={nuevoNombre}
          onInput={(evento) => setNuevoNombre((evento.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        />
        <input
          required
          placeholder="Cédula"
          value={nuevaCedula}
          onInput={(evento) => setNuevaCedula((evento.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        />
        <select
          value={nuevoTipoCedula}
          onChange={(evento) => setNuevoTipoCedula((evento.target as HTMLSelectElement).value as typeof nuevoTipoCedula)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        >
          <option value="fisica">Física (9 dígitos)</option>
          <option value="juridica">Jurídica (10 dígitos)</option>
          <option value="dimex">DIMEX (11-12 dígitos)</option>
        </select>
        <select
          value={nuevoTipo}
          onChange={(evento) => setNuevoTipo((evento.target as HTMLSelectElement).value as typeof nuevoTipo)}
          class="rounded bg-[var(--background_color_2)] px-3 py-2"
        >
          <option value="empresa">Empresa</option>
          <option value="personal_nunu">Personal NUNU</option>
          <option value="otro">Otro</option>
        </select>
        {error && <p class="text-[var(--principal-color)]">{error}</p>}
        <div class="flex gap-2">
          <button type="submit" class="boton-pos flex-1 rounded bg-[var(--principal-color)] font-bold">
            Crear cuenta
          </button>
          <button
            type="button"
            onClick={() => setMostrarFormularioNuevo(false)}
            class="boton-pos rounded bg-[var(--background_color_2)] px-4"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div class="flex flex-col gap-2">
      <input
        placeholder="Buscar por nombre, cédula o n.º de cuenta"
        value={consulta}
        onInput={(evento) => buscar((evento.target as HTMLInputElement).value)}
        class="rounded bg-[var(--background_color_2)] px-3 py-2"
      />
      <ul class="flex max-h-48 flex-col gap-1 overflow-auto">
        {resultados.map((cliente) => (
          <li key={cliente.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(cliente)}
              class="w-full rounded bg-[var(--background_color_2)] px-3 py-2 text-left hover:bg-[var(--accent_color)]"
            >
              {cliente.numeroCuenta} — {cliente.nombre}
              {cliente.estado === 'bloqueado' && (
                <span class="ml-2 text-[var(--principal-color)]">(bloqueado)</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setMostrarFormularioNuevo(true)}
        class="rounded border border-dashed border-[var(--text_color_2)] px-3 py-2 text-[var(--text_color_2)]"
      >
        + Nuevo cliente
      </button>
    </div>
  );
}
