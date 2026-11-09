import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MAX_BYTES_IMAGEN, revisarImagen } from '../../lib/imagenes';

const fondo = { create: { width: 8, height: 8, channels: 3 as const, background: '#336699' } };
const texto = (s: string) => new TextEncoder().encode(s);
const SVG_LIMPIO = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#123456"/></svg>';

describe('revisarImagen', () => {
  it('acepta PNG, JPG, WebP y SVG limpio', async () => {
    const casos = [
      [await sharp(fondo).png().toBuffer(), 'png'],
      [await sharp(fondo).jpeg().toBuffer(), 'jpg'],
      [await sharp(fondo).webp().toBuffer(), 'webp'],
      [Buffer.from(SVG_LIMPIO), 'svg'],
    ] as const;
    for (const [bytes, ext] of casos) {
      const r = await revisarImagen(new Uint8Array(bytes), 'el logo');
      expect(r.ok, ext).toBe(true);
      if (r.ok) expect(r.extension).toBe(ext);
    }
  });

  it('rechaza bytes de un MZ (ejecutable) aunque el archivo se llame .png', async () => {
    const mz = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);
    const r = await revisarImagen(mz, 'la fachada');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no es una imagen PNG, JPG, WebP ni SVG');
  });

  it('rechaza 3 MB + 1', async () => {
    const r = await revisarImagen(new Uint8Array(MAX_BYTES_IMAGEN + 1), 'la fachada');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('pesa más de 3 MB');
  });

  it.each([
    ['<script>', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['onload=', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
    ['href externo', '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://malo.example/x"><rect width="1" height="1"/></a></svg>'],
    ['xlink:href externo', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://malo.example/x#a"/></svg>'],
    ['foreignObject', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>hola</div></foreignObject></svg>'],
    ['javascript:', '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>'],
  ])('rechaza un SVG con %s', async (_n, svg) => {
    const r = await revisarImagen(texto(svg), 'el logo');
    expect(r.ok).toBe(false);
  });

  it('acepta un SVG con href interno (#id)', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><g id="a"><rect width="1" height="1"/></g></defs><use href="#a"/></svg>';
    expect((await revisarImagen(texto(svg), 'el logo')).ok).toBe(true);
  });

  it('rechaza texto que no es un SVG', async () => {
    expect((await revisarImagen(texto('hola, no soy imagen'), 'el logo')).ok).toBe(false);
  });

  it('a un JPEG con GPS lo devuelve sin EXIF', async () => {
    const conGps = await sharp(fondo)
      .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '4/1 0/1 0/1' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(conGps).metadata()).exif).toBeDefined(); // el fixture sí trae EXIF
    const r = await revisarImagen(new Uint8Array(conGps), 'la fachada');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.extension).toBe('jpg');
      expect((await sharp(r.bytes).metadata()).exif).toBeUndefined();
    }
  });

  it('rechaza un PNG dañado', async () => {
    const roto = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect((await revisarImagen(roto, 'el logo')).ok).toBe(false);
  });
});
