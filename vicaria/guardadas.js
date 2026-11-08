/* Transmisiones guardadas: el panel guarda el estado de una transmisión con un nombre
   (por ejemplo «Hora Santa jueves») para cargarla otra semana. Se carga solo en panel.html,
   después de tipos.js y comun.js.
   Cada Guardada = { id, nombre, tipo, guardadaEn, usadaEn, datos }.
   `datos` es una copia del estado SIN el rótulo al aire (rotulo, rotuloHasta, rotuloDesde):
   cargar una transmisión nunca deja un rótulo en pantalla. */

const CLAVE_GUARDADAS = 'parroquia_obs_guardadas_v1';
const CAMPOS_DE_AIRE = ['rotulo', 'rotuloHasta', 'rotuloDesde'];

const copiaProfunda = (x) => JSON.parse(JSON.stringify(x));
const mismoNombre = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const CLAVE_RESPALDO = 'parroquia_obs_guardadas_v1_respaldo';
const esGuardadaValida = (g) => !!g && typeof g === 'object' && typeof g.id === 'string' && typeof g.nombre === 'string' && !!g.datos && typeof g.datos === 'object';

/* Lo que hay guardado, sin filtrar: { items, crudo }. `items` es la lista tal cual está (puede traer entradas
   rotas); si el valor no se puede leer o no es una lista, `items` es [] y `crudo` guarda el texto original. */
function leerTodo() {
  let crudo = null;
  try { crudo = localStorage.getItem(CLAVE_GUARDADAS); } catch (e) { return { items: [], crudo: null }; }
  if (crudo === null || crudo === '') return { items: [], crudo: null };
  try {
    const lista = JSON.parse(crudo);
    if (Array.isArray(lista)) return { items: lista, crudo: null };
  } catch (e) {}
  return { items: [], crudo };
}

/* Lista guardada, de la más usada a la menos usada. Si lo guardado no se puede leer o no es una lista,
   devuelve []. Las entradas rotas no se muestran (pero se conservan en el almacén al escribir). */
function leerGuardadas() {
  return leerTodo().items
    .filter(esGuardadaValida)
    .sort((a, b) => (b.usadaEn || 0) - (a.usadaEn || 0) || (b.guardadaEn || 0) - (a.guardadaEn || 0));
}

/* Escribe la lista `validas` conservando las entradas rotas que ya había. Si lo guardado era ilegible,
   antes copia el texto original a CLAVE_RESPALDO. Devuelve true si quedó escrito. */
function escribirGuardadas(validas) {
  const { items, crudo } = leerTodo();
  try {
    if (crudo !== null) localStorage.setItem(CLAVE_RESPALDO, crudo);
    localStorage.setItem(CLAVE_GUARDADAS, JSON.stringify(items.filter((g) => !esGuardadaValida(g)).concat(validas)));
    return true;
  } catch (e) { return false; }
}

/* ¿Ya hay una guardada con ese nombre? (sin importar mayúsculas ni espacios de los lados) */
function existeGuardada(nombre) {
  return leerGuardadas().some((g) => mismoNombre(g.nombre, nombre));
}

/* Un id nuevo: la hora en base 36; si ya existe (dos en el mismo milisegundo), sube de a uno. */
function idNuevo(lista) {
  let n = Date.now();
  while (lista.some((g) => g.id === n.toString(36))) n++;
  return n.toString(36);
}

/* Guarda el estado `s` con ese nombre. Si ya hay una con el mismo nombre (sin importar mayúsculas
   ni espacios de los lados), la reemplaza. Un nombre vacío no se guarda: devuelve null. */
function guardarTransmision(nombre, s) {
  nombre = String(nombre || '').trim();
  if (!nombre) return null;
  const datos = copiaProfunda(s);
  CAMPOS_DE_AIRE.forEach((c) => { delete datos[c]; });
  const lista = leerGuardadas();
  const ahora = Date.now();
  const tipo = TIPOS[datos.tipo] ? datos.tipo : 'dominical';
  const previa = lista.find((g) => mismoNombre(g.nombre, nombre));
  const guardada = { id: previa ? previa.id : idNuevo(lista), nombre, tipo, guardadaEn: ahora, usadaEn: ahora, datos };
  return escribirGuardadas(previa ? lista.map((g) => (g === previa ? guardada : g)) : lista.concat(guardada)) ? guardada : null;
}

/* El estado de una guardada, listo para el panel: completo (los estados viejos se migran),
   con el tipo en TIPOS y sin rótulo al aire. Marca la guardada como usada ahora.
   Si el id no existe devuelve null. (`actual` no se usa: se carga la transmisión entera.) */
function cargarTransmision(id, actual) {
  const lista = leerGuardadas();
  const guardada = lista.find((g) => g.id === id);
  if (!guardada) return null;
  const estado = copiaProfunda(normalizarEstado(guardada.datos));
  if (!TIPOS[estado.tipo]) estado.tipo = 'dominical';
  estado.rotulo = 'ninguno';
  estado.rotuloHasta = 0;
  guardada.usadaEn = Date.now();
  escribirGuardadas(lista);
  return estado;
}

/* Copia con el nombre «{nombre} (copia)». Si ese nombre ya existe, queda «(copia 2)», «(copia 3)»… */
function duplicarTransmision(id) {
  const lista = leerGuardadas();
  const origen = lista.find((g) => g.id === id);
  if (!origen) return null;
  let nombre = origen.nombre + ' (copia)';
  for (let n = 2; lista.some((g) => mismoNombre(g.nombre, nombre)); n++) nombre = origen.nombre + ' (copia ' + n + ')';
  const ahora = Date.now();
  const copia = { id: idNuevo(lista), nombre, tipo: origen.tipo, guardadaEn: ahora, usadaEn: ahora, datos: copiaProfunda(origen.datos) };
  return escribirGuardadas(lista.concat(copia)) ? copia : null;
}

/* true si quedó borrada; false si el navegador no dejó escribir. */
function borrarTransmision(id) {
  return escribirGuardadas(leerGuardadas().filter((g) => g.id !== id));
}
