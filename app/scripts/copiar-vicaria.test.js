/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { archivosDeRewrites, copiarVicaria } = require('./copiar-vicaria');

// Raíz del repo: dos carpetas arriba de app/scripts/.
const raizRepo = path.resolve(__dirname, '..', '..');
const vercel = JSON.parse(fs.readFileSync(path.join(raizRepo, 'vicaria', 'vercel.json'), 'utf8'));

const PAGINAS = [
  'comun.js', 'estilos.css', 'guardadas.js', 'panel.html', 'pantalla.html',
  'pantallas.js', 'parroquia.js', 'produccion.html', 'rotulos.html', 'tipos.js',
  'transicion.html', 'transicion.js',
];
const FUENTES = [
  'fuentes/cinzel-latin-700-normal.woff2',
  'fuentes/eb-garamond-latin-700-normal.woff2',
  'fuentes/great-vibes-latin-400-normal.woff2',
  'fuentes/lora-latin-700-normal.woff2',
  'fuentes/merriweather-latin-700-normal.woff2',
  'fuentes/montserrat-latin-500-normal.woff2',
  'fuentes/montserrat-latin-600-normal.woff2',
  'fuentes/montserrat-latin-700-normal.woff2',
  'fuentes/montserrat-latin-800-normal.woff2',
  'fuentes/montserrat-latin-900-normal.woff2',
  'fuentes/nunito-latin-800-normal.woff2',
  'fuentes/oswald-latin-600-normal.woff2',
  'fuentes/playfair-display-latin-700-normal.woff2',
  'fuentes/source-sans-3-latin-700-normal.woff2',
];

describe('archivosDeRewrites', () => {
  test('saca las páginas comunes y las carpetas del vercel.json real', () => {
    expect(archivosDeRewrites(vercel)).toEqual({ paginas: PAGINAS, carpetas: ['fuentes', 'img'] });
  });

  test('una regla que no entiende lanza un error que la nombra', () => {
    expect(() => archivosDeRewrites({ rewrites: [{ source: '/:slug/(.*)' }] })).toThrow(
      '/:slug/(.*)',
    );
  });
});

describe('copiarVicaria', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copiar-vicaria-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // Pasa las rutas a relativas a tmp y con «/», para comparar igual en Windows.
  const relativas = (rutas) =>
    rutas.map((r) => path.relative(tmp, r).split(path.sep).join('/'));
  const existe = (r) => fs.existsSync(path.join(tmp, ...r.split('/')));

  test('copia las páginas comunes, las fuentes y las imágenes', () => {
    const copiadas = relativas(copiarVicaria(raizRepo, tmp));

    for (const r of [
      'vicaria/panel.html',
      'vicaria/parroquia.js',
      'vicaria/estilos.css',
      'vicaria/fuentes/montserrat-latin-700-normal.woff2',
      'vicaria/img/santo.png',
    ]) {
      expect(copiadas).toContain(r);
      expect(existe(r)).toBe(true);
    }
  });

  test('no copia las carpetas de parroquias ni lo que no es de las páginas', () => {
    const copiadas = relativas(copiarVicaria(raizRepo, tmp));

    expect(copiadas.some((r) => r.startsWith('vicaria/ciudad-arce/'))).toBe(false);
    expect(copiadas.some((r) => r.includes('san-jose-ejemplo'))).toBe(false);
    for (const r of [
      'vicaria/ciudad-arce/config.json',
      'vicaria/vercel.json',
      'vicaria/LEEME-config.md',
      'vicaria/fuentes/LICENCIAS.md',
    ]) {
      expect(existe(r)).toBe(false);
    }
  });

  test('escribe el manifiesto con las páginas y los estáticos', () => {
    copiarVicaria(raizRepo, tmp);

    const manifiesto = JSON.parse(
      fs.readFileSync(path.join(tmp, 'vicaria', 'manifiesto.json'), 'utf8'),
    );
    expect(manifiesto).toEqual({
      paginas: PAGINAS,
      estaticos: [...FUENTES, 'img/custodia.png', 'img/santo.png'],
    });
  });

  test('la transición es la página de la parroquia: no copia videos y borra app/transiciones/ de antes', () => {
    fs.mkdirSync(path.join(tmp, 'app', 'transiciones'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'app', 'transiciones', 'Transicion_2000ms_Logo.webm'), 'viejo');

    const copiadas = relativas(copiarVicaria(raizRepo, tmp));

    expect(copiadas).toContain('vicaria/transicion.html');
    expect(copiadas).toContain('vicaria/transicion.js');
    expect(copiadas.filter((r) => r.endsWith('.webm'))).toEqual([]);
    expect(existe('app/transiciones')).toBe(false);
  });

  test('borra un destino/obs/ viejo y lo viejo de destino/vicaria/', () => {
    fs.mkdirSync(path.join(tmp, 'obs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'obs', 'panel.html'), 'viejo');
    fs.mkdirSync(path.join(tmp, 'vicaria'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'vicaria', 'viejo.txt'), 'viejo');

    copiarVicaria(raizRepo, tmp);

    expect(existe('obs')).toBe(false);
    expect(existe('vicaria/viejo.txt')).toBe(false);
  });

  test('no toca la página propia de la app en destino/app/', () => {
    fs.mkdirSync(path.join(tmp, 'app'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'app', 'transicion.html'), 'propia');

    copiarVicaria(raizRepo, tmp);

    expect(fs.readFileSync(path.join(tmp, 'app', 'transicion.html'), 'utf8')).toBe('propia');
  });
});
