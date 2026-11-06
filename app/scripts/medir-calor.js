// Medición de calor para una transmisión larga (Tarea 7, paso 3b; se usa en la Tarea 10).
//
// Corre en la PC con el celular conectado por USB (adb). No toca la app ni la transmisión:
// solo lee. Anota al inicio, cada `--cada` minutos y al final:
//   - dumpsys battery (nivel, temperatura, estado de carga);
//   - dumpsys thermalservice (estado térmico y temperaturas del HAL);
//   - memoria: TOTAL PSS de la app y los procesos renderer de WebView (sandboxed_process);
//   - fps y redibujos de la capa, de las líneas «fps=» y «capa:» de logcat (etiqueta Transmisor).
//
// Seguridad: de logcat se lee solo la etiqueta «Transmisor» (Log.w de la app), que nunca lleva
// la URL ni la clave. No se guarda nada más del log.
//
// Uso (en segundo plano, desde app/):
//   node scripts/medir-calor.js --minutos 30 --cada 5 --salida C:\ruta\calor.txt
// Ctrl+C corta antes de tiempo y anota la muestra final.
const { execFileSync } = require('child_process');
const fs = require('fs');

const PAQUETE = 'org.parroquiaarce.envivo';

function opcion(nombre, porDefecto) {
  const i = process.argv.indexOf('--' + nombre);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

const minutos = Number(opcion('minutos', '30'));
const cada = Number(opcion('cada', '5'));
// Con un número inválido, setInterval(…, NaN) llamaría a adb sin parar (review M10).
if (!(minutos > 0) || !(cada > 0)) {
  console.error('Uso: node scripts/medir-calor.js --minutos <número > 0> --cada <número > 0> [--salida archivo]');
  process.exit(1);
}
const salida = opcion('salida', `calor-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);

function adb(...args) {
  try {
    return execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60_000 });
  } catch (e) {
    return `(adb ${args.join(' ')} falló: ${e.message.split('\n')[0]})`;
  }
}

function lineas(texto, filtro) {
  return texto.split(/\r?\n/).filter((l) => filtro.test(l)).map((l) => l.trim());
}

function bateria() {
  return lineas(adb('shell', 'dumpsys', 'battery'), /^\s*(level|temperature|status|AC powered|USB powered|current now|voltage):/i);
}

function termico() {
  const t = adb('shell', 'dumpsys', 'thermalservice');
  const estado = lineas(t, /Thermal Status:/i);
  // Bloque «Current temperatures from HAL»: una línea por sensor.
  const i = t.indexOf('Current temperatures from HAL');
  const hal = i >= 0 ? lineas(t.slice(i).split(/\n\s*\n/)[0], /Temperature\{/) : [];
  return [...estado, ...hal.map((l) => l.replace(/^.*?mValue=([\d.]+).*?mName=([^,]+).*?mStatus=(\d+).*$/, '$2 $1 °C (estado $3)'))];
}

function memoria() {
  const app = lineas(adb('shell', 'dumpsys', 'meminfo', PAQUETE), /TOTAL PSS|TOTAL:|Graphics:/);
  // Los renderer de WebView son procesos aparte; puede haber de otras apps (ver prueba-tecnica.md, punto 3).
  const todos = adb('shell', 'dumpsys', 'meminfo');
  const fin = todos.indexOf('Total PSS by OOM');
  const porProceso = fin > 0 ? todos.slice(0, fin) : todos;
  // La lista sale dos veces (PSS y RSS por proceso): se queda la primera aparición de cada pid.
  const vistos = new Set();
  const renderers = lineas(porProceso, /sandboxed_process/)
    .filter((l) => {
      const pid = (l.match(/\(pid (\d+)/) || [])[1];
      if (!pid || vistos.has(pid)) return false;
      vistos.add(pid);
      return true;
    })
    .slice(0, 6);
  return [...app, ...renderers.map((l) => 'renderer: ' + l)];
}

function fps() {
  const log = adb('logcat', '-d', '-v', 'time', '-s', 'Transmisor:W');
  const f = lineas(log, /fps=\d+/).slice(-6);
  const capa = lineas(log, /capa: dibujos=/).slice(-3);
  return [...f, ...capa];
}

function muestra(titulo) {
  const bloque = [
    `== ${titulo} · ${new Date().toLocaleString('es')} ==`,
    '-- batería', ...bateria(),
    '-- térmico', ...termico(),
    '-- memoria (KB)', ...memoria(),
    '-- fps y capa (logcat, etiqueta Transmisor)', ...fps(),
    '',
  ].join('\n');
  fs.appendFileSync(salida, bloque + '\n');
  console.log(bloque);
}

let terminado = false;
function final() {
  if (terminado) return;
  terminado = true;
  muestra('FINAL');
  console.log(`medir-calor: listo, anotado en ${salida}`);
  process.exit(0);
}

process.on('SIGINT', final);
console.log(`medir-calor: ${minutos} min, una muestra cada ${cada} min → ${salida}`);
muestra('INICIO');
const inicio = Date.now();
const reloj = setInterval(() => {
  const pasados = (Date.now() - inicio) / 60_000;
  if (pasados >= minutos) {
    clearInterval(reloj);
    final();
  } else {
    muestra(`minuto ${Math.round(pasados)}`);
  }
}, cada * 60_000);
