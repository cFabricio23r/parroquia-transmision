/*
  Trae lo publicado al build: baja de `publicado/` (Supabase) el config.json de cada parroquia y las
  imágenes que nombra, y los escribe en public/<slug>/ para que Next los sirva como archivos estáticos.
  Corre solo antes de `build` (prebuild), después de copiar-vicaria.mjs.

  Usa solo la clave publicable: el bucket `publicado` es de lectura pública y el build no necesita
  la clave secreta (nunca debe tenerla).

  Todo lo que no se puede traer FALLA (código ≠ 0 y una línea `ERROR:` con el motivo; Vercel conserva
  el despliegue anterior). Nunca se omite una parroquia: cada build parte de un public/ limpio, así que
  una parroquia que se saltara perdería su config.json y sus imágenes en el despliegue nuevo y sus pantallas
  dejarían de funcionar. Falla si:
   - faltan las variables, Supabase no responde o contesta un error (listar, bajar un config.json o
     una imagen), o un slug publicado existe también en vicaria/;
   - una parroquia (el error la nombra) tiene un slug que no es válido o está reservado, no tiene
     config.json o no valida, nombra una imagen con forma rara, o una imagen que nombra no existe (404).
*/
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarConfig } from '../lib/validar-nucleo.mjs';

// Mismas reglas que lib/slug.ts (que es TypeScript y este script no puede importar).
const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESERVADOS = ['editor', 'api', 'auth', '_next', 'fuentes', 'img', 'medios'];
// El formato que publica lib/publicar.ts: medios/v<N>-<campo>-<8 hex>.<ext>
const RE_MEDIO = /^medios\/v\d+-[a-z0-9-]+-[0-9a-f]{8}\.(png|jpg|webp|svg)$/;
const TAM_PAGINA = 100;

/** Una parroquia publicada que no se puede traer. Siempre hace fallar el build (ver arriba). */
class ParroquiaRota extends Error {}

const motivoDeSlug = (slug) =>
  slug.length < 3 || slug.length > 40 || !RE_SLUG.test(slug)
    ? 'el nombre de la carpeta no es un slug válido (3 a 40 caracteres: minúsculas, números y guiones)'
    : RESERVADOS.includes(slug)
      ? 'el slug es una ruta reservada del sistema'
      : null;

const falloSupabase = (que, error) =>
  new Error(`No se pudo ${que} en Supabase: ${error?.message || error?.originalError?.message || 'sin respuesta'}`);

const noExiste = (error) => Number(error?.statusCode) === 404 || Number(error?.status) === 404;

/** Todos los `src` (texto) del config, en cualquier parte. validarConfig solo admite rutas `medios/…` (sin distinguir mayúsculas), así que todos deben tener el formato publicado. */
function mediosDe(valor, salida = new Set()) {
  if (Array.isArray(valor)) valor.forEach((v) => mediosDe(v, salida));
  else if (valor !== null && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      if (clave === 'src' && typeof v === 'string') salida.add(v);
      else mediosDe(v, salida);
    }
  }
  return salida;
}

async function bajar(bucket, ruta, que) {
  const { data, error } = await bucket.download(ruta);
  if (error && noExiste(error)) return null;
  if (error || !data) throw falloSupabase(`bajar ${que}`, error);
  return Buffer.from(await data.arrayBuffer());
}

/** Descarga una parroquia a memoria. Lanza `ParroquiaRota` (con el motivo) si no se puede publicar; los dos casos hacen fallar el build. */
async function traer(bucket, slug) {
  const motivo = motivoDeSlug(slug);
  if (motivo) throw new ParroquiaRota(motivo);

  const texto = await bajar(bucket, `${slug}/config.json`, `${slug}/config.json`);
  if (!texto) throw new ParroquiaRota('no tiene config.json');
  let config;
  try {
    config = JSON.parse(texto.toString('utf8'));
  } catch {
    throw new ParroquiaRota('su config.json no es JSON válido');
  }
  const { errores } = validarConfig(config, slug);
  if (errores.length) throw new ParroquiaRota(`su config.json no es válido: ${errores.join(' · ')}`);

  const imagenes = [];
  const medios = [...mediosDe(config)];
  for (const m of medios) {
    if (!RE_MEDIO.test(m)) throw new ParroquiaRota(`nombra la imagen «${m}», que no tiene el formato de lo publicado (medios/v<N>-…)`);
  }
  for (const m of medios) {
    const contenido = await bajar(bucket, `${slug}/${m}`, `la imagen ${slug}/${m}`);
    if (!contenido) throw new ParroquiaRota(`nombra la imagen «${m}», que no está en publicado/`);
    imagenes.push({ nombre: m, contenido });
  }
  return { texto, imagenes };
}

/** Escribe una parroquia ya descargada, borrando antes lo que hubiera de ella (sin dejar `v<N>-` viejos). */
export function escribir(destino, slug, { texto, imagenes }) {
  const carpeta = path.join(destino, slug);
  rmSync(carpeta, { recursive: true, force: true });
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(path.join(carpeta, 'config.json'), texto);
  for (const { nombre, contenido } of imagenes) {
    const archivo = path.resolve(carpeta, nombre);
    // Cinturón y tirantes: el formato ya excluye `..` y `/` extra, pero nada puede salir de la carpeta.
    if (!archivo.startsWith(path.resolve(carpeta) + path.sep)) throw new Error(`ruta fuera de la carpeta: ${nombre}`);
    mkdirSync(path.dirname(archivo), { recursive: true });
    writeFileSync(archivo, contenido);
  }
}

export async function descargarPublicado({ url, clave, destino, slugsDelRepo }) {
  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL: el build necesita la dirección de Supabase para traer lo publicado.');
  if (!clave) throw new Error('Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: el build necesita la clave publicable para traer lo publicado.');
  const bucket = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from('publicado');

  // Las carpetas de primer nivel son las parroquias (en la lista salen con id null).
  const slugs = [];
  for (let offset = 0; ; offset += TAM_PAGINA) {
    const { data, error } = await bucket.list('', { limit: TAM_PAGINA, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) throw falloSupabase('listar lo publicado', error);
    slugs.push(...data.filter((e) => e.id === null).map((e) => e.name));
    if (data.length < TAM_PAGINA) break;
  }

  const repetidos = slugs.filter((s) => slugsDelRepo.includes(s));
  if (repetidos.length) throw new Error(`el slug ${repetidos[0]} existe en vicaria/ y en Supabase: renombra o borra una de las dos.`);

  // Primero se baja todo a memoria y solo después se escribe: si una parroquia falla, no queda nada a medias.
  const traidas = [];
  for (const slug of slugs) {
    try {
      traidas.push([slug, await traer(bucket, slug)]);
    } catch (e) {
      if (e instanceof ParroquiaRota) throw new Error(`la parroquia «${slug}» no se puede traer: ${e.message.replace(/\.$/, '')}. Corrígela o bórrala de publicado/.`);
      throw e;
    }
  }
  for (const [slug, datos] of traidas) escribir(destino, slug, datos);
  return { parroquias: traidas.map(([slug]) => slug) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const { default: slugsDelRepo } = await import('../lib/generado/slugs-del-repo.json', { with: { type: 'json' } });
    const { parroquias } = await descargarPublicado({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      destino: path.join(raiz, 'public'),
      slugsDelRepo,
    });
    console.log(`publicado/ traído a public/ (${parroquias.join(', ') || 'ninguna parroquia'})`);
  } catch (e) {
    console.error(`ERROR: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
