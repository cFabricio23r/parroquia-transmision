// Corre las pruebas de integración contra el Supabase LOCAL.
// Lee las llaves de `supabase status -o env` y las pasa a vitest con los
// nombres que usa ayudas.ts. No toca nunca el proyecto de la nube.
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let salida;
try {
  salida = execFileSync(npx, ['supabase', 'status', '-o', 'env'], {
    cwd: raiz,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
} catch {
  console.error('No pude leer «supabase status». ¿Está corriendo? Usa «npx supabase start» (hace falta Docker Desktop).');
  process.exit(1);
}

const valores = {};
for (const linea of salida.split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) valores[m[1]] = m[2];
}

const entorno = {
  ...process.env,
  SUPABASE_URL: valores.API_URL ?? '',
  SUPABASE_PUBLISHABLE_KEY: valores.PUBLISHABLE_KEY ?? '',
  SUPABASE_SECRET_KEY: valores.SECRET_KEY ?? '',
};

const r = spawnSync(
  npx,
  ['vitest', 'run', '--config', 'vitest.config.ts', '--passWithNoTests', 'pruebas/integracion', ...process.argv.slice(2)],
  { cwd: raiz, env: entorno, stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(r.status ?? 1);
