// «App y transmisión» (etapa 3c): las tablas ajustes_app y claves_transmision, sus políticas y
// sus check, contra el Supabase LOCAL con sesiones reales. Las claves son falsas y se notan.
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
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
import { guardarAjustesApp, guardarClave, leerAppTransmision, quitarClave, type DepsAppTransmision } from '../../lib/app-transmision';
import { MENSAJE_CLAVE_ESPACIOS } from '../../lib/app-transmision-reglas';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';

type Parroquia = { id: string; slug: string };

let A: Parroquia;
let B: Parroquia;
let cA: UsuarioPrueba;
let cB: UsuarioPrueba;
let admin: UsuarioPrueba;

beforeAll(async () => {
  A = await crearParroquia('apt');
  B = await crearParroquia('apt');
  cA = await crearUsuario(`apt-a-${sufijo()}@prueba.local`, CLAVE);
  cB = await crearUsuario(`apt-b-${sufijo()}@prueba.local`, CLAVE);
  admin = await crearUsuario(`apt-admin-${sufijo()}@prueba.local`, CLAVE);
  await hacerMiembro(A.id, cA.id);
  await hacerMiembro(B.id, cB.id);
  await hacerAdmin(admin.id);
}, 60_000);

describe('RLS', () => {
  beforeAll(async () => {
    for (const [p, clave] of [
      [A, 'FB-CLAVE-FALSA-1111'],
      [B, 'FB-CLAVE-FALSA-2222'],
    ] as const) {
      expect((await servicio.from('claves_transmision').insert({ parroquia_id: p.id, clave })).error).toBeNull();
      expect((await servicio.from('ajustes_app').insert({ parroquia_id: p.id, servidor: 'rtmps://x/' })).error).toBeNull();
    }
  });

  it('el coordinador lee lo de su parroquia, clave incluida', async () => {
    const k = await cA.cliente.from('claves_transmision').select('clave').eq('parroquia_id', A.id);
    expect(k.data).toEqual([{ clave: 'FB-CLAVE-FALSA-1111' }]);
    const a = await cA.cliente.from('ajustes_app').select('servidor').eq('parroquia_id', A.id);
    expect(a.data).toEqual([{ servidor: 'rtmps://x/' }]);
  });

  it('no lee ni escribe lo de otra parroquia', async () => {
    expect((await cA.cliente.from('claves_transmision').select('clave').eq('parroquia_id', B.id)).data).toEqual([]);
    expect((await cA.cliente.from('ajustes_app').select('servidor').eq('parroquia_id', B.id)).data).toEqual([]);
    expect((await cA.cliente.from('claves_transmision').insert({ parroquia_id: B.id, clave: 'X' })).error).not.toBeNull();
    await cA.cliente.from('claves_transmision').update({ clave: 'X' }).eq('parroquia_id', B.id);
    await cA.cliente.from('ajustes_app').update({ servidor: 'rtmps://otro/' }).eq('parroquia_id', B.id);
    await cA.cliente.from('claves_transmision').delete().eq('parroquia_id', B.id);
    const k = await servicio.from('claves_transmision').select('clave').eq('parroquia_id', B.id);
    expect(k.data).toEqual([{ clave: 'FB-CLAVE-FALSA-2222' }]);
    const a = await servicio.from('ajustes_app').select('servidor').eq('parroquia_id', B.id);
    expect(a.data).toEqual([{ servidor: 'rtmps://x/' }]);
  });

  it('el admin lee las dos', async () => {
    const k = await admin.cliente.from('claves_transmision').select('parroquia_id').in('parroquia_id', [A.id, B.id]);
    expect(k.data).toHaveLength(2);
    const a = await admin.cliente.from('ajustes_app').select('parroquia_id').in('parroquia_id', [A.id, B.id]);
    expect(a.data).toHaveLength(2);
  });

  it('el anónimo no tiene permiso', async () => {
    expect((await clienteAnonimo().from('claves_transmision').select('clave')).error).not.toBeNull();
    expect((await clienteAnonimo().from('ajustes_app').select('servidor')).error).not.toBeNull();
  });

  it('los check rechazan datos malos', async () => {
    const C = await crearParroquia('apt');
    for (const clave of ['con espacio', '', 'x'.repeat(201)]) {
      expect((await servicio.from('claves_transmision').insert({ parroquia_id: C.id, clave })).error).not.toBeNull();
    }
    for (const fila of [{ servidor: 'http://x' }, { calidad_defecto: '4k' }, { estilo_final: 'rojo' }]) {
      expect((await servicio.from('ajustes_app').insert({ parroquia_id: C.id, ...fila })).error).not.toBeNull();
    }
    const r = await servicio.from('ajustes_app').insert({ parroquia_id: C.id }).select('servidor, calidad_defecto, estilo_final').single();
    expect(r.data).toEqual({ servidor: null, calidad_defecto: '720p', estilo_final: 'azul' });
  });

  it('con la parroquia desactivada el coordinador ya no lee la clave', async () => {
    expect((await servicio.from('parroquias').update({ desactivada_en: new Date().toISOString() }).eq('id', A.id)).error).toBeNull();
    try {
      expect((await cA.cliente.from('claves_transmision').select('clave').eq('parroquia_id', A.id)).data).toEqual([]);
    } finally {
      await servicio.from('parroquias').update({ desactivada_en: null }).eq('id', A.id);
    }
  });
});

describe('editor', () => {
  const deps = (u: UsuarioPrueba): DepsAppTransmision => ({ sesion: u.cliente, servicio });
  const respuestas: unknown[] = [];
  const anotar = <T,>(r: T): T => (respuestas.push(r), r);
  let espias: MockInstance[] = [];
  const registroDe = async (accion: string) =>
    ((await servicio.from('registro').select('detalle, usuario_id').eq('parroquia_id', A.id).eq('accion', accion).order('id')).data ?? []) as {
      detalle: Record<string, unknown>;
      usuario_id: string | null;
    }[];
  const claveDe = async (id: string) =>
    (await servicio.from('claves_transmision').select('clave, guardada_por, guardada_en').eq('parroquia_id', id).maybeSingle()).data;

  beforeAll(async () => {
    espias = (['log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m));
    await servicio.from('claves_transmision').delete().eq('parroquia_id', A.id);
    await servicio.from('ajustes_app').delete().eq('parroquia_id', A.id);
  });
  afterAll(() => espias.forEach((e) => e.mockRestore()));

  it('guarda, reemplaza y quita la clave, y lo anota', async () => {
    const r1 = anotar(await guardarClave(deps(cA), A.slug, { clave: 'FB-CLAVE-FALSA-1111' }));
    expect(r1.estado).toBe(200);
    const g1 = (r1.cuerpo as { guardadaEn: string }).guardadaEn;
    expect(typeof g1).toBe('string');
    expect(await claveDe(A.id)).toMatchObject({ clave: 'FB-CLAVE-FALSA-1111', guardada_por: cA.id });
    expect((await registroDe('cambiar_clave_transmision')).map((f) => f.detalle)).toEqual([
      { slug: A.slug, nombre: `Parroquia ${A.slug}`, cambio: 'guardar' },
    ]);

    const r2 = anotar(await guardarClave(deps(cA), A.slug, { clave: 'FB-CLAVE-FALSA-2222' }));
    expect(r2.estado).toBe(200);
    expect(new Date((r2.cuerpo as { guardadaEn: string }).guardadaEn).getTime()).toBeGreaterThanOrEqual(new Date(g1).getTime());
    expect((await registroDe('cambiar_clave_transmision')).map((f) => f.detalle.cambio)).toEqual(['guardar', 'reemplazar']);

    const r3 = anotar(await quitarClave(deps(cA), A.slug));
    expect(r3).toEqual({ estado: 200, cuerpo: {} });
    expect(await claveDe(A.id)).toBeNull();
    expect((await registroDe('cambiar_clave_transmision')).map((f) => f.detalle.cambio)).toEqual(['guardar', 'reemplazar', 'quitar']);
    expect(anotar(await quitarClave(deps(cA), A.slug))).toEqual({ estado: 200, cuerpo: {} });
    expect(await registroDe('cambiar_clave_transmision')).toHaveLength(3);
  });

  it('permisos y validación', async () => {
    expect(anotar(await guardarClave(deps(cB), A.slug, { clave: 'FB-CLAVE-FALSA-2222' })).estado).toBe(403);
    expect(anotar(await guardarClave({ sesion: clienteAnonimo(), servicio }, A.slug, { clave: 'FB-CLAVE-FALSA-2222' })).estado).toBe(401);
    expect(await claveDe(A.id)).toBeNull();
    const r = anotar(await guardarClave(deps(cA), A.slug, { clave: 'FB CLAVE' }));
    expect(r).toEqual({ estado: 422, cuerpo: { error: MENSAJE_CLAVE_ESPACIOS } });
    expect(await claveDe(A.id)).toBeNull();
  });

  it('guarda los ajustes y anota solo lo que cambió', async () => {
    const valores = { servidor: 'rtmps://live-api-s.facebook.com:443/rtmp/', calidadDefecto: '1080p', estiloFinal: 'claro' };
    const r1 = anotar(await guardarAjustesApp(deps(cA), A.slug, valores));
    expect(r1.estado).toBe(200);
    expect(r1.cuerpo).toMatchObject(valores);
    expect((await registroDe('cambiar_ajustes_app')).map((f) => f.detalle)).toEqual([
      { slug: A.slug, nombre: `Parroquia ${A.slug}`, campos: ['servidor', 'calidadDefecto', 'estiloFinal'] },
    ]);
    const antes = (await servicio.from('ajustes_app').select('actualizado_en').eq('parroquia_id', A.id).single()).data?.actualizado_en;
    expect(anotar(await guardarAjustesApp(deps(cA), A.slug, valores)).estado).toBe(200);
    expect(await registroDe('cambiar_ajustes_app')).toHaveLength(1);
    expect((await servicio.from('ajustes_app').select('actualizado_en').eq('parroquia_id', A.id).single()).data?.actualizado_en).toBe(antes);
    expect(anotar(await guardarAjustesApp(deps(cA), A.slug, { ...valores, estiloFinal: 'azul' })).estado).toBe(200);
    expect((await registroDe('cambiar_ajustes_app')).map((f) => f.detalle.campos)).toEqual([
      ['servidor', 'calidadDefecto', 'estiloFinal'],
      ['estiloFinal'],
    ]);
    const malo = anotar(await guardarAjustesApp(deps(cA), A.slug, { ...valores, servidor: 'http://x' }));
    expect(malo.estado).toBe(422);
    expect((malo.cuerpo as { errores?: Record<string, string> }).errores?.servidor).toBeTruthy();
    expect(anotar(await guardarAjustesApp(deps(cB), A.slug, valores)).estado).toBe(403);
  });

  it('el admin guarda y quita la clave', async () => {
    expect(anotar(await guardarClave(deps(admin), A.slug, { clave: 'FB-CLAVE-FALSA-1111' })).estado).toBe(200);
    const leido = await leerAppTransmision(cA.cliente, A.slug);
    expect(leido.estado).toBe(200);
    expect((leido.cuerpo as { clave: { guardadaEn: string } | null }).clave?.guardadaEn).toBeTruthy();
    expect(JSON.stringify(leido)).not.toContain('FB-CLAVE-FALSA');
    expect(anotar(await quitarClave(deps(admin), A.slug)).estado).toBe(200);
  });

  it('facebook: sin conexión es sin-conectar; con ella, solo la de su parroquia, sin tokens ni page_id', async () => {
    const vacio = await leerAppTransmision(cA.cliente, A.slug, servicio);
    expect((vacio.cuerpo as { facebook: { estado: string } }).facebook.estado).toBe('sin-conectar');
    const idA = `pg-${sufijo()}-a`;
    const idB = `pg-${sufijo()}-b`;
    for (const [p, id, cuenta] of [
      [A, idA, 'Cuenta de A'],
      [B, idB, 'Cuenta de B'],
    ] as const) {
      expect((await servicio.from('facebook_conexion').insert({ parroquia_id: p.id, nombre_facebook: cuenta, token_usuario: 'v1.TOKEN-FALSO-U', estado: 'conectado' })).error).toBeNull();
      expect((await servicio.from('facebook_paginas').insert({ parroquia_id: p.id, page_id: id, nombre: `Página ${cuenta}`, token: 'v1.TOKEN-FALSO-P' })).error).toBeNull();
      expect((await servicio.from('facebook_parroquia').insert({ parroquia_id: p.id, pagina_principal: id })).error).toBeNull();
    }
    try {
      const r = await leerAppTransmision(cA.cliente, A.slug, servicio);
      expect(r.estado).toBe(200);
      expect((r.cuerpo as { facebook: unknown }).facebook).toMatchObject({ estado: 'conectado', cuenta: 'Cuenta de A', principal: 'Página Cuenta de A', extras: [] });
      const texto = JSON.stringify(r.cuerpo);
      for (const prohibido of ['TOKEN-FALSO', idA, idB, 'Cuenta de B']) expect(texto).not.toContain(prohibido);
      const ajena = await leerAppTransmision(cA.cliente, B.slug, servicio);
      expect(ajena.estado).toBe(403);
      expect(JSON.stringify(ajena.cuerpo)).not.toContain('Cuenta de B');
    } finally {
      for (const p of [A, B]) await servicio.from('facebook_conexion').delete().eq('parroquia_id', p.id);
    }
  });

  it('la clave nunca aparece (Review Focus 2)', async () => {
    for (const e of espias) expect(JSON.stringify(e.mock.calls)).not.toContain('FB-CLAVE-FALSA');
    expect(JSON.stringify(respuestas)).not.toContain('FB-CLAVE-FALSA');
    const filas = (await servicio.from('registro').select('*').eq('parroquia_id', A.id)).data;
    expect(JSON.stringify(filas)).not.toContain('FB-CLAVE-FALSA');
  });
});
