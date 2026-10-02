import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/client';
import { categorias, productos, usuarios } from '../src/db/schema';

const csvPath = fileURLToPath(new URL('./productos.csv', import.meta.url));
const lineas = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1); // sin encabezado

const categoriaIdPorNombre = new Map<string, string>();
let ordenCategoria = 0;

for (const linea of lineas) {
  const [nombreCategoria, nombreProducto, precioTexto, ordenTexto] = linea.split(',');

  if (!categoriaIdPorNombre.has(nombreCategoria)) {
    const id = randomUUID();
    categoriaIdPorNombre.set(nombreCategoria, id);
    db.insert(categorias)
      .values({ id, nombre: nombreCategoria, orden: ordenCategoria })
      .run();
    ordenCategoria += 1;
  }

  db.insert(productos)
    .values({
      id: randomUUID(),
      categoriaId: categoriaIdPorNombre.get(nombreCategoria)!,
      nombre: nombreProducto,
      precio: Number(precioTexto),
      orden: Number(ordenTexto),
    })
    .run();
}

console.log(`Sembrados ${categoriaIdPorNombre.size} categorías y ${lineas.length} productos.`);

// Usuario admin inicial — CAMBIAR el PIN antes del primer evento real.
// Se puede fijar con SJ_POS_ADMIN_PIN=1234 npm run db:seed
const pinAdminInicial = process.env.SJ_POS_ADMIN_PIN ?? '0000';

db.insert(usuarios)
  .values({
    id: randomUUID(),
    nombre: 'Admin',
    rol: 'admin',
    pinHash: bcrypt.hashSync(pinAdminInicial, 10),
    activo: true,
  })
  .run();

console.log(
  `Usuario Admin creado con PIN "${pinAdminInicial}". Cámbialo en Administración antes del evento.`,
);
