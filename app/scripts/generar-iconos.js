// Genera los PNG del ícono de la app (Tarea 9b; ícono 2.0, opción 1, en la 9f) desde los SVG fuente
// de assets/icono/. Se corre a mano con `npm run iconos` cuando cambia un SVG; los PNG quedan en git.
// Rasteriza con @resvg/resvg-js (devDependency fijada en 2.6.2), sin fuentes del sistema:
// los íconos no llevan texto.
// Los SVG usan el logo de la parroquia (assets/portada/logo-blanco.png) con una ruta relativa, que se
// ve al abrirlos en un navegador; antes de rasterizar, la ruta se cambia por el PNG incrustado
// (data:), que resvg sí carga (comprobado con los tests).
//
// - Ícono común y capas del ícono adaptativo, a 1024 px: Expo los achica a cada densidad al
//   compilar (`icon` y `android.adaptiveIcon` de app.json).
// - Ícono de la notificación: va directo a los recursos del módulo transmisor, en las 5 densidades
//   de 24 dp (ServicioTransmision.kt lo usa como R.drawable.ic_notificacion).
// - El logo del splash, de la portada y de los íconos se copia de obs/img/logo-blanco.png, sin cambios.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ICONO = path.join('assets', 'icono');
const RES_MODULO = path.join('modules', 'transmisor', 'android', 'src', 'main', 'res');

// Densidades de Android: 24 dp de la notificación por el multiplicador de cada una.
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const SALIDAS = [
  { svg: 'icono.svg', destino: path.join(ICONO, 'icono.png'), ancho: 1024 },
  { svg: 'fondo.svg', destino: path.join(ICONO, 'fondo.png'), ancho: 1024 },
  { svg: 'frente.svg', destino: path.join(ICONO, 'frente.png'), ancho: 1024 },
  { svg: 'monocromo.svg', destino: path.join(ICONO, 'monocromo.png'), ancho: 1024 },
  ...Object.entries(DENSIDADES).map(([nombre, x]) => ({
    svg: 'notificacion.svg',
    destino: path.join(RES_MODULO, `drawable-${nombre}`, 'ic_notificacion.png'),
    ancho: 24 * x,
  })),
];

// El logo del splash: de obs/ (raíz del repo) a assets/portada/.
const LOGO = {
  origen: path.join('..', 'obs', 'img', 'logo-blanco.png'),
  destino: path.join('assets', 'portada', 'logo-blanco.png'),
};

/** Cambia cada `href="algo.png"` relativo del SVG por el PNG incrustado (data:image/png;base64). */
function incrustarImagenes(texto, carpeta) {
  return texto.replace(/href="([^":]+\.png)"/g, (_, rel) => {
    const datos = fs.readFileSync(path.resolve(carpeta, rel)).toString('base64');
    return `href="data:image/png;base64,${datos}"`;
  });
}

/**
 * Rasteriza `rutaSvg` a `ancho` px. Devuelve el PNG y los píxeles RGBA. Ojo: los píxeles vienen
 * premultiplicados (un blanco con transparencia a da r = g = b = a; comprobado al escribir los tests).
 */
function renderizar(rutaSvg, ancho) {
  const texto = incrustarImagenes(fs.readFileSync(rutaSvg, 'utf8'), path.dirname(rutaSvg));
  const r = new Resvg(texto, {
    fitTo: { mode: 'width', value: ancho },
    font: { loadSystemFonts: false },
  });
  const img = r.render();
  return { ancho: img.width, alto: img.height, pixeles: img.pixels, png: () => img.asPng() };
}

/**
 * Escribe todas las SALIDAS debajo de `destino` (por defecto, la misma app), leyendo los SVG de
 * `raizApp/assets/icono`. Devuelve las rutas escritas. El logo (splash, portada y los SVG) se copia
 * de obs/ solo cuando el destino es la app (en los tests no hace falta).
 */
function generar(raizApp, destino = raizApp) {
  // El logo va primero: los SVG lo leen de assets/portada/.
  if (destino === raizApp) {
    const logo = path.join(raizApp, LOGO.destino);
    fs.mkdirSync(path.dirname(logo), { recursive: true });
    fs.copyFileSync(path.join(raizApp, LOGO.origen), logo);
  }
  const escritos = SALIDAS.map((s) => {
    const img = renderizar(path.join(raizApp, ICONO, s.svg), s.ancho);
    if (img.ancho !== s.ancho || img.alto !== s.ancho) {
      throw new Error(`${s.svg}: salió de ${img.ancho}×${img.alto}, se esperaba ${s.ancho}×${s.ancho}`);
    }
    const ruta = path.join(destino, s.destino);
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, img.png());
    return ruta;
  });
  return escritos;
}

module.exports = { SALIDAS, renderizar, generar };

if (require.main === module) {
  const raizApp = path.resolve(__dirname, '..');
  for (const ruta of generar(raizApp)) console.log(path.relative(raizApp, ruta));
  console.log(LOGO.destino);
}
