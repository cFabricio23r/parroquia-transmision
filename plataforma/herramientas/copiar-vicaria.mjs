/*
  Copia vicaria/ a plataforma/public/ para que Next sirva las pantallas tal cual.
  No copia vercel.json (lo lee next.config.ts) ni LEEME-config.md (es una guía para humanos).
  Escribe en lib/generado/ (junto a `public/`):
   - slugs-del-repo.json, con las carpetas que tienen config.json;
   - fuentes-vicaria.mjs, con el texto de parroquia.js, tipos.js y comun.js como constantes. Lo importa
     lib/validar-nucleo.mjs de forma estática: así el texto entra al bundle de las funciones de Vercel
     (un readFileSync de ../vicaria en tiempo de ejecución no se rastrea y falla en Vercel).
  Corre antes de `dev`, `build` y de cada juego de pruebas (predev / prebuild / pretest…).
*/
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUIDOS = new Set(['vercel.json', 'LEEME-config.md']);
// Los scripts clásicos que necesita validarConfig, en el orden de las páginas (CLAVES_TEXTOS necesita comun.js).
export const ARCHIVOS_VALIDACION = ['parroquia.js', 'tipos.js', 'comun.js'];

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

  const fuentes = ARCHIVOS_VALIDACION.map((a) => readFileSync(path.join(origen, a), 'utf8'));
  writeFileSync(
    path.join(carpetaGenerada, 'fuentes-vicaria.mjs'),
    '// Generado por herramientas/copiar-vicaria.mjs a partir de vicaria/. No se edita a mano.\n' +
      `export const ARCHIVOS = ${JSON.stringify(ARCHIVOS_VALIDACION)};\n` +
      `export const FUENTES = [\n${fuentes.map((texto) => '  ' + JSON.stringify(texto)).join(',\n')},\n];\n`,
  );

  return { slugsDelRepo };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { slugsDelRepo } = copiarVicaria(path.resolve(raiz, '..', 'vicaria'), path.join(raiz, 'public'));
  console.log('vicaria/ copiada a public/ (' + slugsDelRepo.join(', ') + ')');
}
