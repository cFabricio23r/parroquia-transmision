/*
  Exporta la pantalla final «Producción» (obs/produccion.html) como dos PNG de 1920×1080, uno por
  estilo, para usarlos en otros videos (Tarea 9d):
    exportados/produccion-claro.png
    exportados/produccion-azul.png
  La carpeta exportados/ queda fuera de obs/, así la app no la copia, y fuera de git.

  Uso:  node herramientas/exportar-produccion.js [carpeta-de-salida]
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const raiz = path.resolve(__dirname, '..');
const salida = path.resolve(process.argv[2] || path.join(raiz, 'exportados'));
const pagina = path.join(raiz, 'obs', 'produccion.html');
const url = (estilo) =>
  'file://' + pagina.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:') + '?estilo=' + estilo;

(async () => {
  fs.mkdirSync(salida, { recursive: true });
  const b = await chromium.launch();
  let fallo = false;
  try {
    for (const estilo of ['claro', 'azul']) {
      const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      await p.goto(url(estilo));
      // Fuentes e imágenes cargadas antes de sacar la foto.
      const listo = await p.evaluate(async () => {
        await document.fonts.ready;
        const imgs = [...document.images];
        await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
        return document.fonts.check('900 40px Mont') && imgs.every((i) => i.naturalWidth > 0) && document.body.dataset.estilo;
      });
      if (listo !== estilo || errores.length) {
        console.error(`✘ ${estilo}: la página no quedó lista (${listo}) ${errores.join('; ')}`);
        fallo = true;
      } else {
        const archivo = path.join(salida, `produccion-${estilo}.png`);
        await p.screenshot({ path: archivo, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
        console.log(`✔ ${archivo}`);
      }
      await p.close();
    }
  } finally {
    await b.close();
  }
  process.exit(fallo ? 1 : 0);
})();
