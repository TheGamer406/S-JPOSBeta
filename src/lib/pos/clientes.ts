import { randomUUID } from 'node:crypto';
import { eq, like, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientes } from '@/db/schema';
import { siguienteNumeroCuenta } from '@/db/contadores';
import type { esquemaCrearCliente } from './esquemas';
import type { z } from 'zod';

export class ClienteError extends Error {
  constructor(
    message: string,
    public clienteExistente?: typeof clientes.$inferSelect,
  ) {
    super(message);
  }
}

const LARGOS_CEDULA: Record<'fisica' | 'juridica' | 'dimex', [number, number]> = {
  fisica: [9, 9],
  juridica: [10, 10],
  dimex: [11, 12],
};

function normalizarCedula(cedula: string): string {
  return cedula.replace(/\D/g, '');
}

function validarCedula(cedula: string, tipo: 'fisica' | 'juridica' | 'dimex'): string {
  const normalizada = normalizarCedula(cedula);
  const [min, max] = LARGOS_CEDULA[tipo];
  if (normalizada.length < min || normalizada.length > max) {
    throw new ClienteError(
      `Cédula ${tipo} debe tener entre ${min} y ${max} dígitos (tiene ${normalizada.length})`,
    );
  }
  return normalizada;
}

/** Buscar por nombre, cédula o número de cuenta — usado en el cobro "a cuenta" (§3.3). */
export async function buscarClientes(consulta: string) {
  const comodin = `%${consulta}%`;
  return db
    .select()
    .from(clientes)
    .where(
      or(
        like(clientes.nombre, comodin),
        like(clientes.cedula, comodin),
        like(clientes.numeroCuenta, comodin),
      ),
    )
    .limit(20);
}

/**
 * Crea un cliente con su número de cuenta consecutivo (§3.6). Si la cédula ya existe,
 * no duplica: lanza ClienteError con el cliente existente para que la pantalla lo muestre.
 */
export async function crearCliente(entrada: z.infer<typeof esquemaCrearCliente>) {
  const cedulaNormalizada = validarCedula(entrada.cedula, entrada.tipoCedula);

  const [existente] = await db.select().from(clientes).where(eq(clientes.cedula, cedulaNormalizada));
  if (existente) {
    throw new ClienteError(
      `Esta cédula ya tiene la cuenta ${existente.numeroCuenta} (${existente.nombre})`,
      existente,
    );
  }

  const numeroCuenta = siguienteNumeroCuenta();
  const id = randomUUID();

  await db
    .insert(clientes)
    .values({
      id,
      numeroCuenta,
      tipo: entrada.tipo,
      nombre: entrada.nombre,
      cedula: cedulaNormalizada,
      tipoCedula: entrada.tipoCedula,
      telefono: entrada.telefono,
      organizacion: entrada.organizacion,
      contactoEncargado: entrada.contactoEncargado,
      limiteCredito: entrada.limiteCredito,
      notas: entrada.notas,
    })
    .run();

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
  return cliente;
}
