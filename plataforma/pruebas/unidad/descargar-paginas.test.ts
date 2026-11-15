// Revisión fix2 (hallazgo 10): `slugs_activos()` pasa por PostgREST, que corta cada respuesta en
// `max_rows` (1000 en supabase/config.toml). Sin paginar, las parroquias activas que quedan después del
// corte se tratarían como inactivas y se dejarían afuera del build sin fallar.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const MAX_ROWS = 100; // el corte de PostgREST, más chico que en la nube para no armar 1000 parroquias
const ACTIVOS = Array.from({ length: 250 }, (_, i) => `parroquia-${String(i).padStart(3, '0')}`);

/** Lo que devuelve PostgREST para `rpc('slugs_activos')`: como mucho MAX_ROWS filas, con o sin range. */
function rpcFalso() {
  const respuesta = (desde: number, hasta: number) =>
    Promise.resolve({ data: ACTIVOS.slice(desde, Math.min(hasta + 1, desde + MAX_ROWS)), error: null });
  return {
    range: vi.fn((desde: number, hasta: number) => respuesta(desde, hasta)),
    then: (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) => respuesta(0, Number.MAX_SAFE_INTEGER).then(ok, mal),
  };
}

const rpc = vi.fn(() => rpcFalso());
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc,
    storage: {
      from: () => ({
        // Una sola carpeta en publicado/, la última parroquia activa (queda después del corte).
        list: async () => ({ data: [{ id: null, name: ACTIVOS[ACTIVOS.length - 1] }], error: null }),
        download: async () => ({ data: null, error: { statusCode: '404', message: 'not found' } }),
      }),
    },
  }),
}));

const { descargarPublicado } = await import('../../herramientas/descargar-publicado.mjs');

let destino: string | undefined;
afterEach(() => {
  if (destino) rmSync(destino, { recursive: true, force: true });
  destino = undefined;
  vi.restoreAllMocks();
});

describe('descargarPublicado y slugs_activos con muchas parroquias', () => {
  it('lee slugs_activos por páginas: una parroquia activa después del corte de max_rows no se deja afuera', async () => {
    destino = mkdtempSync(path.join(tmpdir(), 'descargar-'));
    const avisos: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((m: string) => void avisos.push(m));
    await descargarPublicado({ url: 'http://127.0.0.1:1', clave: 'x', destino, slugsDelRepo: [] });
    const ultima = ACTIVOS[ACTIVOS.length - 1];
    // Activa y sin config.json: el aviso es «no tiene config.json», no «no es una parroquia activa».
    expect(avisos.some((a) => a.includes(`${ultima}/ no tiene config.json`))).toBe(true);
    expect(avisos.some((a) => a.includes('no es una parroquia activa'))).toBe(false);
  });
});
