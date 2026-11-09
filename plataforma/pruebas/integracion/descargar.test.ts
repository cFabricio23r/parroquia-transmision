// El build trae lo publicado: descargar-publicado contra el Supabase LOCAL, con la clave publicable.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { clienteServicio, crearParroquia, crearUsuario, hacerMiembro, limpiarStorage, sufijo, type UsuarioPrueba } from './ayudas';
import { publicar } from '../../lib/publicar';
import { RESERVADOS, descargarPublicado, escribir } from '../../herramientas/descargar-publicado.mjs';

const servicio = clienteServicio();
const URL_LOCAL = process.env.SUPABASE_URL ?? '';
const CLAVE_PUBLICABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const CLAVE = 'clave-de-prueba-123';

const { esquema, version, publicado, slug: _slug, ...BASE } = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
void esquema, void version, void publicado, void _slug;

let png: Buffer;
let usuario: UsuarioPrueba;
let destino: string;
const subidos: string[] = []; // rutas en `publicado` que esta prueba escribió a mano (las parroquias publicadas las borra limpiarStorage)
async function quitarSubidos(): Promise<void> {
  const rutas = subidos.splice(0);
  if (rutas.length) {
    const { error } = await servicio.storage.from('publicado').remove(rutas);
    expect(error).toBeNull();
  }
}
const servidores: Server[] = [];

const ENTRADA = (slugsDelRepo: string[] = ['ciudad-arce', 'san-jose-ejemplo']) => ({
  url: URL_LOCAL,
  clave: CLAVE_PUBLICABLE,
  destino,
  slugsDelRepo,
});

/** Publica de verdad con la Tarea 8: una parroquia con borrador completo y sus tres imágenes. */
async function parroquiaPublicada(): Promise<{ slug: string; config: any }> {
  const p = await crearParroquia('des');
  const s = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  for (const n of [`logo-blanco-${s}.png`, `logo-color-${s}.png`, `fachada-${s}.png`]) {
    const { error } = await servicio.storage.from('borradores').upload(`${p.id}/${n}`, png, { contentType: 'image/png' });
    expect(error).toBeNull();
  }
  const config = {
    ...structuredClone(BASE),
    logos: {
      blanco: { src: `medios/logo-blanco-${s}.png`, alt: 'Logo en blanco' },
      color: { src: `medios/logo-color-${s}.png`, alt: 'Logo a color' },
    },
    fachada: { src: `medios/fachada-${s}.png`, alt: 'Fachada' },
    patrono: { ...BASE.patrono, imagen: { src: `medios/fachada-${s}.png`, alt: 'Misma imagen' } },
  };
  await servicio.from('borradores').update({ config }).eq('parroquia_id', p.id);
  await hacerMiembro(p.id, usuario.id);
  const r = await publicar({ sesion: usuario.cliente, servicio }, p.slug);
  expect(r.estado).toBe(200);
  const { data } = await servicio.storage.from('publicado').download(`${p.slug}/config.json`);
  const publicada = JSON.parse(await data!.text());
  return { slug: p.slug, config: publicada };
}

/** Escribe a mano un config.json (y lo que haga falta) en `publicado/<carpeta>/`. */
async function subirConfig(carpeta: string, config: unknown): Promise<void> {
  const ruta = `${carpeta}/config.json`;
  const { error } = await servicio.storage.from('publicado').upload(ruta, Buffer.from(JSON.stringify(config)), {
    contentType: 'application/json',
    upsert: true,
  });
  expect(error).toBeNull();
  subidos.push(ruta);
}

const escuchar = (estado: number): Promise<string> =>
  new Promise((ok) => {
    const s = createServer((_q, r) => {
      r.statusCode = estado;
      r.end('{}');
    });
    servidores.push(s);
    s.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
  });

beforeAll(async () => {
  png = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#336699' } }).png().toBuffer();
  usuario = await crearUsuario(`des-${sufijo()}@prueba.test`, CLAVE);
}, 60_000);

afterAll(async () => {
  await quitarSubidos();
  await limpiarStorage(); // publicado/<slug>/ y borradores/<id>/ de las parroquias creadas aquí
  await Promise.all(servidores.map((s) => new Promise((ok) => s.close(ok))));
}, 60_000);

describe('descargar-publicado', () => {
  // Limpieza aunque una aserción falle: la carpeta temporal y lo subido a mano en publicado/ (algo roto
  // que quedara haría fallar las pruebas siguientes y el build local).
  afterEach(async () => {
    vi.restoreAllMocks();
    if (destino) rmSync(destino, { recursive: true, force: true });
    await quitarSubidos();
  }, 60_000);

  const nuevoDestino = () => {
    destino = mkdtempSync(path.join(tmpdir(), 'descargar-'));
    return destino;
  };
  /** Espera que falle nombrando la parroquia y el motivo, sin escribir nada en el destino. */
  async function fallaNombrando(slug: string, motivo: string | RegExp) {
    const error = await descargarPublicado(ENTRADA()).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(error, 'tenía que fallar').toBeInstanceOf(Error);
    expect(error!.message).toContain(`la parroquia «${slug}» no se puede traer`);
    if (typeof motivo === 'string') expect(error!.message).toContain(motivo);
    else expect(error!.message).toMatch(motivo);
    expect(readdirSync(destino)).toEqual([]); // ni la parroquia rota ni las buenas: todo o nada
  }

  it('escribe public/<slug>/config.json y sus imágenes', async () => {
    const p = await parroquiaPublicada();
    nuevoDestino();
    const r = await descargarPublicado(ENTRADA());
    expect(r.parroquias).toContain(p.slug);
    expect(JSON.parse(readFileSync(path.join(destino, p.slug, 'config.json'), 'utf8'))).toEqual(p.config);
    const archivos = readdirSync(path.join(destino, p.slug, 'medios')).sort();
    expect(archivos).toHaveLength(3);
    for (const a of archivos) expect(a).toMatch(/^v1-/);
    const { data } = await servicio.storage.from('publicado').download(`${p.slug}/${p.config.fachada.src}`);
    expect(readFileSync(path.join(destino, p.slug, p.config.fachada.src)).equals(Buffer.from(await data!.arrayBuffer()))).toBe(true);
  }, 60_000);

  it('al repetirse borra lo viejo de la parroquia y no toca otras carpetas del destino', async () => {
    const p = await parroquiaPublicada();
    nuevoDestino();
    mkdirSync(path.join(destino, p.slug, 'medios'), { recursive: true });
    writeFileSync(path.join(destino, p.slug, 'medios', 'v0-viejo-00000000.png'), 'x');
    mkdirSync(path.join(destino, 'ciudad-arce'), { recursive: true });
    writeFileSync(path.join(destino, 'ciudad-arce', 'config.json'), 'del repo');
    await descargarPublicado(ENTRADA());
    expect(existsSync(path.join(destino, p.slug, 'medios', 'v0-viejo-00000000.png'))).toBe(false);
    expect(readFileSync(path.join(destino, 'ciudad-arce', 'config.json'), 'utf8')).toBe('del repo');
  }, 60_000);

  it('falla y nombra la parroquia si un config.json publicado no es válido', async () => {
    await parroquiaPublicada();
    const mala = `inv-${sufijo()}`;
    await subirConfig(mala, { esquema: 1, slug: mala, nombre: '' });
    nuevoDestino();
    await fallaNombrando(mala, /config\.json no es válido/);
  }, 60_000);

  it('falla y nombra la parroquia si su config.json no es JSON', async () => {
    const mala = `json-${sufijo()}`;
    const { error } = await servicio.storage
      .from('publicado')
      .upload(`${mala}/config.json`, Buffer.from('{ no es json'), { contentType: 'application/json' });
    expect(error).toBeNull();
    subidos.push(`${mala}/config.json`);
    nuevoDestino();
    await fallaNombrando(mala, /no es JSON válido/);
  }, 60_000);

  it('falla y nombra la parroquia si su carpeta no tiene config.json', async () => {
    const sola = `solo-${sufijo()}`;
    const ruta = `${sola}/medios/v1-fachada-0a1b2c3d.png`;
    const { error } = await servicio.storage.from('publicado').upload(ruta, png, { contentType: 'image/png' });
    expect(error).toBeNull();
    subidos.push(ruta);
    nuevoDestino();
    await fallaNombrando(sola, /no tiene config\.json/);
  }, 60_000);

  it('falla y nombra la parroquia si su config nombra una imagen que no tiene el formato de lo publicado (no la baja)', async () => {
    const buena = await parroquiaPublicada();
    const slug = `src-${sufijo()}`;
    await subirConfig(slug, { ...structuredClone(buena.config), slug, fachada: { src: 'medios/fachada.png', alt: 'Fachada' } });
    nuevoDestino();
    await fallaNombrando(slug, 'medios/fachada.png');
  }, 60_000);

  it('falla y nombra la parroquia si un src es MEDIOS/… (validarConfig no distingue mayúsculas, el formato publicado sí)', async () => {
    const buena = await parroquiaPublicada();
    const slug = `may-${sufijo()}`;
    await subirConfig(slug, { ...structuredClone(buena.config), slug, fachada: { src: 'MEDIOS/Fachada.PNG', alt: 'Fachada' } });
    nuevoDestino();
    await fallaNombrando(slug, 'MEDIOS/Fachada.PNG');
  }, 60_000);

  it('falla y nombra la parroquia si una imagen que nombra no existe en publicado (404)', async () => {
    const buena = await parroquiaPublicada();
    const slug = `sinimg-${sufijo()}`;
    await subirConfig(slug, { ...structuredClone(buena.config), slug }); // sus medios/v1-… no existen bajo este slug
    nuevoDestino();
    await fallaNombrando(slug, /imagen.*no está en publicado/);
  }, 60_000);

  it('falla y nombra la carpeta si su nombre no es un slug válido o es una ruta reservada', async () => {
    const buena = await parroquiaPublicada();
    const casos: Array<[string, RegExp]> = [
      ['Mal_Slug', /no es un slug válido/],
      ['img', /ruta reservada/],
    ];
    for (const [carpeta, motivo] of casos) {
      await subirConfig(carpeta, { ...structuredClone(buena.config), slug: carpeta });
      nuevoDestino();
      await fallaNombrando(carpeta, motivo);
      await quitarSubidos();
      rmSync(destino, { recursive: true, force: true });
    }
  }, 60_000);

  it('falla si un slug publicado coincide con una carpeta de vicaria/', async () => {
    const p = await parroquiaPublicada();
    nuevoDestino();
    await expect(descargarPublicado(ENTRADA([p.slug]))).rejects.toThrow(`el slug ${p.slug} existe en vicaria/ y en Supabase`);
  }, 60_000);

  it('sin Supabase (puerto cerrado) falla con un mensaje claro', async () => {
    nuevoDestino();
    await expect(descargarPublicado({ ...ENTRADA(), url: 'http://127.0.0.1:1' })).rejects.toThrow(/Supabase/);
  });

  it('si Supabase responde un error de servidor falla', async () => {
    nuevoDestino();
    const url = await escuchar(500);
    await expect(descargarPublicado({ ...ENTRADA(), url })).rejects.toThrow(/Supabase/);
  });

  it('sin url o sin clave falla antes de llamar', async () => {
    nuevoDestino();
    await expect(descargarPublicado({ ...ENTRADA(), url: '' })).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    await expect(descargarPublicado({ ...ENTRADA(), clave: '' })).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});

describe('descargar-publicado: guardias sin Supabase', () => {
  it('escribir no deja salir ningún archivo de destino/<slug>/', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'guardia-'));
    try {
      expect(() =>
        escribir(tmp, 'una', { texto: Buffer.from('{}'), imagenes: [{ nombre: 'medios/../../fuera.png', contenido: Buffer.from('x') }] }),
      ).toThrow(/fuera de la carpeta/);
      expect(existsSync(path.join(tmp, 'fuera.png'))).toBe(false);
      expect(existsSync(path.join(tmp, '..', 'fuera.png'))).toBe(false);
      escribir(tmp, 'una', { texto: Buffer.from('{}'), imagenes: [{ nombre: 'medios/v1-a-0a1b2c3d.png', contenido: Buffer.from('x') }] });
      expect(existsSync(path.join(tmp, 'una', 'medios', 'v1-a-0a1b2c3d.png'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('RESERVADOS es la misma lista que lib/slug.ts', () => {
    const fuente = readFileSync(new URL('../../lib/slug.ts', import.meta.url), 'utf8');
    const lista = /const RESERVADOS = \[([^\]]*)\]/.exec(fuente)![1].split(',').map((t) => t.trim().replace(/^'|'$/g, ''));
    expect([...RESERVADOS].sort()).toEqual(lista.sort());
  });
});
