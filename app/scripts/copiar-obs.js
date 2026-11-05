// Copia las páginas de obs/ y la transición del logo a los assets del módulo
// Transmisor, para que la app las cargue desde file:///android_asset/obs/.
// Se corre solo antes de `npm run android` (script «preandroid»).
const fs = require('fs');
const path = require('path');

const TRANSICION = 'Transicion_2000ms_Logo.webm';

// Lista todos los archivos (no carpetas) que hay debajo de `carpeta`.
function listarArchivos(carpeta) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    return entrada.isDirectory() ? listarArchivos(ruta) : [ruta];
  });
}

// Copia `raizRepo/obs/**` y la transición del logo a `destino/obs/`.
// Borra antes lo que hubiera en `destino/obs/`. Devuelve las rutas copiadas.
function copiarObs(raizRepo, destino) {
  const salida = path.join(destino, 'obs');
  fs.rmSync(salida, { recursive: true, force: true });

  fs.cpSync(path.join(raizRepo, 'obs'), salida, { recursive: true });
  fs.mkdirSync(path.join(salida, 'transiciones'), { recursive: true });
  fs.cpSync(
    path.join(raizRepo, 'transiciones', TRANSICION),
    path.join(salida, 'transiciones', TRANSICION),
  );

  return listarArchivos(salida);
}

module.exports = { copiarObs };

if (require.main === module) {
  const raizRepo = path.resolve(__dirname, '..', '..');
  const destino = path.join(
    __dirname, '..', 'modules', 'transmisor', 'android', 'src', 'main', 'assets',
  );
  const copiadas = copiarObs(raizRepo, destino);
  console.log(`copiar-obs: ${copiadas.length} archivos copiados a ${path.join(destino, 'obs')}`);
}
