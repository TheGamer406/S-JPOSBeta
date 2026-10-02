import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [preact()],
  server: {
    host: true, // permite conexión desde tablets en la red local (ver §8 del plan)
    port: 4321,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
