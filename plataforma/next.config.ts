import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

/*
  vicaria/vercel.json es la única fuente de verdad de los rewrites y headers de las pantallas
  (también la lee herramientas/servidor-vicaria.js). Aquí se devuelven tal cual.
*/
const reglas = JSON.parse(readFileSync(path.join(process.cwd(), '..', 'vicaria', 'vercel.json'), 'utf8'));

const config: NextConfig = {
  // El repo tiene otro package-lock.json en la raíz; se fija la raíz de Turbopack aquí.
  turbopack: { root: process.cwd() },
  async rewrites() {
    return reglas.rewrites ?? [];
  },
  async headers() {
    return reglas.headers ?? [];
  },
};

export default config;
