// Corre las pruebas de navegador (Playwright) del editor contra `next dev` + Supabase LOCAL.
// Lee las llaves de `supabase status -o env`, levanta `next dev` en un puerto propio con esas
// llaves, espera a que responda, corre pruebas/navegador/*.mjs y apaga el servidor.
// No toca nunca el proyecto de la nube. Uso: npm run test:navegador [archivo.mjs ...]
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const PUERTO = process.env.PUERTO_NAVEGADOR ?? '3100';
const BASE = `http://127.0.0.1:${PUERTO}`;

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
const url = valores.API_URL ?? '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error('Las pruebas de navegador solo corren contra el Supabase local.');
  process.exit(1);
}

const entorno = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valores.PUBLISHABLE_KEY ?? '',
  SUPABASE_SECRET_KEY: valores.SECRET_KEY ?? '',
  SUPABASE_URL: url,
  SUPABASE_PUBLISHABLE_KEY: valores.PUBLISHABLE_KEY ?? '',
  SITIO_URL: BASE,
  BASE_URL: BASE,
};

// predev: copia vicaria/ a public/ (lo que hace `npm run dev`)
spawnSync(process.execPath, ['herramientas/copiar-vicaria.mjs'], { cwd: raiz, stdio: 'inherit' });

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PUERTO, '-H', '127.0.0.1'], {
  cwd: raiz,
  env: entorno,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let registro = '';
servidor.stdout.on('data', (d) => (registro += d));
servidor.stderr.on('data', (d) => (registro += d));
let servidorCaido = false;
servidor.on('exit', () => (servidorCaido = true));

function apagar() {
  if (servidorCaido) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
}
process.on('SIGINT', () => {
  apagar();
  process.exit(130);
});

async function esperarServidor() {
  const limite = Date.now() + 180_000;
  while (Date.now() < limite) {
    if (servidorCaido) throw new Error('next dev se cerró antes de responder:\n' + registro.slice(-2000));
    try {
      const r = await fetch(`${BASE}/editor/entrar`, { redirect: 'manual' });
      if (r.status === 200) return;
    } catch {
      // todavía no escucha
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error('next dev no respondió en 3 minutos:\n' + registro.slice(-2000));
}

let codigo = 1;
try {
  await esperarServidor();
  const dirPruebas = resolve(raiz, 'pruebas', 'navegador');
  const archivos = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dirPruebas).filter((f) => f.endsWith('.mjs'));
  codigo = 0;
  for (const archivo of archivos) {
    const r = spawnSync(process.execPath, [resolve(dirPruebas, archivo)], { cwd: raiz, env: entorno, stdio: 'inherit' });
    if (r.status !== 0) codigo = 1;
  }
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
} finally {
  apagar();
}
process.exit(codigo);
