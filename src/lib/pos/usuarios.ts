import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { usuarios } from '@/db/schema';
import type { esquemaActualizarUsuario, esquemaCrearUsuario } from './esquemas';
import type { z } from 'zod';

export class UsuarioError extends Error {}

/** Administrar usuarios (§3.9, §2: "administrar_usuarios" pide PIN de admin). */
export async function listarUsuarios() {
  return db.select().from(usuarios);
}

async function validarPinNoRepetido(pin: string, excluirUsuarioId?: string) {
  const activos = await db.select().from(usuarios).where(eq(usuarios.activo, true));
  const repetido = activos.some(
    (usuario) => usuario.id !== excluirUsuarioId && bcrypt.compareSync(pin, usuario.pinHash),
  );
  if (repetido) {
    throw new UsuarioError('Ese PIN ya lo usa otro usuario activo — el login no podría distinguirlos');
  }
}

export async function crearUsuario(entrada: z.infer<typeof esquemaCrearUsuario>) {
  await validarPinNoRepetido(entrada.pin);

  const id = randomUUID();
  await db
    .insert(usuarios)
    .values({
      id,
      nombre: entrada.nombre,
      rol: entrada.rol,
      pinHash: bcrypt.hashSync(entrada.pin, 10),
    })
    .run();

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  return usuario;
}

/**
 * No se puede dejar la app sin ningún admin activo — se quedaría sin forma de
 * abrir/cerrar caja ni de autorizar anulaciones (§2, §3.1, §3.4).
 */
async function esElUltimoAdminActivo(usuarioId: string): Promise<boolean> {
  const todos = await db.select().from(usuarios);
  const admin = todos.find((u) => u.id === usuarioId);
  if (!admin || admin.rol !== 'admin') return false;
  const otrosAdminsActivos = todos.filter((u) => u.id !== usuarioId && u.rol === 'admin' && u.activo);
  return otrosAdminsActivos.length === 0;
}

export async function actualizarUsuario(usuarioId: string, entrada: z.infer<typeof esquemaActualizarUsuario>) {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId));
  if (!usuario) throw new UsuarioError('Usuario no encontrado');

  if (entrada.activo === false && (await esElUltimoAdminActivo(usuarioId))) {
    throw new UsuarioError('No se puede desactivar al único admin activo');
  }

  if (entrada.pin) await validarPinNoRepetido(entrada.pin, usuarioId);

  await db
    .update(usuarios)
    .set({
      activo: entrada.activo,
      pinHash: entrada.pin ? bcrypt.hashSync(entrada.pin, 10) : undefined,
    })
    .where(eq(usuarios.id, usuarioId))
    .run();

  const [actualizado] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId));
  return actualizado;
}
