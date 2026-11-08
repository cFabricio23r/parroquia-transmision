/* Guarda: comprueba que obs/ sea idéntico al de la base de la rama multiparroquia.
   Uso: npm run verificar:obs  (sale con 0 si obs/ no cambió; con 1 si cambió). */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const BASE = '0cb6477';
const RAIZ = path.join(__dirname, '..');

function git(...args) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
  if (r.error || r.status === null) {
    console.error('No se pudo correr git: ' + (r.error ? r.error.message : 'sin código de salida'));
    process.exit(2);
  }
  return r;
}

// Archivos de obs/ distintos de la base (confirmados, sin confirmar o nuevos).
const dif = git('diff', '--name-only', BASE, '--', 'obs/');
const est = git('status', '--porcelain', '--', 'obs/');
if (dif.status > 1 || est.status !== 0) {
  console.error(dif.stderr || est.stderr);
  process.exit(2);
}
const cambios = new Set();
dif.stdout.split('\n').filter(Boolean).forEach((l) => cambios.add(l));
est.stdout.split('\n').filter(Boolean).forEach((l) => cambios.add(l.slice(3)));

if (cambios.size) {
  console.error('obs/ CAMBIÓ respecto de ' + BASE + ':');
  for (const c of cambios) console.error('  ' + c);
  process.exit(1);
}
console.log('obs/ sin cambios');
