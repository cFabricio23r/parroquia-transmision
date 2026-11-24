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
import { BASE, igual, revisar, terminar } from './lib/editor.mjs';

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
} finally {
  await navegador.close();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('transicion');
