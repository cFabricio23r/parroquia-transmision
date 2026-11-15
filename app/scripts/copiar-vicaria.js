// Copia las páginas comunes de vicaria/ (nunca las carpetas de parroquias) y la
// transición del logo a los assets del módulo Transmisor. Es el respaldo dentro
// de la app: Interceptor.kt lo sirve cuando la copia de la parroquia no tiene un
// archivo. Escribe también vicaria/manifiesto.json, que leen Copias.kt e
// Interceptor.kt. Se corre solo antes de `npm run android` (script «preandroid»).
const fs = require('fs');
const path = require('path');

const TRANSICION = 'Transicion_2000ms_Logo.webm';

// Las extensiones que sirve Interceptor.kt. Lo demás (LICENCIAS.md, por
// ejemplo) no es parte de las páginas y no entra en la app.
const EXTENSIONES = /\.(html|js|css|json|png|jpe?g|webp|svg|woff2)$/i;

// Las tres formas de regla de vicaria/vercel.json que se entienden:
//   /:slug/:x(a|b).ext       → a.ext, b.ext
//   /:slug/nombre.ext        → nombre.ext
//   /:slug/<carpeta>/:archivo → la carpeta entera
const VARIAS = /^\/:slug\/:[a-z]+\(([a-z0-9|-]+)\)\.([a-z0-9]+)$/i;
const UNA = /^\/:slug\/([a-z0-9-]+\.[a-z0-9]+)$/i;
const CARPETA = /^\/:slug\/([a-z0-9-]+)\/:archivo$/i;

// Saca de los rewrites de vercel.json qué páginas y qué carpetas son comunes a
// todas las parroquias. Lanza con la regla si hay una que no entiende.
function archivosDeRewrites(vercel) {
  const paginas = new Set();
  const carpetas = new Set();
  for (const { source } of vercel.rewrites) {
    let m;
    if ((m = VARIAS.exec(source))) {
      for (const nombre of m[1].split('|')) paginas.add(`${nombre}.${m[2]}`);
    } else if ((m = UNA.exec(source))) {
      paginas.add(m[1]);
    } else if ((m = CARPETA.exec(source))) {
      carpetas.add(m[1]);
    } else {
      throw new Error(`copiar-vicaria: no entiendo la regla de vercel.json ${source}`);
    }
  }
  return { paginas: [...paginas].sort(), carpetas: [...carpetas].sort() };
}

// Lista todos los archivos (no carpetas) que hay debajo de `carpeta`.
function listarArchivos(carpeta) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    return entrada.isDirectory() ? listarArchivos(ruta) : [ruta];
  });
}

// Copia las páginas comunes a `destino/vicaria/`, con su manifiesto, y la
// transición del logo a `destino/app/transiciones/`. Borra antes lo que hubiera
// en esas dos carpetas y la copia vieja de obs/. Devuelve las rutas copiadas.
function copiarVicaria(raizRepo, destino) {
  const origen = path.join(raizRepo, 'vicaria');
  const salida = path.join(destino, 'vicaria');
  const transiciones = path.join(destino, 'app', 'transiciones');
  fs.rmSync(path.join(destino, 'obs'), { recursive: true, force: true });
  fs.rmSync(salida, { recursive: true, force: true });
  fs.rmSync(transiciones, { recursive: true, force: true });

  const vercel = JSON.parse(fs.readFileSync(path.join(origen, 'vercel.json'), 'utf8'));
  const { paginas, carpetas } = archivosDeRewrites(vercel);

  const estaticos = carpetas.flatMap((carpeta) =>
    listarArchivos(path.join(origen, carpeta))
      .map((r) => path.relative(origen, r).split(path.sep).join('/'))
      .filter((r) => EXTENSIONES.test(r)),
  ).sort();

  fs.mkdirSync(salida, { recursive: true });
  for (const r of [...paginas, ...estaticos]) {
    const hacia = path.join(salida, ...r.split('/'));
    fs.mkdirSync(path.dirname(hacia), { recursive: true });
    fs.copyFileSync(path.join(origen, ...r.split('/')), hacia);
  }
  fs.writeFileSync(
    path.join(salida, 'manifiesto.json'),
    JSON.stringify({ paginas, estaticos }, null, 2) + '\n',
  );

  fs.mkdirSync(transiciones, { recursive: true });
  fs.copyFileSync(
    path.join(raizRepo, 'transiciones', TRANSICION),
    path.join(transiciones, TRANSICION),
  );

  return [...listarArchivos(salida), ...listarArchivos(transiciones)];
}

// El núcleo de la semana dentro de la app (plan 3b, Decisión 1): copia
// vicaria/semana.js byte a byte a `destinoSrc/generado/semana.js` y escribe
// `destinoSrc/generado/tipos-comunes.json`, los campos de los tipos comunes
// (tipos.js corrido en un vm y pasado por SEMANA.tiposParaCampos).
function generarNucleo(raizRepo, destinoSrc) {
  const vm = require('vm');
  const origen = path.join(raizRepo, 'vicaria');
  const salida = path.join(destinoSrc, 'generado');
  fs.mkdirSync(salida, { recursive: true });
  const textoSemana = fs.readFileSync(path.join(origen, 'semana.js'));
  fs.writeFileSync(path.join(salida, 'semana.js'), textoSemana);

  const contexto = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(path.join(origen, 'tipos.js'), 'utf8') +
      '\nthis.TIPOS = TIPOS; this.ORDEN_TIPOS = ORDEN_TIPOS;',
    contexto,
    { filename: 'tipos.js' },
  );
  const modulo = { exports: {} };
  vm.runInContext(textoSemana.toString('utf8'), vm.createContext({ module: modulo }), {
    filename: 'semana.js',
  });
  const campos = modulo.exports.tiposParaCampos(contexto.TIPOS, contexto.ORDEN_TIPOS);
  fs.writeFileSync(
    path.join(salida, 'tipos-comunes.json'),
    JSON.stringify(campos, null, 2) + '\n',
  );
}

module.exports = { archivosDeRewrites, copiarVicaria, generarNucleo };

if (require.main === module) {
  const raizRepo = path.resolve(__dirname, '..', '..');
  const destino = path.join(
    __dirname, '..', 'modules', 'transmisor', 'android', 'src', 'main', 'assets',
  );
  const copiadas = copiarVicaria(raizRepo, destino);
  console.log(`copiar-vicaria: ${copiadas.length} archivos copiados a ${destino}`);
  generarNucleo(raizRepo, path.join(__dirname, '..', 'src'));
  console.log('copiar-vicaria: núcleo de la semana en src/generado');
}
