/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { copiarObs } = require('./copiar-obs');

// Raíz del repo: dos carpetas arriba de app/scripts/.
const raizRepo = path.resolve(__dirname, '..', '..');

describe('copiarObs', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copiar-obs-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // Pasa las rutas a relativas a tmp y con «/», para comparar igual en Windows.
  const relativas = (rutas) =>
    rutas.map((r) => path.relative(tmp, r).split(path.sep).join('/'));

  test('copia el panel, los rótulos, los tipos y la transición del logo', () => {
    const copiadas = relativas(copiarObs(raizRepo, tmp));

    expect(copiadas).toEqual(
      expect.arrayContaining([
        'obs/panel.html',
        'obs/rotulos.html',
        'obs/tipos.js',
        'obs/transiciones/Transicion_2000ms_Logo.webm',
      ]),
    );
    expect(fs.existsSync(path.join(tmp, 'obs', 'panel.html'))).toBe(true);
    expect(
      fs.existsSync(path.join(tmp, 'obs', 'transiciones', 'Transicion_2000ms_Logo.webm')),
    ).toBe(true);
  });

  test('no copia la transición de la Virgen', () => {
    const copiadas = relativas(copiarObs(raizRepo, tmp));

    expect(copiadas.some((r) => r.includes('Transicion_2000ms_Virgen.webm'))).toBe(false);
    expect(
      fs.existsSync(path.join(tmp, 'obs', 'transiciones', 'Transicion_2000ms_Virgen.webm')),
    ).toBe(false);
  });

  test('borra lo que había antes en destino/obs/', () => {
    fs.mkdirSync(path.join(tmp, 'obs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'obs', 'viejo.txt'), 'viejo');

    copiarObs(raizRepo, tmp);

    expect(fs.existsSync(path.join(tmp, 'obs', 'viejo.txt'))).toBe(false);
  });
});
