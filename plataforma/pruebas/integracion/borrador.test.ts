// Guardar el borrador y subir imágenes, contra el Supabase LOCAL, con clientes con sesión real.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerAdmin,
  hacerMiembro,
  limpiarStorage,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';
import { guardarBorrador, subirImagen, type EntradaImagen } from '../../lib/borrador';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';

type Parroquia = { id: string; slug: string };
let A: Parroquia;
let B: Parroquia;
let cA: UsuarioPrueba;
let cB: UsuarioPrueba;
let admin: UsuarioPrueba;

// Un borrador con bloques de la 1b: tienen que sobrevivir a cualquier guardado de identidad.
const BLOQUES = {
  avisos: [{ texto: 'Misa especial', desde: '2026-12-01', hasta: '2026-12-02' }],
  pantallas: { inicio: { imagen: 'fachada' } },
  tipos: { propios: [] },
};

async function leer(p: Parroquia) {
  const { data, error } = await servicio.from('borradores').select('*').eq('parroquia_id', p.id).single();
  expect(error).toBeNull();
  return data as { config: Record<string, unknown>; actualizado_en: string; actualizado_por: string | null };
}

const imagen = (campo: string, bytes: Uint8Array): (() => Promise<EntradaImagen>) => async () => ({ campo, bytes });

async function archivosDe(p: Parroquia): Promise<string[]> {
  const { data, error } = await servicio.storage.from('borradores').list(p.id);
  expect(error).toBeNull();
  return (data ?? []).map((f) => f.name);
}

// Lo que este archivo subió a Storage no queda en la base local (el build local lo bajaría).
afterAll(() => limpiarStorage(), 60_000);

beforeAll(async () => {
  A = await crearParroquia('bor-a');
  B = await crearParroquia('bor-b');
  cA = await crearUsuario(`bor-ca-${sufijo()}@prueba.test`, CLAVE);
  cB = await crearUsuario(`bor-cb-${sufijo()}@prueba.test`, CLAVE);
  admin = await crearUsuario(`bor-admin-${sufijo()}@prueba.test`, CLAVE);
  await hacerMiembro(A.id, cA.id);
  await hacerMiembro(B.id, cB.id);
  await hacerAdmin(admin.id);
  const { error } = await servicio
    .from('borradores')
    .update({ config: { nombre: 'Original', lugar: 'Lugar original', ...BLOQUES } })
    .eq('parroquia_id', A.id);
  expect(error).toBeNull();
}, 60_000);

describe('guardarBorrador', () => {
  it('guarda, conserva los bloques de la 1b y devuelve el actualizadoEn nuevo de la base y los errores', async () => {
    const antes = await leer(A);
    const r = await guardarBorrador(cA.cliente, A.slug, { cambios: { lugar: 'Ciudad Arce' }, actualizadoEn: antes.actualizado_en });
    expect(r.estado).toBe(200);
    const cuerpo = r.cuerpo as { actualizadoEn: string; errores: string[] };
    const despues = await leer(A);
    expect(despues.config).toEqual({ nombre: 'Original', lugar: 'Ciudad Arce', ...BLOQUES });
    expect(new Date(cuerpo.actualizadoEn).getTime()).toBe(new Date(despues.actualizado_en).getTime());
    expect(new Date(despues.actualizado_en).getTime()).toBeGreaterThan(new Date(antes.actualizado_en).getTime());
    expect(despues.actualizado_por).toBe(cA.id);
    // Guardar con errores está permitido; publicar no. Faltan colores, logos, etc.
    expect(cuerpo.errores.length).toBeGreaterThan(0);
    expect(cuerpo.errores.join(' ')).toContain('colores');
  });

  it('el servidor sella actualizado_en y actualizado_por: el cliente no los decide', async () => {
    const r = await cA.cliente
      .from('borradores')
      .update({ config: { nombre: 'Sellado' }, actualizado_en: '2000-01-01T00:00:00Z', actualizado_por: cB.id })
      .eq('parroquia_id', A.id)
      .select('actualizado_en, actualizado_por')
      .single();
    expect(r.error).toBeNull();
    expect(new Date(r.data!.actualizado_en).getFullYear()).toBeGreaterThan(2020);
    expect(r.data!.actualizado_por).toBe(cA.id);
    // restaura el borrador de la prueba
    await servicio.from('borradores').update({ config: { nombre: 'Original', lugar: 'Ciudad Arce', ...BLOQUES } }).eq('parroquia_id', A.id);
  });

  it('config tiene que ser un objeto JSON', async () => {
    for (const malo of [[], 'texto', 5, null]) {
      const { error } = await servicio.from('borradores').update({ config: malo }).eq('parroquia_id', A.id);
      // 23514: viola el check (borradores_config_objeto); 23502: not null
      expect(error?.code, JSON.stringify(malo)).toBe(malo === null ? '23502' : '23514');
    }
  });

  it('guardar con actualizado_en viejo devuelve conflicto y el borrador no cambia', async () => {
    const inicial = await leer(A);
    const primero = await guardarBorrador(cA.cliente, A.slug, { cambios: { lugar: 'Primero' }, actualizadoEn: inicial.actualizado_en });
    expect(primero.estado).toBe(200);
    const trasPrimero = await leer(A);

    // Otra pestaña, con el valor viejo
    const segundo = await guardarBorrador(cA.cliente, A.slug, { cambios: { lugar: 'Segundo' }, actualizadoEn: inicial.actualizado_en });
    expect(segundo.estado).toBe(409);
    expect((segundo.cuerpo as { error: string }).error).toContain('Otra persona guardó');
    expect(await leer(A)).toEqual(trasPrimero);
  });

  it('dos guardados a la vez con el mismo actualizadoEn: uno gana y el otro recibe 409', async () => {
    const inicial = await leer(A);
    const [x, y] = await Promise.all([
      guardarBorrador(cA.cliente, A.slug, { cambios: { lugar: 'Carrera X' }, actualizadoEn: inicial.actualizado_en }),
      guardarBorrador(admin.cliente, A.slug, { cambios: { lugar: 'Carrera Y' }, actualizadoEn: inicial.actualizado_en }),
    ]);
    expect([x.estado, y.estado].sort()).toEqual([200, 409]);
    const ganador = x.estado === 200 ? 'Carrera X' : 'Carrera Y';
    expect((await leer(A)).config.lugar).toBe(ganador);
  });

  it('sin sesión devuelve 401', async () => {
    const antes = await leer(A);
    const r = await guardarBorrador(clienteAnonimo(), A.slug, { cambios: { lugar: 'Intruso' }, actualizadoEn: antes.actualizado_en });
    expect(r.estado).toBe(401);
    expect(await leer(A)).toEqual(antes);
  });

  it('un coordinador de B recibe 403 al guardar en A, y la base no cambia', async () => {
    const antes = await leer(A);
    const r = await guardarBorrador(cB.cliente, A.slug, { cambios: { lugar: 'De B' }, actualizadoEn: antes.actualizado_en });
    expect(r.estado).toBe(403);
    expect(await leer(A)).toEqual(antes);
    // una parroquia que no existe da lo mismo: no se filtra qué slugs existen
    const nada = await guardarBorrador(cB.cliente, `no-existe-${sufijo()}`, { cambios: {}, actualizadoEn: antes.actualizado_en });
    expect(nada.estado).toBe(403);
  });

  it('un administrador puede guardar en cualquier parroquia', async () => {
    const antes = await leer(B);
    const r = await guardarBorrador(admin.cliente, B.slug, { cambios: { lugar: 'Por el admin' }, actualizadoEn: antes.actualizado_en });
    expect(r.estado).toBe(200);
    expect((await leer(B)).config.lugar).toBe('Por el admin');
  });

  it('rechaza con 400 una petición mal hecha sin tocar nada', async () => {
    const antes = await leer(A);
    const casos: unknown[] = [
      null,
      'texto',
      { cambios: [], actualizadoEn: antes.actualizado_en },
      { cambios: { lugar: 'x' } },
      { cambios: { lugar: 'x' }, actualizadoEn: 'no-es-fecha' },
      { cambios: { lugar: 'x'.repeat(200_000) }, actualizadoEn: antes.actualizado_en },
    ];
    for (const caso of casos) {
      const r = await guardarBorrador(cA.cliente, A.slug, caso);
      expect(r.estado, JSON.stringify(caso)?.slice(0, 60)).toBe(400);
    }
    expect(await leer(A)).toEqual(antes);
  });
});

describe('subirImagen', () => {
  const RE_SRC = /^medios\/(fachada|logo-blanco)-[0-9a-f]{8}\.(png|jpg|webp|svg)$/;

  it('subir un JPEG con GPS deja en borradores un archivo sin EXIF y devuelve una URL firmada', async () => {
    const conGps = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#336699' } })
      .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '4/1 0/1 0/1' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(conGps).metadata()).exif).toBeDefined(); // el fixture sí trae EXIF

    const r = await subirImagen(cA.cliente, A.slug, imagen('fachada', new Uint8Array(conGps)));
    expect(r.estado).toBe(200);
    const { src, url } = r.cuerpo as { src: string; url: string };
    expect(src).toMatch(RE_SRC);
    expect(src.endsWith('.jpg')).toBe(true);

    const descarga = await servicio.storage.from('borradores').download(`${A.id}/${src.replace('medios/', '')}`);
    expect(descarga.error).toBeNull();
    const guardado = Buffer.from(await descarga.data!.arrayBuffer());
    const meta = await sharp(guardado).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();

    // La URL firmada sirve para mostrar la imagen, y es de esa carpeta
    expect(url).toContain(`/${A.id}/`);
    const web = await fetch(url);
    expect(web.status).toBe(200);
    expect(Buffer.from(await web.arrayBuffer()).equals(guardado)).toBe(true);
  });

  it('un coordinador de B recibe 403 al subir una imagen en A, y no queda nada subido', async () => {
    const antes = await archivosDe(A);
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#112233' } }).png().toBuffer();
    let leyo = false;
    const r = await subirImagen(cB.cliente, A.slug, async () => {
      leyo = true;
      return { campo: 'fachada', bytes: new Uint8Array(png) };
    });
    expect(r.estado).toBe(403);
    expect(leyo).toBe(false); // el permiso se mira antes de leer el archivo
    expect(await archivosDe(A)).toEqual(antes);
  });

  it('sin sesión devuelve 401', async () => {
    const r = await subirImagen(clienteAnonimo(), A.slug, imagen('fachada', new Uint8Array([1, 2, 3])));
    expect(r.estado).toBe(401);
  });

  it('un administrador sube a cualquier parroquia', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#112233' } }).png().toBuffer();
    const r = await subirImagen(admin.cliente, B.slug, imagen('logo-blanco', new Uint8Array(png)));
    expect(r.estado).toBe(200);
    const { src } = r.cuerpo as { src: string };
    expect(src).toMatch(RE_SRC);
    expect(await archivosDe(B)).toContain(src.replace('medios/', ''));
  });

  it('rechaza con 400 lo que no es imagen, el campo raro y el archivo ausente', async () => {
    const antes = await archivosDe(A);
    const texto = await subirImagen(cA.cliente, A.slug, imagen('fachada', new TextEncoder().encode('hola')));
    expect(texto.estado).toBe(400);
    expect((texto.cuerpo as { error: string }).error).toContain('no es una imagen');

    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#112233' } }).png().toBuffer();
    for (const campo of ['../x', 'Fachada', '', 'a'.repeat(40)]) {
      const r = await subirImagen(cA.cliente, A.slug, imagen(campo, new Uint8Array(png)));
      expect(r.estado, campo).toBe(400);
    }
    const sin = await subirImagen(cA.cliente, A.slug, async () => ({ error: 'Falta el archivo de la imagen.' }));
    expect(sin.estado).toBe(400);
    expect(await archivosDe(A)).toEqual(antes);
  });
});
