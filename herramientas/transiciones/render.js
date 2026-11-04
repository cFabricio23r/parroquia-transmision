/*
  Genera las transiciones Stinger para OBS (video .webm con transparencia + sonido).

  Uso (desde la carpeta raíz del repositorio):
    npm install
    npx playwright install chromium
    npm run transiciones

  O una sola:
    node herramientas/transiciones/render.js --plantilla stinger.html --duracion 2 --salida transiciones/Transicion_2000ms_Logo.webm

  Requiere ffmpeg en el PATH (https://www.gyan.dev/ffmpeg/builds/ → agregar la carpeta bin al PATH).
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

function arg(nombre, defecto) {
  const i = process.argv.indexOf('--' + nombre);
  return i > -1 ? process.argv[i + 1] : defecto;
}

const plantilla = path.resolve(__dirname, arg('plantilla', 'stinger.html'));
const duracion = parseFloat(arg('duracion', '2'));
const salida = path.resolve(process.cwd(), arg('salida', 'transiciones/Transicion.webm'));
const conSonido = arg('sonido', 'si') !== 'no';
const fps = 60;

/* ---------- sonido: soplo suave + campanita (sintetizado, sin archivos externos) ---------- */
function crearSonido(archivo, D) {
  const sr = 48000, n = Math.floor(sr * D), s = D / 1.2;
  let semilla = 7; const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296 * 2 - 1; };
  const L = new Float32Array(n), R = new Float32Array(n);
  let p = 0, q = 0, max = 0;
  const mezcla = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.exp(-(((t - 0.42 * s) / (0.17 * s)) ** 2)) * 0.9 + Math.exp(-(((t - 0.86 * s) / (0.15 * s)) ** 2)) * 0.6;
    const corte = 600 + 3400 * Math.exp(-(((t - 0.45 * s) / (0.2 * s)) ** 2)) + 1800 * Math.exp(-(((t - 0.86 * s) / (0.18 * s)) ** 2));
    const a = 1 - Math.exp(-2 * Math.PI * corte / sr);
    p += a * (azar() - p); q += a * (p - q);
    mezcla[i] = (p - 0.6 * q) * env;
    max = Math.max(max, Math.abs(mezcla[i]));
  }
  const t0 = 0.55 * s; let maxC = 0; const camp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tt = i / sr - t0; if (tt < 0) continue;
    let c = 0; for (const [f, amp] of [[1318.5, 1], [1975.5, .45], [2637, .25], [659.25, .35]]) c += amp * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 3.0);
    camp[i] = c * Math.min(1, tt / 0.004); maxC = Math.max(maxC, Math.abs(camp[i]));
  }
  let maxF = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const m = (0.55 * mezcla[i] / max + 0.35 * camp[i] / maxC) * Math.min(1, Math.max(0, (D - t) / 0.2));
    const pan = 1 - t / D;
    L[i] = m * (0.6 + 0.4 * (1 - pan)); R[i] = m * (0.6 + 0.4 * pan);
    maxF = Math.max(maxF, Math.abs(L[i]), Math.abs(R[i]));
  }
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(L[i] / maxF * 0.6 * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(R[i] / maxF * 0.6 * 32767), 46 + i * 4);
  }
  fs.writeFileSync(archivo, buf);
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stinger-'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript((d) => { window.DURACION_TOTAL = d; }, duracion);
  await p.goto('file://' + plantilla.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const n = Math.round(fps * duracion);
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => window.setFrame(t), f / fps);
    await p.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.png`), omitBackground: true });
    if (f % 20 === 0) process.stdout.write(`  cuadro ${f}/${n}\r`);
  }
  await b.close();

  fs.mkdirSync(path.dirname(salida), { recursive: true });
  const entrada = ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.png')];
  let audio = [];
  if (conSonido) {
    const wav = path.join(tmp, 'sonido.wav'); crearSonido(wav, duracion);
    entrada.push('-i', wav); audio = ['-map', '0:v', '-map', '1:a', '-c:a', 'libopus', '-b:a', '160k', '-shortest'];
  }
  execFileSync('ffmpeg', [...entrada, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '6M', '-auto-alt-ref', '0', '-row-mt', '1', ...audio, salida], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nListo:', salida, `(punto de transición en OBS: ${Math.round(duracion * 500)} ms)`);
})();
