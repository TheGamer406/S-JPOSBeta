import { defineMiddleware } from 'astro:middleware';

/**
 * Importar el cliente de base de datos acá garantiza que se abra (y se migre,
 * ver client.ts) en la primera petición que reciba el servidor, sea cual sea.
 *
 * Antes dependía de que la primera pantalla visitada usara la base: la de login
 * no la usa, así que en la app empaquetada se llegaba al PIN con la base vacía
 * y sin tablas. Esto lo evita sin tener que acordarse de qué ruta toca qué.
 */
import '@/db/client';

export const onRequest = defineMiddleware((_contexto, siguiente) => siguiente());
