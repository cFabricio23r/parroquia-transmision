// Armar el video de la transición en el navegador (pantallas más opciones, Tarea 10): lib/editor/transicion.ts
// con la página de la transición de San José (vicaria/transicion.html) en un iframe del mismo origen.
// Chrome de verdad (channel: 'chrome': el Chromium de Playwright no trae el codificador VP9 con alfa) y una
// página en 127.0.0.1 (VideoEncoder solo existe en páginas seguras). La página de prueba la arma la ruta de
// Playwright: al módulo TypeScript se le borran los tipos acá y 'mediabunny' se resuelve con un import map.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { stripTypeScriptTypes } from 'node:module';
import sharp from 'sharp';
import { BASE, camposSinEtiqueta, CONFIG_BASE, entrar, esperarEnBase, igual, limpiar, prepararParroquia, revisar, terminar, VIEWPORT } from './lib/editor.mjs';

const fuente = readFileSync('lib/editor/transicion.ts', 'utf8');
const modulo = stripTypeScriptTypes(fuente);   // TypeScript 7 no trae API de JS; el módulo solo usa tipos que se borran
const mediabunny = readFileSync('node_modules/mediabunny/dist/bundles/mediabunny.mjs', 'utf8');
const PAGINA = `<!doctype html><meta charset="utf-8"><title>prueba</title>
<script type="importmap">{ "imports": { "mediabunny": "/__prueba/mediabunny.mjs" } }</script>
<iframe id="t" src="/san-jose-ejemplo/transicion.html" width="480" height="270"></iframe>`;

const navegador = await chromium.launch({ channel: 'chrome' });
const errores = [];
try {
  console.log('Transición · armar el video en el navegador');
  const pagina = await navegador.newPage();
  pagina.on('pageerror', (e) => errores.push(String(e)));
  await pagina.route(`${BASE}/__prueba/pagina.html`, (r) => r.fulfill({ contentType: 'text/html', body: PAGINA }));
  await pagina.route(`${BASE}/__prueba/mediabunny.mjs`, (r) => r.fulfill({ contentType: 'text/javascript', body: mediabunny }));
  await pagina.route(`${BASE}/__prueba/transicion.mjs`, (r) => r.fulfill({ contentType: 'text/javascript', body: modulo }));
  await pagina.goto(`${BASE}/__prueba/pagina.html`);
  await pagina.waitForFunction(() => document.getElementById('t').contentWindow?.transicion, null, { timeout: 30_000 });
  const r = await pagina.evaluate(async () => {
    const m = await import('/__prueba/transicion.mjs');
    const w = document.getElementById('t').contentWindow;
    await w.transicion.listo;
    const puede = await m.puedeArmarTransicion();
    const t0 = performance.now();
    const blob = await m.armarTransicion((t) => { w.transicion.cuadro(t); return w.document.getElementById('lienzo'); }, w.sonidoTransicion(48000, 2));
    const segundos = (performance.now() - t0) / 1000;
    const mb = await import('mediabunny');
    const entrada = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    const pistasAudio = (await entrada.getAudioTracks()).length;
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(blob);
    await new Promise((ok, mal) => { v.onloadeddata = ok; v.onerror = () => mal(new Error('el video no se decodifica')); });
    const alfa = async (t, x, y) => {
      v.currentTime = t;
      await new Promise((ok) => { v.onseeked = ok; });
      const c = document.createElement('canvas');
      c.width = 1920; c.height = 1080;
      const g = c.getContext('2d');
      g.drawImage(v, 0, 0, 1920, 1080);
      return g.getImageData(x, y, 1, 1).data[3];
    };
    return {
      puede, tipo: blob.type, kb: Math.round(blob.size / 1024), segundos, pistasAudio, duracion: v.duration,
      esquina: await alfa(0.1, 20, 20), centro: await alfa(1.0, 960, 540),
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    };
  });
  revisar(r.puede, 'Chrome puede armar VP9 con transparencia');
  igual(r.tipo, 'video/webm', 'el archivo es video/webm');
  revisar(r.kb > 100, `pesa más de 100 KB (${r.kb} KB, ${r.segundos.toFixed(1)} s)`);
  revisar(Math.abs(r.duracion - 2) <= 0.05, `dura 2 s (${r.duracion})`);
  igual(r.esquina, 0, 'a 0,1 s la esquina es transparente');
  igual(r.centro, 255, 'a 1,0 s el centro está tapado');
  igual(r.pistasAudio, 1, 'tiene pista de sonido');
  const carpeta = mkdtempSync(path.join(tmpdir(), 'transicion-'));
  const archivo = path.join(carpeta, 'Transicion_san-jose-ejemplo_Logo.webm');
  writeFileSync(archivo, Buffer.from(r.bytes));
  let sonda = null;
  try {
    sonda = execFileSync('ffprobe', ['-v', 'error', '-show_streams', archivo], { encoding: 'utf8' });
  } catch {
    console.log('  (sin ffprobe: no se revisa alpha_mode)');
  }
  if (sonda !== null) revisar(/TAG:alpha_mode=1|TAG:ALPHA_MODE=1/i.test(sonda), 'ffprobe ve alpha_mode=1');
  await pagina.close();

  console.log('Transición · la sección del editor');
  const nuevaPagina = async (correo, antes) => {
    const p = await (await navegador.newContext({ viewport: VIEWPORT, acceptDownloads: true })).newPage();
    p.on('pageerror', (e) => errores.push(String(e)));
    if (antes) await antes(p);
    await entrar(p, correo);
    return p;
  };
  const marco = (p) => p.frameLocator('iframe.pv-previa-marco');
  const descargar = async (p) => {
    const boton = p.getByRole('button', { name: /Descargar transición|Armando el video/ });
    const espera = p.waitForEvent('download', { timeout: 60_000 });
    await boton.click();
    const durante = { texto: (await boton.innerText()).trim(), desactivado: await boton.isDisabled() };
    const d = await espera;
    const ruta = await d.path();
    return { durante, nombre: d.suggestedFilename(), kb: Math.round(readFileSync(ruta).length / 1024) };
  };

  const P = await prepararParroquia({ config: CONFIG_BASE });
  const p1 = await nuevaPagina(P.correo);
  await p1.goto(`${BASE}/editor/p/${P.slug}`);
  const enlace = p1.getByRole('navigation', { name: 'Secciones del editor' }).getByRole('link', { name: /^Transición/ });
  revisar(await enlace.isVisible(), 'la sección «Transición» está en la navegación');
  await enlace.click();
  await p1.waitForURL(`${BASE}/editor/p/${P.slug}/transicion`);
  igual(await p1.locator('h1').innerText(), 'Transición', 'el título es «Transición»');
  const src = await p1.locator('iframe.pv-previa-marco').getAttribute('src');
  revisar(/\/transicion\.html\?/.test(src) && src.includes('repetir=1') && src.includes('version=logo'), `la vista previa es la transición que se repite (${src})`);
  await marco(p1).locator('#lienzo').waitFor({ state: 'attached', timeout: 15_000 });
  const alfas = [];
  for (let i = 0; i < 16; i++) {
    alfas.push(await p1.frames().find((f) => f.url().includes('transicion.html')).evaluate(() => document.getElementById('lienzo').getContext('2d').getImageData(960, 540, 1, 1).data[3]));
    await p1.waitForTimeout(250);
  }
  revisar(alfas.includes(255) && alfas.includes(0), `la vista previa se mueve sola (${alfas.join(',')})`);
  const version = p1.getByRole('group', { name: 'Versión', exact: true });
  igual(JSON.stringify(await version.locator('button').allInnerTexts()), JSON.stringify(['Solo el logo', 'Con la imagen del patrono']), 'las dos versiones');
  revisar(await version.getByRole('button', { name: 'Con la imagen del patrono' }).isDisabled(), 'sin imagen del patrono, la segunda está desactivada');
  revisar(await p1.getByText('Sube la imagen del patrono en Patrono y fiesta para usar esta versión.').isVisible(), 'con la nota que dice por qué');
  revisar(await p1.getByText('Transiciones de escena').isVisible() && await p1.getByText('Stinger', { exact: false }).first().isVisible(), 'dice cómo cargarla en OBS (Stinger)');
  revisar(await p1.getByText('1000 ms', { exact: false }).isVisible(), 'con el punto de transición en 1000 ms');
  revisar(await p1.getByText('Si cambias el logo, los colores o el nombre, vuelve a descargarla.').isVisible(), 'y la nota de volver a descargarla');
  igual((await camposSinEtiqueta(p1)).length, 0, 'todo campo tiene etiqueta');
  const d1 = await descargar(p1);
  igual(d1.durante.texto, 'Armando el video…', 'mientras se arma dice «Armando el video…»');
  revisar(d1.durante.desactivado, 'y está desactivado');
  igual(d1.nombre, `Transicion_${P.slug}_Logo.webm`, 'baja Transicion_<slug>_Logo.webm');
  revisar(d1.kb > 100, `de más de 100 KB (${d1.kb} KB)`);
  revisar(await p1.getByRole('button', { name: 'Descargar transición' }).isEnabled(), 'después el botón vuelve a estar listo');

  console.log('Transición · logo e imagen del patrono recién subidos (almacenamiento de Supabase)');
  const PNG = await sharp({ create: { width: 200, height: 120, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  await p1.goto(`${BASE}/editor/p/${P.slug}/identidad`);
  await p1.locator('input[type=file][data-campo="logo-blanco"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await esperarEnBase(P.id, (c) => /^medios\/logo-blanco-[0-9a-f]{8}\.png$/.test(c.logos?.blanco?.src ?? ''));
  await p1.goto(`${BASE}/editor/p/${P.slug}/patrono`);
  await p1.locator('input[type=file][data-campo="patrono"]').setInputFiles({ name: 'patrono.png', mimeType: 'image/png', buffer: PNG });
  await esperarEnBase(P.id, (c) => /^medios\/patrono-[0-9a-f]{8}\.png$/.test(c.patrono?.imagen?.src ?? ''));
  await p1.goto(`${BASE}/editor/p/${P.slug}/transicion`);
  const marcoT = () => p1.frames().find((f) => f.url().includes('transicion.html'));
  await p1.waitForFunction(() => {
    const w = document.querySelector('iframe.pv-previa-marco')?.contentWindow;
    return !!(w && w.transicion && w.transicion.datos && w.transicion.datos.logo);
  }, null, { timeout: 20_000 });
  revisar(/^http/.test(await marcoT().evaluate(() => window.transicion.datos.logo.src)), 'la vista previa usa el logo del almacenamiento');
  const d2 = await descargar(p1);
  igual(d2.nombre, `Transicion_${P.slug}_Logo.webm`, 'con el logo recién subido la descarga funciona (el canvas no queda contaminado)');
  await version.getByRole('button', { name: 'Con la imagen del patrono' }).click();
  await p1.waitForFunction(() => {
    const w = document.querySelector('iframe.pv-previa-marco')?.contentWindow;
    return !!(w && w.transicion && w.transicion.datos && w.transicion.datos.version === 'patrono');
  }, null, { timeout: 20_000 });
  revisar((await p1.locator('iframe.pv-previa-marco').getAttribute('src')).includes('version=patrono'), 'la vista previa pasa a la versión del patrono');
  const d3 = await descargar(p1);
  igual(d3.nombre, `Transicion_${P.slug}_Patrono.webm`, 'con «Con la imagen del patrono», baja _Patrono.webm');
  revisar(d3.kb > 100, `de más de 100 KB (${d3.kb} KB)`);

  console.log('Transición · navegador sin VideoEncoder');
  const p2 = await nuevaPagina(P.correo, (p) => p.addInitScript(() => { delete window.VideoEncoder; }));
  await p2.goto(`${BASE}/editor/p/${P.slug}/transicion`);
  await p2.getByText('Para descargarla, abre el editor en Chrome o Edge.').waitFor({ timeout: 15_000 });
  revisar(await p2.getByRole('button', { name: 'Descargar transición' }).isDisabled(), 'sin VideoEncoder el botón está desactivado');
  revisar(await p2.getByText('Para descargarla, abre el editor en Chrome o Edge.').isVisible(), 'y dice que se abra en Chrome o Edge');
} finally {
  await navegador.close();
  await limpiar();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('transicion');
