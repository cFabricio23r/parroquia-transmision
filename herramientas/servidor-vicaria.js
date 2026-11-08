/*
  Servidor local de vicaria/ para probar a mano y para las pruebas del navegador.
  Uso:  node herramientas/servidor-vicaria.js [PUERTO]     (por defecto 8080)

  Lee vicaria/vercel.json y aplica sus `rewrites` y `headers`: así hay una sola fuente de verdad
  y lo que se prueba aquí es lo mismo que se publica.

  NO VERIFICADO: la sintaxis de patrones de Vercel. Este servidor solo entiende las formas que
  usa vicaria/vercel.json: texto fijo, `:nombre` (un segmento) y `:nombre(a|b|c)` (uno de varios
  textos fijos). Cualquier otro patrón se rechaza al arrancar. Que Vercel interprete esos mismos
  patrones igual se comprueba en la Tarea 8, ya publicado.

  Orden (como Vercel, según lo entendemos; no verificado): primero el archivo si existe; si no,
  los rewrites; si nada coincide, 404. Nunca lista carpetas.
*/
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', 'vicaria');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Convierte un patrón de vercel.json en { re, nombres }. Rechaza lo que no entiende. */
function compilarPatron(patron) {
  const nombres = [];
  let re = '';
  const trozo = /:([A-Za-z_]\w*)(?:\(([A-Za-z0-9_|-]+)\))?|([A-Za-z0-9_./-]+)/y;
  let pos = 0;
  while (pos < patron.length) {
    trozo.lastIndex = pos;
    const m = trozo.exec(patron);
    if (!m) throw new Error('Patrón no soportado por servidor-vicaria.js: ' + patron);
    if (m[3] !== undefined) {
      re += escapar(m[3]);
    } else {
      nombres.push(m[1]);
      re += m[2] ? '(' + m[2].split('|').map((a) => a).join('|') + ')' : '([^/]+)';
    }
    pos = trozo.lastIndex;
  }
  return { re: new RegExp('^' + re + '$'), nombres };
}

function emparejar(compilado, ruta) {
  const m = compilado.re.exec(ruta);
  if (!m) return null;
  const valores = {};
  compilado.nombres.forEach((n, i) => { valores[n] = m[i + 1]; });
  return valores;
}

function rellenarDestino(destino, valores) {
  return destino.replace(/:([A-Za-z_]\w*)/g, (_, n) => {
    if (!(n in valores)) throw new Error('El destino usa :' + n + ' que el origen no define.');
    return valores[n];
  });
}

function leerReglas() {
  const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  return {
    rewrites: (cfg.rewrites || []).map((r) => ({ patron: compilarPatron(r.source), destino: r.destination })),
    headers: (cfg.headers || []).map((h) => ({ patron: compilarPatron(h.source), headers: h.headers }))
  };
}

/* Ruta de archivo dentro de vicaria/ (distingue mayúsculas aunque el disco no lo haga), o null. */
function archivoDe(ruta) {
  let rel;
  try { rel = decodeURIComponent(ruta); } catch (e) { return null; }
  if (rel.includes('\0') || rel.includes('\\')) return null;
  const completo = path.resolve(RAIZ, '.' + rel);
  if (completo !== RAIZ && !completo.startsWith(RAIZ + path.sep)) return null;
  try {
    if (!fs.statSync(completo).isFile()) return null;
    // En Windows /Ciudad-Arce/x existiría aunque la carpeta sea ciudad-arce: se exige el mismo nombre real.
    if (fs.realpathSync.native(completo) !== fs.realpathSync.native(RAIZ) + path.sep + path.relative(RAIZ, completo)) return null;
  } catch (e) {
    return null;
  }
  return completo;
}

function crearServidor() {
  const reglas = leerReglas();
  return http.createServer((req, res) => {
    const ruta = new URL(req.url, 'http://localhost').pathname;
    let archivo = archivoDe(ruta);
    if (!archivo) {
      for (const r of reglas.rewrites) {
        const v = emparejar(r.patron, ruta);
        if (v) { archivo = archivoDe(rellenarDestino(r.destino, v)); break; }
      }
    }
    if (!archivo || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
      return;
    }
    const cabeceras = { 'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream' };
    for (const h of reglas.headers) {
      if (emparejar(h.patron, ruta)) for (const kv of h.headers) cabeceras[kv.key.toLowerCase()] = kv.value;
    }
    res.writeHead(200, cabeceras);
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(archivo).pipe(res);
  });
}

if (require.main === module) {
  const puerto = Number(process.argv[2] || 8080);
  crearServidor().listen(puerto, () => console.log('vicaria/ en http://localhost:' + puerto + '/<slug>/panel.html'));
}

module.exports = { crearServidor, compilarPatron, emparejar, TIPOS };
