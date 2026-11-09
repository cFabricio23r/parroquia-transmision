/*
  Copia vicaria/ a plataforma/public/ para que Next sirva las pantallas tal cual.
  No copia vercel.json (lo lee next.config.ts) ni LEEME-config.md (es una guía para humanos).
  Escribe lib/generado/slugs-del-repo.json (junto a `public/`) con las carpetas que tienen config.json.
  Corre solo antes de `dev` y `build` (predev / prebuild).
*/
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUIDOS = new Set(['vercel.json', 'LEEME-config.md']);

export function copiarVicaria(origen, destino) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  cpSync(origen, destino, {
    recursive: true,
    filter: (ruta) => !(path.dirname(ruta) === origen && EXCLUIDOS.has(path.basename(ruta))),
  });

  const slugsDelRepo = readdirSync(origen, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(origen, e.name, 'config.json')))
    .map((e) => e.name)
    .sort();

  const carpetaGenerada = path.join(path.dirname(destino), 'lib', 'generado');
  mkdirSync(carpetaGenerada, { recursive: true });
  writeFileSync(path.join(carpetaGenerada, 'slugs-del-repo.json'), JSON.stringify(slugsDelRepo, null, 2) + '\n');

  return { slugsDelRepo };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { slugsDelRepo } = copiarVicaria(path.resolve(raiz, '..', 'vicaria'), path.join(raiz, 'public'));
  console.log('vicaria/ copiada a public/ (' + slugsDelRepo.join(', ') + ')');
}
