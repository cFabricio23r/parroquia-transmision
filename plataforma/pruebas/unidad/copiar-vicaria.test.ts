import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copiarVicaria } from '../../herramientas/copiar-vicaria.mjs';

const origen = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vicaria');

describe('copiarVicaria', () => {
  let destino: string;
  beforeEach(() => { destino = mkdtempSync(path.join(tmpdir(), 'plataforma-')); });
  afterEach(() => { rmSync(destino, { recursive: true, force: true }); });

  it('copia las pantallas, los scripts, las fuentes y la config de cada parroquia', () => {
    copiarVicaria(origen, path.join(destino, 'public'));
    for (const f of ['pantalla.html', 'parroquia.js', 'fuentes/montserrat-latin-500-normal.woff2', 'ciudad-arce/config.json']) {
      expect(existsSync(path.join(destino, 'public', f)), f).toBe(true);
    }
  });

  it('no copia vercel.json ni LEEME-config.md', () => {
    copiarVicaria(origen, path.join(destino, 'public'));
    expect(existsSync(path.join(destino, 'public', 'vercel.json'))).toBe(false);
    expect(existsSync(path.join(destino, 'public', 'LEEME-config.md'))).toBe(false);
  });

  it('devuelve y escribe los slugs del repo, ordenados', () => {
    const r = copiarVicaria(origen, path.join(destino, 'public'));
    expect(r.slugsDelRepo).toEqual(['ciudad-arce', 'san-jose-ejemplo']);
    const json = JSON.parse(readFileSync(path.join(destino, 'lib', 'generado', 'slugs-del-repo.json'), 'utf8'));
    expect(json).toEqual(['ciudad-arce', 'san-jose-ejemplo']);
  });

  it('escribe lib/generado/fuentes-vicaria.mjs con el texto exacto de parroquia.js, tipos.js y comun.js', async () => {
    copiarVicaria(origen, path.join(destino, 'public'));
    const generado = path.join(destino, 'lib', 'generado', 'fuentes-vicaria.mjs');
    const m = await import(pathToFileURL(generado).href);
    expect(m.ARCHIVOS).toEqual(['parroquia.js', 'tipos.js', 'comun.js']);
    expect(m.FUENTES).toEqual(m.ARCHIVOS.map((a: string) => readFileSync(path.join(origen, a), 'utf8')));
  });
});
