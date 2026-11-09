// Publicar, restaurar y avisar a Vercel, contra el Supabase LOCAL con sesiones reales.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerAdmin,
  hacerMiembro,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';
import { publicar, restaurar } from '../../lib/publicar';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';
type Parroquia = { id: string; slug: string };

const { esquema, version, publicado, slug: _slug, ...BASE } = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
void esquema, void version, void publicado, void _slug;

let png: Buffer;
let cA: UsuarioPrueba;
let cB: UsuarioPrueba;
let admin: UsuarioPrueba;
let hook500: Server;
let hook200: Server;
let urlHook500 = '';
let urlHook200 = '';
const golpes = { 500: 0, 200: 0 };

const escuchar = (estado: 200 | 500): Promise<Server> =>
  new Promise((ok) => {
    const s = createServer((_q, r) => {
      golpes[estado]++;
      r.statusCode = estado;
      r.end();
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
const urlDe = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}/hook/secreto-${sufijo()}`;
const cerrar = (s: Server) => new Promise((ok) => s.close(ok));

/** Parroquia con un borrador completo y sus tres imágenes (reales) en borradores/<id>/. */
async function parroquiaLista(propietario: UsuarioPrueba | null = cA): Promise<Parroquia & { archivos: string[] }> {
  const p = await crearParroquia('pub');
  const s = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  const nombres = { blanco: `logo-blanco-${s}.png`, color: `logo-color-${s}.png`, fachada: `fachada-${s}.png` };
  for (const n of Object.values(nombres)) {
    const { error } = await servicio.storage.from('borradores').upload(`${p.id}/${n}`, png, { contentType: 'image/png' });
    expect(error).toBeNull();
  }
  const config = {
    ...structuredClone(BASE),
    logos: {
      blanco: { src: `medios/${nombres.blanco}`, alt: 'Logo en blanco' },
      color: { src: `medios/${nombres.color}`, alt: 'Logo a color' },
    },
    fachada: { src: `medios/${nombres.fachada}`, alt: 'Fachada' },
    patrono: { ...BASE.patrono, imagen: { src: `medios/${nombres.fachada}`, alt: 'Misma imagen' } },
  };
  const { error } = await servicio.from('borradores').update({ config }).eq('parroquia_id', p.id);
  expect(error).toBeNull();
  if (propietario) await hacerMiembro(p.id, propietario.id);
  return { ...p, archivos: Object.values(nombres) };
}

const borradorDe = async (p: Parroquia) =>
  (await servicio.from('borradores').select('*').eq('parroquia_id', p.id).single()).data as {
    config: object;
    actualizado_en: string;
    actualizado_por: string | null;
  };
const versionesDe = async (p: Parroquia) =>
  ((await servicio.from('versiones').select('*').eq('parroquia_id', p.id).order('numero')).data ?? []) as {
    numero: number;
    config: any;
    publicada_por: string | null;
    origen_numero: number | null;
  }[];
const registroDe = async (p: Parroquia, accion: string) =>
  ((await servicio.from('registro').select('*').eq('parroquia_id', p.id).eq('accion', accion).order('id')).data ?? []) as {
    usuario_id: string | null;
    detalle: Record<string, unknown>;
  }[];
const ultimaVersion = async (p: Parroquia) =>
  (await servicio.from('parroquias').select('ultima_version').eq('id', p.id).single()).data?.ultima_version;
async function configPublicado(p: Parroquia): Promise<any | null> {
  const { data } = await servicio.storage.from('publicado').download(`${p.slug}/config.json`);
  return data ? JSON.parse(await data.text()) : null;
}
async function mediosPublicados(p: Parroquia): Promise<string[]> {
  const { data } = await servicio.storage.from('publicado').list(`${p.slug}/medios`);
  return (data ?? []).map((f) => f.name).sort();
}
const deps = (u: UsuarioPrueba, hookUrl?: string) => ({ sesion: u.cliente, servicio, hookUrl });
const sinSesion = () => ({ sesion: clienteAnonimo(), servicio });
const silenciar = () => vi.spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
  png = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#336699' } }).png().toBuffer();
  cA = await crearUsuario(`pub-ca-${sufijo()}@prueba.test`, CLAVE);
  cB = await crearUsuario(`pub-cb-${sufijo()}@prueba.test`, CLAVE);
  admin = await crearUsuario(`pub-admin-${sufijo()}@prueba.test`, CLAVE);
  await hacerAdmin(admin.id);
  hook500 = await escuchar(500);
  hook200 = await escuchar(200);
  urlHook500 = urlDe(hook500);
  urlHook200 = urlDe(hook200);
}, 60_000);

afterAll(async () => {
  await Promise.all([cerrar(hook500), cerrar(hook200)]);
});

describe('publicar', () => {
  it('un borrador incompleto devuelve 422 con los errores y no crea versión ni reserva número', async () => {
    const p = await crearParroquia('pub-inc'); // borrador { titulo, color }: incompleto
    await hacerMiembro(p.id, cA.id);
    const r = await publicar(deps(cA), p.slug);
    expect(r.estado).toBe(422);
    expect((r.cuerpo as { errores: string[] }).errores.length).toBeGreaterThan(0);
    expect(await versionesDe(p)).toEqual([]);
    expect(await ultimaVersion(p)).toBe(0);
    expect(await configPublicado(p)).toBeNull();
  });

  it('un src de medios/ con nombre raro da 422 antes de reservar número y sin copiar nada', async () => {
    const p = await parroquiaLista();
    const b = await borradorDe(p);
    const config = { ...b.config, fachada: { src: 'medios/fachada.png', alt: 'Fachada' } };
    await servicio.from('borradores').update({ config }).eq('parroquia_id', p.id);
    const r = await publicar(deps(cA), p.slug);
    expect(r.estado).toBe(422);
    expect((r.cuerpo as { errores: string[] }).errores.join(' ')).toContain('medios/fachada.png');
    expect(await versionesDe(p)).toEqual([]);
    expect(await ultimaVersion(p)).toBe(0);
    expect(await mediosPublicados(p)).toEqual([]);
  });

  it('publicar dos veces deja versiones 1 y 2, config.json con version 2, las imágenes v1- y v2- y el borrador intacto', async () => {
    const p = await parroquiaLista();
    const antes = await borradorDe(p);
    const r1 = await publicar(deps(cA), p.slug);
    expect(r1).toEqual({ estado: 200, cuerpo: { numero: 1, hook: 'sin-configurar' } });
    expect((await configPublicado(p)).version).toBe(1);
    const r2 = await publicar(deps(cA), p.slug);
    expect(r2.cuerpo).toEqual({ numero: 2, hook: 'sin-configurar' });

    const versiones = await versionesDe(p);
    expect(versiones.map((v) => [v.numero, v.origen_numero, v.publicada_por])).toEqual([
      [1, null, cA.id],
      [2, null, cA.id],
    ]);
    const config = await configPublicado(p);
    expect(config).toMatchObject({ esquema: 1, version: 2, slug: p.slug });
    expect(config.fachada.src).toMatch(/^medios\/v2-fachada-[0-9a-f]{8}\.png$/);
    expect(config.patrono.imagen.src).toBe(config.fachada.src);
    expect(versiones[1].config).toEqual(config); // lo que quedó en la tabla es lo que quedó publicado
    expect(versiones[0].config.fachada.src).toMatch(/^medios\/v1-/);
    expect(await mediosPublicados(p)).toEqual(p.archivos.flatMap((a) => [`v1-${a}`, `v2-${a}`]).sort());
    const { data: copia } = await servicio.storage.from('publicado').download(`${p.slug}/medios/v2-${p.archivos[0]}`);
    expect(Buffer.from(await copia!.arrayBuffer()).equals(png)).toBe(true);
    // El borrador no cambió: ni el contenido ni el sello (un UPDATE le daría un 409 falso al editor abierto).
    expect(await borradorDe(p)).toEqual(antes);
    expect((await registroDe(p, 'publicar')).map((f) => [f.usuario_id, f.detalle])).toEqual([
      [cA.id, { numero: 1 }],
      [cA.id, { numero: 2 }],
    ]);
  });

  it('con el hook caído deja la versión publicada y responde hook: fallo, sin escribir la URL en el registro ni en la consola', async () => {
    const p = await parroquiaLista();
    const espia = silenciar();
    const antes = golpes[500];
    const r = await publicar(deps(cA, urlHook500), p.slug);
    const consola = JSON.stringify(espia.mock.calls);
    espia.mockRestore();
    expect(r).toEqual({ estado: 200, cuerpo: { numero: 1, hook: 'fallo' } });
    expect(golpes[500]).toBe(antes + 1);
    expect((await versionesDe(p)).map((v) => v.numero)).toEqual([1]);
    expect((await configPublicado(p)).version).toBe(1);
    const secreto = new URL(urlHook500).pathname;
    expect(consola).not.toContain(secreto);
    expect(consola).not.toContain(new URL(urlHook500).port);
    const filas = JSON.stringify(await registroDe(p, 'publicar'));
    expect(filas).not.toContain(secreto);
    expect(filas).not.toContain('hook');
  });

  it('con el hook en marcha responde hook: ok; con una URL que nadie escucha, hook: fallo', async () => {
    const p = await parroquiaLista();
    const antes = golpes[200];
    expect((await publicar(deps(cA, urlHook200), p.slug)).cuerpo).toEqual({ numero: 1, hook: 'ok' });
    expect(golpes[200]).toBe(antes + 1);
    const cerrado = await escuchar(200);
    const urlCerrada = urlDe(cerrado);
    await cerrar(cerrado);
    const espia = silenciar();
    const r = await publicar(deps(cA, urlCerrada), p.slug);
    expect(JSON.stringify(espia.mock.calls)).not.toContain(new URL(urlCerrada).port);
    espia.mockRestore();
    expect(r.cuerpo).toEqual({ numero: 2, hook: 'fallo' });
  });

  it('si falla una copia (la imagen no está en borradores) responde 500, no deja versión y no toca config.json', async () => {
    const p = await parroquiaLista();
    expect((await publicar(deps(cA), p.slug)).estado).toBe(200); // v1 publicada
    const publicadaAntes = await configPublicado(p);
    await servicio.storage.from('borradores').remove([`${p.id}/${p.archivos[1]}`]);
    const espia = silenciar();
    const r = await publicar(deps(cA), p.slug);
    espia.mockRestore();
    expect(r.estado).toBe(500);
    expect((r.cuerpo as { error: string }).error).toMatch(/Intenta de nuevo/);
    expect((await versionesDe(p)).map((v) => v.numero)).toEqual([1]);
    expect(await configPublicado(p)).toEqual(publicadaAntes);
    // lo que ya se había copiado de la versión 2 no queda huérfano
    expect(await mediosPublicados(p)).toEqual(p.archivos.map((a) => `v1-${a}`).sort());
  });

  it('si el destino de una copia ya existe (se reusó un número) es un error: 500 y config.json intacto', async () => {
    const p = await parroquiaLista();
    expect((await publicar(deps(cA), p.slug)).estado).toBe(200);
    const publicadaAntes = await configPublicado(p);
    // Ocupa un nombre de la versión 3 y salta la 2 reservándola a mano (los huecos se aceptan).
    await servicio.rpc('reservar_version', { p: p.id });
    const { error } = await servicio.storage.from('publicado').upload(`${p.slug}/medios/v3-${p.archivos[0]}`, png, { contentType: 'image/png' });
    expect(error).toBeNull();
    const espia = silenciar();
    const r = await publicar(deps(cA), p.slug);
    espia.mockRestore();
    expect(r.estado).toBe(500);
    expect((await versionesDe(p)).map((v) => v.numero)).toEqual([1]);
    expect(await configPublicado(p)).toEqual(publicadaAntes);
    expect(await mediosPublicados(p)).toContain(`v3-${p.archivos[0]}`); // el que ya estaba no se borra
  });

  it('sin sesión da 401 y un coordinador de B no puede publicar A (403); un administrador sí', async () => {
    const p = await parroquiaLista();
    expect((await publicar(sinSesion(), p.slug)).estado).toBe(401);
    const r = await publicar(deps(cB), p.slug);
    expect(r.estado).toBe(403);
    expect(await versionesDe(p)).toEqual([]);
    expect(await ultimaVersion(p)).toBe(0);
    expect(await configPublicado(p)).toBeNull();
    expect((await publicar(deps(admin), p.slug)).estado).toBe(200);
    expect((await versionesDe(p))[0].publicada_por).toBe(admin.id);
  });
});

describe('restaurar', () => {
  it('restaurar la 1 crea la 3 con origen_numero 1, el config.json apunta a las imágenes v1- y el borrador no cambia', async () => {
    const p = await parroquiaLista();
    await publicar(deps(cA), p.slug);
    await publicar(deps(cA), p.slug);
    const antes = await borradorDe(p);
    const medios = await mediosPublicados(p);
    const v1 = (await versionesDe(p))[0];

    const r = await restaurar(deps(cA), p.slug, 1);
    expect(r).toEqual({ estado: 200, cuerpo: { numero: 3, hook: 'sin-configurar' } });
    const versiones = await versionesDe(p);
    expect(versiones.map((v) => [v.numero, v.origen_numero, v.publicada_por])).toEqual([
      [1, null, cA.id],
      [2, null, cA.id],
      [3, 1, cA.id],
    ]);
    const config = await configPublicado(p);
    expect(config.version).toBe(3);
    expect(config.publicado).not.toBe(v1.config.publicado);
    expect(config.fachada.src).toMatch(/^medios\/v1-fachada-/);
    expect({ ...config, version: 1, publicado: v1.config.publicado }).toEqual(v1.config); // solo cambian version y publicado
    expect(versiones[2].config).toEqual(config);
    expect(await mediosPublicados(p)).toEqual(medios); // no copia imágenes
    expect(await borradorDe(p)).toEqual(antes);
    expect((await registroDe(p, 'restaurar')).map((f) => f.detalle)).toEqual([{ numero: 1, nuevo: 3 }]);
  });

  it('un número que no existe da 404; uno que no es entero positivo, 400; nada se reserva ni se publica', async () => {
    const p = await parroquiaLista();
    await publicar(deps(cA), p.slug);
    const publicadaAntes = await configPublicado(p);
    const inexistente = await restaurar(deps(cA), p.slug, 7);
    expect(inexistente.estado).toBe(404);
    expect(inexistente.cuerpo).toHaveProperty('error');
    for (const malo of [0, -1, 1.5, '1', null, undefined, NaN, 2 ** 40]) {
      expect((await restaurar(deps(cA), p.slug, malo)).estado, String(malo)).toBe(400);
    }
    expect((await versionesDe(p)).map((v) => v.numero)).toEqual([1]);
    expect(await ultimaVersion(p)).toBe(1);
    expect(await configPublicado(p)).toEqual(publicadaAntes);
  });

  it('una versión guardada que ya no valida da 422 y no se sube nada', async () => {
    const p = await parroquiaLista();
    await publicar(deps(cA), p.slug);
    const publicadaAntes = await configPublicado(p);
    const v1 = (await versionesDe(p))[0];
    await servicio
      .from('versiones')
      .update({ config: { ...v1.config, colores: { principal: '#ffff00', oscuro: '#ffff00' } } })
      .eq('parroquia_id', p.id)
      .eq('numero', 1);
    const r = await restaurar(deps(cA), p.slug, 1);
    expect(r.estado).toBe(422);
    expect((r.cuerpo as { errores: string[] }).errores.length).toBeGreaterThan(0);
    expect((await versionesDe(p)).map((v) => v.numero)).toEqual([1]);
    expect(await ultimaVersion(p)).toBe(1);
    expect(await configPublicado(p)).toEqual(publicadaAntes);
  });

  it('un coordinador de B no puede restaurar A (403), ni siquiera una versión que existe; sin sesión, 401', async () => {
    const p = await parroquiaLista();
    await publicar(deps(cA), p.slug);
    expect((await restaurar(deps(cB), p.slug, 1)).estado).toBe(403);
    expect((await restaurar(deps(cB), p.slug, 99)).estado).toBe(403); // no distingue «no existe» de «no es tuya»
    expect((await restaurar(sinSesion(), p.slug, 1)).estado).toBe(401);
    expect((await versionesDe(p)).map((v) => v.numero)).toEqual([1]);
    expect(await ultimaVersion(p)).toBe(1);
  });

  it('con el hook caído la restauración queda hecha y responde hook: fallo', async () => {
    const p = await parroquiaLista();
    await publicar(deps(cA), p.slug);
    const espia = silenciar();
    const r = await restaurar(deps(cA, urlHook500), p.slug, 1);
    espia.mockRestore();
    expect(r.cuerpo).toEqual({ numero: 2, hook: 'fallo' });
    expect((await configPublicado(p)).version).toBe(2);
  });
});
