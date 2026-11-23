/* Transmisiones guardadas: el panel guarda el estado de una transmisión con un nombre
   (por ejemplo «Hora Santa jueves») para cargarla otra semana. Se carga solo en panel.html,
   después de parroquia.js, tipos.js, comun.js y guardadas-nucleo.js.
   Cada Guardada = { id, nombre, tipo, guardadaEn, usadaEn, actualizadoEn, datos }.
   `datos` es una copia del estado SIN el rótulo al aire (rotulo, rotuloHasta, rotuloDesde):
   cargar una transmisión nunca deja un rótulo en pantalla. */

const CLAVE_GUARDADAS = claveDe('guardadas_v1');   // pev_<slug>_guardadas_v1: cada parroquia tiene las suyas
const CAMPOS_DE_AIRE = GUARDADAS.CAMPOS_DE_AIRE;   // vienen del núcleo (guardadas-nucleo.js se carga antes)

const copiaProfunda = (x) => JSON.parse(JSON.stringify(x));
const mismoNombre = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const CLAVE_RESPALDO = claveDe('guardadas_v1_respaldo');
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
   devuelve []. Las entradas rotas no se muestran (pero se conservan en el almacén al escribir).
   Las guardadas de antes de la nube no traen actualizadoEn: se completa con el mayor entre guardadaEn y
   usadaEn, para que la fusión y la primera subida comparen números. */
function leerGuardadas() {
  return leerTodo().items
    .filter(esGuardadaValida)
    .map((g) => (typeof g.actualizadoEn === 'number' ? g : Object.assign({}, g, { actualizadoEn: Math.max(g.guardadaEn || 0, g.usadaEn || 0) })))
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

/* Qué dice la fila: «Usada …» si se cargó alguna vez, «Guardada …» si nunca. Al guardar (y en la nube)
   usadaEn arranca igual a guardadaEn, así que «se cargó» es que usadaEn sea posterior. → { palabra, cuando } */
function usoDeGuardada(g) {
  const guardadaEn = g.guardadaEn || 0;
  if (typeof g.usadaEn === 'number' && g.usadaEn > guardadaEn) return { palabra: 'Usada', cuando: g.usadaEn };
  return { palabra: 'Guardada', cuando: guardadaEn || g.usadaEn || 0 };
}

/* ¿Ya hay una guardada con ese nombre? (sin importar mayúsculas ni espacios de los lados) */
function existeGuardada(nombre) {
  return leerGuardadas().some((g) => mismoNombre(g.nombre, nombre));
}

/* ---------- Cola de cambios pendientes de subir a la nube ----------
   Pendiente = { op: 'guardar'|'borrar'|'usar', id, cuando (ms), rechazado? }. Las reglas de la cola
   (qué reemplaza a qué) viven en GUARDADAS.anotar; aquí solo se lee y se escribe. */
const CLAVE_PENDIENTES = claveDe('guardadas_pendientes_v1');
const OPS_PENDIENTES = ['guardar', 'borrar', 'usar'];
const esPendienteValido = (p) => !!p && typeof p === 'object' && OPS_PENDIENTES.includes(p.op) && typeof p.id === 'string' && typeof p.cuando === 'number';

/* La cola guardada; si no se puede leer o no es una lista devuelve [], y se ignoran las entradas rotas. */
function leerPendientes() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) || '[]');
    return Array.isArray(lista) ? lista.filter(esPendienteValido) : [];
  } catch (e) { return []; }
}

/* true si quedó escrita. */
function escribirPendientes(pendientes) {
  try { localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(pendientes)); return true; } catch (e) { return false; }
}

/* Escribe la lista que llega de la fusión con la nube (conserva las entradas rotas, como escribirGuardadas). */
function reemplazarGuardadas(lista) {
  return escribirGuardadas(lista);
}

/* Escribe la lista nueva y anota el pendiente. Si la cola no se puede escribir, devuelve la lista a como
   estaba: un cambio que no se puede subir no se queda a medias. true si quedó todo. */
function escribirYAnotar(previa, nueva, pendiente) {
  if (!escribirGuardadas(nueva)) return false;
  if (escribirPendientes(GUARDADAS.anotar(leerPendientes(), pendiente))) return true;
  escribirGuardadas(previa);
  return false;
}

/* Guarda el estado `s` con ese nombre. Si ya hay una con el mismo nombre (sin importar mayúsculas
   ni espacios de los lados), la reemplaza. Un nombre vacío no se guarda: devuelve null.
   Si ya hay GUARDADAS.LIMITE y el nombre es nuevo, devuelve { error: 'limite' } y no escribe nada.
   Anota un pendiente «guardar». */
function guardarTransmision(nombre, s) {
  nombre = String(nombre || '').trim();
  if (!nombre) return null;
  const datos = copiaProfunda(s);
  CAMPOS_DE_AIRE.forEach((c) => { delete datos[c]; });
  const lista = leerGuardadas();
  const previa = lista.find((g) => mismoNombre(g.nombre, nombre));
  if (!previa && lista.length >= GUARDADAS.LIMITE) return { error: 'limite' };
  const ahora = Date.now();
  const tipo = (typeof ordenTipos === 'function' ? ordenTipos() : ['dominical']).includes(datos.tipo) ? datos.tipo : 'dominical';
  const guardada = { id: previa ? previa.id : GUARDADAS.idNuevo(ahora, Math.random), nombre, tipo, guardadaEn: ahora, usadaEn: ahora, actualizadoEn: ahora, datos };
  const nueva = previa ? lista.map((g) => (g === previa ? guardada : g)) : lista.concat(guardada);
  return escribirYAnotar(lista, nueva, { op: 'guardar', id: guardada.id, cuando: ahora }) ? guardada : null;
}

/* El estado de una guardada, listo para el panel: completo (los estados viejos se migran),
   con el tipo en TIPOS y sin rótulo al aire. Marca la guardada como usada ahora (usadaEn, sin tocar
   actualizadoEn) y anota un pendiente «usar». Si el id no existe devuelve null.
   (`actual` no se usa: se carga la transmisión entera.) */
function cargarTransmision(id, actual) {
  const lista = leerGuardadas();
  const guardada = lista.find((g) => g.id === id);
  if (!guardada) return null;
  const estado = copiaProfunda(normalizarEstado(guardada.datos));
  estado.rotulo = 'ninguno';
  estado.rotuloHasta = 0;
  guardada.usadaEn = Date.now();
  if (escribirGuardadas(lista)) escribirPendientes(GUARDADAS.anotar(leerPendientes(), { op: 'usar', id, cuando: guardada.usadaEn }));
  return estado;
}

/* Copia con el nombre «{nombre} (copia)». Si ese nombre ya existe, queda «(copia 2)», «(copia 3)»…
   Con GUARDADAS.LIMITE guardadas devuelve { error: 'limite' }. Anota un pendiente «guardar». */
function duplicarTransmision(id) {
  const lista = leerGuardadas();
  const origen = lista.find((g) => g.id === id);
  if (!origen) return null;
  if (lista.length >= GUARDADAS.LIMITE) return { error: 'limite' };
  const nombre = GUARDADAS.nombreLibre(origen.nombre, lista.map((g) => g.nombre));
  const ahora = Date.now();
  const copia = { id: GUARDADAS.idNuevo(ahora, Math.random), nombre, tipo: origen.tipo, guardadaEn: ahora, usadaEn: ahora, actualizadoEn: ahora, datos: copiaProfunda(origen.datos) };
  return escribirYAnotar(lista, lista.concat(copia), { op: 'guardar', id: copia.id, cuando: ahora }) ? copia : null;
}

/* true si quedó borrada; false si el navegador no dejó escribir. Es un borrado blando en local: la entrada
   sale de la lista y se anota un pendiente «borrar» (la nube conserva la baja). */
function borrarTransmision(id) {
  const lista = leerGuardadas();
  const nueva = lista.filter((g) => g.id !== id);
  if (nueva.length === lista.length) return escribirGuardadas(nueva);
  return escribirYAnotar(lista, nueva, { op: 'borrar', id, cuando: Date.now() });
}
