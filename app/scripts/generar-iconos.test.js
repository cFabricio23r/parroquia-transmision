/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { SALIDAS, renderizar, generar } = require('./generar-iconos');

const raizApp = path.resolve(__dirname, '..');
const svg = (nombre) => path.join(raizApp, 'assets', 'icono', nombre);

// Ancho y alto de un PNG, leídos del encabezado IHDR.
function medidaPng(ruta) {
  const b = fs.readFileSync(ruta);
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

// Recorre los píxeles RGBA y llama a `f(x, y, r, g, b, a)` en cada uno.
function cadaPixel({ ancho, alto, pixeles }, f) {
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      f(x, y, pixeles[i], pixeles[i + 1], pixeles[i + 2], pixeles[i + 3]);
    }
  }
}

describe('íconos', () => {
  test('el primer plano del ícono adaptativo queda dentro de la zona segura (66 dp de 108)', () => {
    const img = renderizar(svg('frente.svg'), 1024);
    const centro = 512;
    // Radio de la zona segura en píxeles, más 1 px de borde suavizado.
    const radioSeguro = (33 / 108) * 1024 + 1;
    let maximo = 0;
    let visibles = 0;
    cadaPixel(img, (x, y, _r, _g, _b, a) => {
      if (a === 0) return;
      visibles++;
      maximo = Math.max(maximo, Math.hypot(x + 0.5 - centro, y + 0.5 - centro));
    });
    expect(visibles).toBeGreaterThan(0);
    expect(maximo).toBeLessThanOrEqual(radioSeguro);
  });

  // Píxel (r, g, b, a) de una imagen de resvg, en coordenadas del dibujo de `lado` unidades.
  function pixel(img, lado, x, y) {
    const px = Math.floor((x / lado) * img.ancho);
    const py = Math.floor((y / lado) * img.alto);
    const i = (py * img.ancho + px) * 4;
    return Array.from(img.pixeles.slice(i, i + 4));
  }

  test('el ícono común (opción 1) lleva el logo incrustado, el punto rojo y el degradado azul', () => {
    const img = renderizar(svg('icono.svg'), 1024);
    // La línea central del logo: tiene blanco opaco (el logo se cargó).
    let blancos = 0;
    for (let y = 70; y < 150; y++) {
      const [r, g, b, a] = pixel(img, 220, 110, y);
      if (a === 255 && r > 250 && g > 250 && b > 250) blancos++;
    }
    expect(blancos).toBeGreaterThan(10);
    // El centro del punto en vivo: #dd0300.
    expect(pixel(img, 220, 174.9, 45.1)).toEqual([0xdd, 0x03, 0x00, 255]);
    // El degradado: abajo a la izquierda, lejos del logo y del brillo, es azul.
    const [r, g, b, a] = pixel(img, 220, 30, 190);
    expect(a).toBe(255);
    expect(b).toBeGreaterThan(r + 60);
    expect(b).toBeGreaterThan(g);
  });

  test('el primer plano lleva el logo blanco y el punto rojo', () => {
    const img = renderizar(svg('frente.svg'), 1024);
    let blancos = 0;
    let rojos = 0;
    cadaPixel(img, (_x, _y, r, g, b, a) => {
      if (a === 255 && r > 250 && g > 250 && b > 250) blancos++;
      if (a === 255 && r === 0xdd && g === 0x03 && b === 0) rojos++;
    });
    expect(blancos).toBeGreaterThan(1000);
    expect(rojos).toBeGreaterThan(100);
  });

  test('el fondo del ícono adaptativo es opaco en todo el cuadro', () => {
    const img = renderizar(svg('fondo.svg'), 108);
    let transparentes = 0;
    cadaPixel(img, (_x, _y, _r, _g, _b, a) => {
      if (a !== 255) transparentes++;
    });
    expect(transparentes).toBe(0);
  });

  test.each(['monocromo.svg', 'notificacion.svg'])('%s es solo blanco sobre transparente', (nombre) => {
    const img = renderizar(svg(nombre), 96);
    let visibles = 0;
    let deColor = 0;
    let transparentes = 0;
    cadaPixel(img, (_x, _y, r, g, b, a) => {
      if (a === 0) {
        transparentes++;
        return;
      }
      visibles++;
      // Los píxeles de resvg vienen premultiplicados: un blanco con transparencia a tiene r = g = b = a.
      if (Math.abs(r - a) > 2 || Math.abs(g - a) > 2 || Math.abs(b - a) > 2) deColor++;
    });
    expect(visibles).toBeGreaterThan(0);
    expect(transparentes).toBeGreaterThan(0);
    expect(deColor).toBe(0);
  });

  test('el ícono de la notificación no toca el borde (1 dp de aire)', () => {
    const img = renderizar(svg('notificacion.svg'), 24);
    let enElBorde = 0;
    cadaPixel(img, (x, y, _r, _g, _b, a) => {
      if (a > 0 && (x === 0 || y === 0 || x === 23 || y === 23)) enElBorde++;
    });
    expect(enElBorde).toBe(0);
  });

  describe('generar', () => {
    let tmp;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'generar-iconos-'));
    });

    afterEach(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    test('escribe cada PNG con su tamaño', () => {
      const escritos = generar(raizApp, tmp);
      expect(escritos).toHaveLength(SALIDAS.length);
      for (const s of SALIDAS) {
        const ruta = path.join(tmp, s.destino);
        expect(medidaPng(ruta)).toEqual({ ancho: s.ancho, alto: s.ancho });
      }
    });

    test('incluye el ícono común, las 3 capas del adaptativo y la notificación en las 5 densidades', () => {
      const destinos = SALIDAS.map((s) => s.destino.split(path.sep).join('/'));
      expect(destinos).toEqual(
        expect.arrayContaining([
          'assets/icono/icono.png',
          'assets/icono/fondo.png',
          'assets/icono/frente.png',
          'assets/icono/monocromo.png',
        ]),
      );
      const notif = SALIDAS.filter((s) => s.destino.endsWith('ic_notificacion.png'));
      expect(notif.map((s) => s.ancho).sort((a, b) => a - b)).toEqual([24, 36, 48, 72, 96]);
    });
  });
});
