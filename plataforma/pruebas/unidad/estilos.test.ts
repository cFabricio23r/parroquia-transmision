// Variables, fuentes y logo de la base visual (plan 2, tarea 1): valores exactos del lienzo.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALT_LOGO_PASTORAL, LOGO_PASTORAL } from '../../lib/marca';

const raiz = resolve(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TOKENS: [string, string][] = [
  ['--pv-fondo', '#f4f7fb'],
  ['--pv-texto', '#14223a'],
  ['--pv-texto-suave', '#56657a'],
  ['--pv-borde', '#d5e0ee'],
  ['--pv-primario', '#1155a4'],
  ['--pv-encabezado', '#0c3562'],
  ['--pv-encabezado-sub', '#b4cbe8'],
  ['--pv-avatar', '#1f6fc4'],
  ['--pv-menu-activo', '#e6eef8'],
  ['--pv-info-fondo', '#e6f1fb'],
  ['--pv-info-texto', '#0c3562'],
  ['--pv-miniatura', '#dfe6ef'],
  ['--pv-campo-lectura', '#eef2f7'],
  ['--pv-interruptor-apagado', '#c3ccd8'],
  ['--pv-sombra-acceso', '0 12px 32px rgba(12,53,98,.08)'],
  ['--pv-verde', '#1f8a55'],
  ['--pv-verde-chip', '#e2f6ec'],
  ['--pv-verde-chip-texto', '#11643c'],
  ['--pv-ambar', '#b07d00'],
  ['--pv-ambar-chip', '#fff4d6'],
  ['--pv-ambar-chip-texto', '#6b4f00'],
  ['--pv-ambar-oscuro', '#8a6500'],
  ['--pv-rojo', '#c0392b'],
  ['--pv-rojo-texto', '#a3231a'],
  ['--pv-rojo-borde', '#e3b4ae'],
  ['--pv-gris', '#8a97a8'],
  ['--pv-gris-chip', '#eceff3'],
  ['--pv-gris-chip-texto', '#4a5568'],
  ['--pv-velo', 'rgba(12,30,60,.35)'],
  ['--pv-sombra-dialogo', '0 20px 50px rgba(0,0,0,.25)'],
];

describe('tokens.css', () => {
  const css = leer('app/estilos/tokens.css');
  for (const [nombre, valor] of TOKENS) {
    it(`${nombre}: ${valor}`, () => {
      expect(css).toMatch(new RegExp(`${escapar(nombre)}:\\s*${escapar(valor)}\\s*;`));
    });
  }
});

describe('fuentes.css', () => {
  const css = leer('app/estilos/fuentes.css');
  it('Montserrat 500 a 900 servida desde el propio sitio', () => {
    for (const peso of [500, 600, 700, 800, 900]) {
      expect(css).toContain(`url('/fuentes/montserrat-latin-${peso}-normal.woff2') format('woff2')`);
      expect(css).toMatch(new RegExp(`font-weight:\\s*${peso};`));
    }
    expect((css.match(/font-family: 'Montserrat'/g) ?? []).length).toBe(5);
    expect(css).toContain('font-display: swap');
    expect(css).not.toContain('googleapis');
  });
  // Diseños de rótulo: la lista de tipografías del editor muestra cada opción en su letra.
  const ROTULO: [string, string][] = [
    ['Lora', 'lora-latin-700-normal.woff2'],
    ['SourceSans', 'source-sans-3-latin-700-normal.woff2'],
    ['Cinzel', 'cinzel-latin-700-normal.woff2'],
    ['Playfair', 'playfair-display-latin-700-normal.woff2'],
    ['EBGaramond', 'eb-garamond-latin-700-normal.woff2'],
    ['Merriweather', 'merriweather-latin-700-normal.woff2'],
    ['Nunito', 'nunito-latin-800-normal.woff2'],
    ['Oswald', 'oswald-latin-600-normal.woff2'],
  ];
  it('las 8 tipografías del rótulo, desde el propio sitio y con font-display: swap', () => {
    expect((css.match(/@font-face/g) ?? []).length).toBe(5 + ROTULO.length);
    expect((css.match(/font-display: swap/g) ?? []).length).toBe(5 + ROTULO.length);
    for (const [familia, archivo] of ROTULO) {
      expect(css).toContain(`font-family: '${familia}'`);
      expect(css).toContain(`url('/fuentes/${archivo}') format('woff2')`);
      expect(() => readFileSync(resolve(raiz, '..', 'vicaria', 'fuentes', archivo))).not.toThrow();
    }
  });
  it('las cinco fuentes existen en vicaria/fuentes (copiar-vicaria las lleva a public/)', () => {
    for (const peso of [500, 600, 700, 800, 900]) {
      expect(() => readFileSync(resolve(raiz, '..', 'vicaria', 'fuentes', `montserrat-latin-${peso}-normal.woff2`))).not.toThrow();
    }
  });
});

describe('base.css', () => {
  const css = leer('app/estilos/base.css');
  it('fondo, texto, fuente, foco visible y solo-lectores', () => {
    expect(css).toMatch(/background:\s*var\(--pv-fondo\)/);
    expect(css).toMatch(/font-family:\s*'Montserrat',\s*sans-serif/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--pv-primario\)/);
    expect(css).toMatch(/\.pv-solo-lectores\s*\{[^}]*clip-path:\s*inset\(50%\)/);
  });
});

describe('marca', () => {
  it('el logo es el PNG de vicaria/ciudad-arce/medios/logo-blanco.png, byte a byte', () => {
    expect(LOGO_PASTORAL.startsWith('data:image/png;base64,')).toBe(true);
    const bytes = Buffer.from(LOGO_PASTORAL.slice('data:image/png;base64,'.length), 'base64');
    const original = readFileSync(resolve(raiz, '..', 'vicaria', 'ciudad-arce', 'medios', 'logo-blanco.png'));
    expect(bytes.equals(original)).toBe(true);
    expect(ALT_LOGO_PASTORAL).toBe('Logo de la Pastoral de Comunicaciones');
  });
});

describe('zona de toque de 44 px en enlaces y «Mostrar contraseña» (plan 2, ronda 2)', () => {
  const css = leer('app/estilos/componentes.css');
  const regla = (selector: string) => css.match(new RegExp(String.raw`${escapar(selector)}\s*\{([^}]*)\}`))?.[1] ?? '';
  it('.pv-enlace tiene un ::after invisible de 44 px de alto, centrado', () => {
    expect(regla('.pv-enlace')).toMatch(/position:\s*relative/);
    const after = regla('.pv-enlace::after');
    expect(after).toMatch(/content:\s*''/);
    expect(after).toMatch(/position:\s*absolute/);
    expect(after).toMatch(/height:\s*44px/);
  });
  it('«Mostrar contraseña» no sube su zona sobre el campo: arranca en el gap de 6 px (revisión fix2: la zona es el botón)', () => {
    expect(regla('.pv-mostrar-clave')).toMatch(/margin-top:\s*-6px/);
    expect(regla('.pv-mostrar-clave')).toMatch(/min-height:\s*44px/);
    expect(regla('.pv-campo-clave')).toMatch(/gap:\s*6px/);
  });
});
