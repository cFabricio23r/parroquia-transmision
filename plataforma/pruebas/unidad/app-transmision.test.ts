import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  camposCambiados,
  MENSAJE_CLAVE_ESPACIOS,
  MENSAJE_CLAVE_LARGA,
  MENSAJE_CLAVE_VACIA,
  MENSAJE_SERVIDOR,
  validarAjustesApp,
  validarClave,
} from '../../lib/app-transmision-reglas';
import { falloSinDetalle, MENSAJE_SIN_PERMISO } from '../../lib/borrador';
import { leerAppTransmision } from '../../lib/app-transmision';
import { registrarSinFallar } from '../../lib/admin';

afterEach(() => vi.restoreAllMocks());

describe('validarAjustesApp', () => {
  it('acepta y recorta', () => {
    expect(validarAjustesApp({ servidor: ' rtmps://live-api-s.facebook.com:443/rtmp/ ', calidadDefecto: '1080p', estiloFinal: 'claro' })).toEqual({
      ok: true,
      valor: { servidor: 'rtmps://live-api-s.facebook.com:443/rtmp/', calidadDefecto: '1080p', estiloFinal: 'claro' },
    });
    const r = validarAjustesApp({ servidor: '', calidadDefecto: '720p', estiloFinal: 'azul' });
    expect(r).toEqual({ ok: true, valor: { servidor: null, calidadDefecto: '720p', estiloFinal: 'azul' } });
  });
  it('rechaza servidor, calidad y estilo malos', () => {
    for (const servidor of ['http://x', 'rtmps://a b', `rtmps://${'a'.repeat(293)}`]) {
      const r = validarAjustesApp({ servidor, calidadDefecto: '720p', estiloFinal: 'azul' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errores.servidor).toBe(MENSAJE_SERVIDOR);
    }
    const c = validarAjustesApp({ servidor: '', calidadDefecto: '4k', estiloFinal: 'azul' });
    expect(!c.ok && c.errores.calidadDefecto).toBeTruthy();
    const e = validarAjustesApp({ servidor: '', calidadDefecto: '720p', estiloFinal: 'rojo' });
    expect(!e.ok && e.errores.estiloFinal).toBeTruthy();
    for (const x of [null, 'x', []]) expect(validarAjustesApp(x).ok).toBe(false);
  });
});

describe('validarClave', () => {
  it('recorta y valida', () => {
    expect(validarClave({ clave: '  FB-CLAVE-FALSA-1111\n' })).toEqual({ ok: true, clave: 'FB-CLAVE-FALSA-1111' });
    expect(validarClave({ clave: '' })).toEqual({ ok: false, error: MENSAJE_CLAVE_VACIA });
    expect(validarClave({})).toEqual({ ok: false, error: MENSAJE_CLAVE_VACIA });
    expect(validarClave({ clave: 'FB CLAVE' })).toEqual({ ok: false, error: MENSAJE_CLAVE_ESPACIOS });
    expect(validarClave({ clave: 'x'.repeat(201) })).toEqual({ ok: false, error: MENSAJE_CLAVE_LARGA });
  });
  it('la clave nunca aparece en el error', () => {
    expect(JSON.stringify(validarClave({ clave: 'FB-CLAVE FALSA-1111' }))).not.toContain('FALSA-1111');
  });
});

describe('camposCambiados', () => {
  const base = { servidor: null, calidadDefecto: '720p', estiloFinal: 'azul' } as const;
  it('compara con lo que había', () => {
    expect(camposCambiados(null, base)).toEqual(['calidadDefecto', 'estiloFinal']);
    expect(camposCambiados(null, { ...base, servidor: 'rtmps://x/' })).toEqual(['servidor', 'calidadDefecto', 'estiloFinal']);
    expect(camposCambiados(base, { ...base })).toEqual([]);
    expect(camposCambiados(base, { ...base, estiloFinal: 'claro' })).toEqual(['estiloFinal']);
  });
});

describe('fallas sin la clave (Review Focus 2)', () => {
  it('falloSinDetalle escribe solo dónde', () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(falloSinDetalle('guardarClave')).toEqual({ estado: 500, cuerpo: { error: 'No se pudo completar. Intenta de nuevo' } });
    expect(espia.mock.calls).toEqual([['[guardarClave] falló']]);
  });
  it('registrarSinFallar no rechaza ni escribe el error', async () => {
    const espias = (['log', 'warn', 'error', 'info', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const servicio = {
      from: () => ({ insert: async () => ({ error: { message: 'x', details: 'Failing row contains (FB-CLAVE-FALSA-1111)' } }) }),
    } as unknown as SupabaseClient;
    await expect(
      registrarSinFallar(servicio, { parroquia_id: null, usuario_id: null, accion: 'cambiar_clave_transmision', detalle: {} }, 'guardarClave'),
    ).resolves.toBeUndefined();
    expect(espias[2].mock.calls).toEqual([['[guardarClave] no se pudo registrar']]);
    for (const e of espias) expect(JSON.stringify(e.mock.calls)).not.toContain('FB-CLAVE-FALSA-1111');
  });
});

// ---- «Facebook de la parroquia» (Tarea 6): Supabase en memoria (solo lo que usa la lib) ----
type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function cliente(tablas: Tablas, usuario: { id: string } | null, leidas?: string[]): SupabaseClient {
  const from = (t: string) => {
    leidas?.push(t);
    const filtros: Array<(f: Fila) => boolean> = [];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
      neq: (c: string, v: unknown) => (filtros.push((f) => f[c] !== v), q),
      in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), q),
      maybeSingle: async () => ({ data: (tablas[t] ?? []).find((f) => filtros.every((p) => p(f))) ?? null, error: null }),
      single: async () => q.maybeSingle(),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: (tablas[t] ?? []).filter((f) => filtros.every((p) => p(f))), error: null }).then(ok, ko),
    };
    return q;
  };
  return { auth: { getUser: async () => ({ data: { user: usuario } }) }, from } as unknown as SupabaseClient;
}

const PA = 'id-parroquia-a';
const PB = 'id-parroquia-b';
const TOKEN_USUARIO = 'v1.TOKEN-USUARIO-SECRETO.x.y';
const TOKEN_PAGINA = 'v1.TOKEN-PAGINA-SECRETO.x.y';

function mundoFb(visibles: string[] = [PA]): Tablas {
  return {
    parroquias: [
      { id: PA, slug: 'sa', nombre: 'Parroquia A' },
      { id: PB, slug: 'sb', nombre: 'Parroquia B' },
    ].filter((p) => visibles.includes(p.id)),
    ajustes_app: [],
    claves_transmision: [],
    perfiles: [{ usuario_id: 'u-ana', nombre: 'Ana Coordinadora' }],
    facebook_conexion: [
      { parroquia_id: PA, nombre_facebook: 'Comunicaciones Ciudad Arce', token_usuario: TOKEN_USUARIO, estado: 'conectado', conectado_por: 'u-ana', conectado_en: '2026-11-26T18:00:00Z' },
      { parroquia_id: PB, nombre_facebook: 'Cuenta de la B', token_usuario: TOKEN_USUARIO, estado: 'conectado', conectado_por: 'u-ana', conectado_en: '2026-11-20T18:00:00Z' },
    ],
    facebook_paginas: [
      { parroquia_id: PA, page_id: 'pg-arce-secreto', nombre: 'Parroquia Ciudad Arce', seguidores: 10, token: TOKEN_PAGINA },
      { parroquia_id: PA, page_id: 'pg-vicaria-secreto', nombre: 'Vicaría Ciudad Arce', seguidores: 5, token: TOKEN_PAGINA },
      { parroquia_id: PA, page_id: 'pg-sector3-secreto', nombre: 'Sector 3', seguidores: 1, token: TOKEN_PAGINA },
      { parroquia_id: PB, page_id: 'pg-de-b-secreto', nombre: 'Página de la B', seguidores: 1, token: TOKEN_PAGINA },
    ],
    facebook_parroquia: [
      { parroquia_id: PA, pagina_principal: 'pg-arce-secreto' },
      { parroquia_id: PB, pagina_principal: 'pg-de-b-secreto' },
    ],
    facebook_parroquia_extra: [
      { parroquia_id: PA, page_id: 'pg-vicaria-secreto', por_defecto: true, crosspost: 'listo' },
      { parroquia_id: PA, page_id: 'pg-sector3-secreto', por_defecto: false, crosspost: 'falta' },
    ],
  };
}

describe('leerAppTransmision: facebook', () => {
  it('un coordinador de otra parroquia se queda en comprobarAcceso: no recibe facebook ni se toca el cliente de servicio', async () => {
    const t = mundoFb([PA]); // no ve la B
    const leidas: string[] = [];
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sb', cliente(t, null, leidas));
    expect(r.estado).toBe(403);
    expect(r.cuerpo).toEqual({ error: MENSAJE_SIN_PERMISO });
    expect(JSON.stringify(r.cuerpo)).not.toContain('Cuenta de la B');
    expect(leidas).toEqual([]);
  });

  it('sin sesión es 401 y no se lee facebook', async () => {
    const leidas: string[] = [];
    const t = mundoFb();
    const r = await leerAppTransmision(cliente(t, null), 'sa', cliente(t, null, leidas));
    expect(r.estado).toBe(401);
    expect(leidas).toEqual([]);
  });

  it('conectado: cuenta, quién la conectó, cuándo, la principal y las extras con su «por defecto»', async () => {
    const t = mundoFb();
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sa', cliente(t, null));
    expect(r.estado).toBe(200);
    expect((r.cuerpo as { facebook: unknown }).facebook).toEqual({
      estado: 'conectado',
      cuenta: 'Comunicaciones Ciudad Arce',
      conectadoPor: 'Ana Coordinadora',
      conectadoEn: '2026-11-26T18:00:00Z',
      principal: 'Parroquia Ciudad Arce',
      extras: [
        { nombre: 'Sector 3', porDefecto: false },
        { nombre: 'Vicaría Ciudad Arce', porDefecto: true },
      ],
    });
  });

  it('la respuesta no tiene tokens ni page_id', async () => {
    const t = mundoFb();
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sa', cliente(t, null));
    const texto = JSON.stringify(r.cuerpo);
    expect(texto).not.toContain('TOKEN');
    expect(texto).not.toContain('v1.');
    expect(texto).not.toContain('pg-');
    expect(texto).not.toMatch(/page_?id/i);
    expect(texto).not.toContain('token');
  });

  it('nunca mezcla lo de otra parroquia', async () => {
    const t = mundoFb([PA, PB]); // un admin ve las dos
    const r = await leerAppTransmision(cliente(t, { id: 'u-admin' }), 'sa', cliente(t, null));
    const texto = JSON.stringify(r.cuerpo);
    expect(texto).not.toContain('Cuenta de la B');
    expect(texto).not.toContain('Página de la B');
  });

  it('sin conexión: sin-conectar, sin cuenta y sin páginas', async () => {
    const t = mundoFb();
    t.facebook_conexion = [];
    t.facebook_paginas = [];
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sa', cliente(t, null));
    expect((r.cuerpo as { facebook: unknown }).facebook).toEqual({
      estado: 'sin-conectar',
      cuenta: null,
      conectadoPor: null,
      conectadoEn: null,
      principal: null,
      extras: [],
    });
  });

  it('a reconectar: sigue mostrando las páginas elegidas', async () => {
    const t = mundoFb();
    t.facebook_conexion[0].estado = 'reconectar';
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sa', cliente(t, null));
    const f = (r.cuerpo as { facebook: { estado: string; principal: string } }).facebook;
    expect(f.estado).toBe('reconectar');
    expect(f.principal).toBe('Parroquia Ciudad Arce');
  });

  it('quien la conectó ya no existe: conectadoPor es null', async () => {
    const t = mundoFb();
    t.perfiles = [];
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sa', cliente(t, null));
    expect((r.cuerpo as { facebook: { conectadoPor: unknown } }).facebook.conectadoPor).toBeNull();
  });

  it('sin cliente de servicio la página sigue con los ajustes y facebook queda en null', async () => {
    const t = mundoFb();
    const r = await leerAppTransmision(cliente(t, { id: 'u-coord' }), 'sa');
    expect(r.estado).toBe(200);
    expect((r.cuerpo as { facebook: unknown }).facebook).toBeNull();
  });
});
