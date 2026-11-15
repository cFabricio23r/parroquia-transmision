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
import { falloSinDetalle } from '../../lib/borrador';
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
