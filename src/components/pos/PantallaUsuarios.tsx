import { useEffect, useState } from 'preact/hooks';

interface Usuario {
  id: string;
  nombre: string;
  rol: 'admin' | 'cajero' | 'cocina';
  activo: boolean;
  creadoEn: string;
}

const NOMBRE_ROL: Record<Usuario['rol'], string> = {
  admin: 'Admin',
  cajero: 'Cajero',
  cocina: 'Cocina',
};

/** Administrar usuarios (§3.9): solo admin, con PIN propio para entrar aquí. */
export default function PantallaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Usuario['rol']>('cajero');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const respuesta = await fetch('/api/admin/usuarios');
    const cuerpo = await respuesta.json();
    setUsuarios(cuerpo.usuarios ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);

    const respuesta = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, rol, pin }),
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo crear el usuario');
      return;
    }

    setNombre('');
    setPin('');
    setRol('cajero');
    cargar();
  }

  async function cambiarActivo(id: string, activo: boolean) {
    setError(null);
    const respuesta = await fetch(`/api/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? 'No se pudo actualizar');
      return;
    }
    cargar();
  }

  async function cambiarPin(id: string) {
    const nuevoPin = prompt('Nuevo PIN (4-6 dígitos):');
    if (!nuevoPin) return;
    setError(null);

    const respuesta = await fetch(`/api/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: nuevoPin }),
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) setError(cuerpo.error ?? 'No se pudo cambiar el PIN');
  }

  return (
    <div class="flex flex-col gap-6 p-4">
      <h1 class="marca text-3xl">Usuarios</h1>

      <form onSubmit={crear} class="flex flex-wrap items-end gap-2 rounded-xl bg-[var(--background_color_2)] p-4">
        <input
          placeholder="Nombre"
          required
          value={nombre}
          onInput={(e) => setNombre((e.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        />
        <select
          value={rol}
          onChange={(e) => setRol((e.target as HTMLSelectElement).value as Usuario['rol'])}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        >
          <option value="cajero">Cajero</option>
          <option value="cocina">Cocina</option>
          <option value="admin">Admin</option>
        </select>
        <input
          placeholder="PIN (4-6 dígitos)"
          required
          value={pin}
          onInput={(e) => setPin((e.target as HTMLInputElement).value)}
          class="rounded bg-[var(--background_color_1)] px-3 py-2"
        />
        <button type="submit" class="boton-pos rounded bg-[var(--principal-color)] font-bold">
          Crear usuario
        </button>
      </form>

      {error && <p class="text-[var(--principal-color)]">{error}</p>}

      <ul class="flex flex-col gap-2">
        {usuarios.map((u) => (
          <li key={u.id} class="flex items-center justify-between rounded bg-[var(--background_color_2)] px-4 py-3">
            <span>
              <strong>{u.nombre}</strong> — {NOMBRE_ROL[u.rol]}
              {!u.activo && <span class="ml-2 text-[var(--principal-color)]">(inactivo)</span>}
            </span>
            <div class="flex gap-2">
              <button type="button" onClick={() => cambiarPin(u.id)} class="rounded bg-[var(--background_color_1)] px-3 py-1 text-sm">
                Cambiar PIN
              </button>
              <button
                type="button"
                onClick={() => cambiarActivo(u.id, !u.activo)}
                class="rounded bg-[var(--background_color_1)] px-3 py-1 text-sm"
              >
                {u.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
