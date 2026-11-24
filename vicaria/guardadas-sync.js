/* Sincronización de las transmisiones guardadas («misas listas») del panel de la PC con la nube.
   Se carga en panel.html después de parroquia.js, comun.js, guardadas-nucleo.js, guardadas.js, nube.js y
   nube-cliente.js. No pinta nada: el panel le dice qué hacer cuando cambian el estado o la lista.

   - La copia local manda: el panel siempre pinta lo que hay en localStorage y la nube solo la actualiza.
   - Nunca bloquea la interfaz: todo va en segundo plano y la lista se repinta solo si cambió.
   - En la app (.modo-app) no hace nada: la app sincroniza de forma nativa y el panel nunca ve tokens.
   - Dos paneles abiertos en la misma PC no suben dos veces lo mismo: hay un candado en localStorage que
     vence a los 30 s.

   sincronizarGuardadas() devuelve:
   - 'ok';
   - 'sin-sesion': nunca se entró en este panel (o se apretó Salir);
   - 'sesion-cerrada': había sesión y el servidor la rechazó o venció, o PostgREST dijo 403 (la cuenta ya no
     puede con esta parroquia): se recuerda hasta entrar o salir. La cola se conserva entera;
   - 'sin-conexion': no hubo respuesta (sin red);
   - 'error-servidor': hubo respuesta pero falló (5xx, 408, 425, 429, error de Auth al renovar…). Igual que sin
     conexión, corta y conserva la cola: nada pasa a rechazado por esto;
   - 'ocupado': otro panel de esta PC está sincronizando. */

const CLAVE_CANDADO_SYNC = claveDe('guardadas_candado');
const CLAVE_MIGRADAS = claveDe('guardadas_migradas_v1');
const CLAVE_ULTIMA_FIRMA = claveDe('guardadas_ultima_firma');
const CLAVE_SESION_CERRADA = claveDe('guardadas_sesion_cerrada');   // el servidor cerró la sesión: se dice hasta entrar o salir
const VENCE_CANDADO_MS = 30000;
const ESPERA_CANDADO_MS = 150;       // escribe, espera y relee: si otro panel escribió después, gana ese
const DEMORA_TRAS_CAMBIO_MS = 1500;
const CADA_SYNC_MS = 120000;
const REINTENTO_OCUPADO_MS = 5000;

const TEXTO_SYNC = {
  ok: 'Sincronizado',
  'sin-conexion': 'Sin conexión. Ves las misas guardadas en esta computadora.',
  'error-servidor': 'No se pudo sincronizar. Se vuelve a intentar solo.',
  guardando: 'Guardando…',
  'sin-sesion': 'Entrá para ver también las del celular',
  'sesion-cerrada': 'Se cerró tu sesión. Entrá de nuevo para ver las del celular.'
};

const _syncYo = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
let _syncParroquiaId = null;   // de la sesión actual; se olvida al salir
let _syncEnCurso = null;
let _syncOtraVez = false;
let _syncTimer = null;
let _syncOpciones = { alEstado() {}, alCambiarLista() {}, enVivo: () => false };

function _syncModoApp() {
  try { return !!(document.documentElement && document.documentElement.classList.contains('modo-app')); } catch (e) { return false; }
}

function _syncLeer(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch (e) { return null; }
}
function _syncEscribir(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch (e) { return false; }
}

/* ---------- Misas que la nube rechazó ----------
   Se cuentan los «guardar» rechazados cuya guardada sigue en la copia local: esas son las misas que no están en
   la nube. Un «usar» o un «borrar» rechazado no deja una misa sin guardar. Lo usa el panel también en la app
   (allá la cola la marca lo nativo), así que no depende de la sesión. */
const TEXTO_FILA_RECHAZADA = 'No se guardó en la nube';
function textoRechazadas(n) {
  return n === 1 ? '1 misa no se pudo guardar en la nube. Sigue en esta computadora.'
    : n + ' misas no se pudieron guardar en la nube. Siguen en esta computadora.';
}
function idsRechazadasGuardadas() {
  const ids = new Set(leerGuardadas().map((g) => g.id));
  return new Set(leerPendientes().filter((p) => p.rechazado && p.op === 'guardar' && ids.has(p.id)).map((p) => p.id));
}

/* «Se guardaron N misas de esta computadora en la nube» (con una sola, en singular). */
function textoMigracion(n) {
  return n === 1 ? 'Se guardó 1 misa de esta computadora en la nube' : 'Se guardaron ' + n + ' misas de esta computadora en la nube';
}

/* Sin sesión: ¿la cerró el servidor (y hay que decirlo) o nunca se entró? */
function _syncSinSesion() {
  return _syncLeer(CLAVE_SESION_CERRADA) ? 'sesion-cerrada' : 'sin-sesion';
}
function _syncOlvidarCierre() {
  try { localStorage.removeItem(CLAVE_SESION_CERRADA); } catch (e) {}
}

/* ---------- ¿Hay cambios que no están en ninguna misa lista? ---------- */

function _syncOrdenado(v) {
  if (Array.isArray(v)) return v.map(_syncOrdenado);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach((k) => { if (v[k] !== undefined) o[k] = _syncOrdenado(v[k]); });
    return o;
  }
  return v;
}

/* Firma de un estado sin el rótulo al aire, que no depende del orden de las claves. */
function firmaEstado(e) {
  const copia = Object.assign({}, e || {});
  GUARDADAS.CAMPOS_DE_AIRE.forEach((c) => { delete copia[c]; });
  return JSON.stringify(_syncOrdenado(copia));
}

/* Se llama al guardar o al cargar una misa lista: ese es el estado «sin cambios». */
function anotarFirmaGuardada(s) {
  try { localStorage.setItem(CLAVE_ULTIMA_FIRMA, firmaEstado(s)); } catch (e) {}
}

/* true si `s` no es lo último que se guardó o cargó, ni igual a alguna misa lista. */
function hayCambiosSinGuardar(s) {
  const firma = firmaEstado(s);
  let ultima = null;
  try { ultima = localStorage.getItem(CLAVE_ULTIMA_FIRMA); } catch (e) {}
  if (ultima === firma) return false;
  return !leerGuardadas().some((g) => {
    try { return firmaEstado(normalizarEstado(JSON.parse(JSON.stringify(g.datos)))) === firma; } catch (e) { return false; }
  });
}

/* ---------- Candado entre paneles ---------- */

async function _syncTomarCandado() {
  const c = _syncLeer(CLAVE_CANDADO_SYNC);
  if (c && c.dueno !== _syncYo && typeof c.vence === 'number' && c.vence > Date.now()) return false;
  if (!_syncEscribir(CLAVE_CANDADO_SYNC, { dueno: _syncYo, vence: Date.now() + VENCE_CANDADO_MS })) return false;
  await new Promise((r) => setTimeout(r, ESPERA_CANDADO_MS));
  const d = _syncLeer(CLAVE_CANDADO_SYNC);
  return !!d && d.dueno === _syncYo;
}
function _syncSoltarCandado() {
  const c = _syncLeer(CLAVE_CANDADO_SYNC);
  if (c && c.dueno === _syncYo) { try { localStorage.removeItem(CLAVE_CANDADO_SYNC); } catch (e) {} }
}

/* ---------- Cola de pendientes ---------- */

const _syncIgual = (a, b) => a.op === b.op && a.id === b.id;

/* Saca de la cola lo ya hecho: el mismo op e id, hasta ese momento (un cambio posterior se queda). */
function _syncQuitar(p) {
  escribirPendientes(leerPendientes().filter((x) => !(_syncIgual(x, p) && x.cuando <= p.cuando)));
}
/* Lo marca rechazado: nunca se reintenta y la guardada sigue a la vista. Los «usar» anteriores se van. */
function _syncRechazar(p) {
  escribirPendientes(leerPendientes()
    .filter((x) => !(_syncIgual(x, p) && x.cuando < p.cuando))
    .map((x) => (_syncIgual(x, p) && x.cuando === p.cuando ? Object.assign({}, x, { rechazado: true }) : x)));
}

/* Ante un error de la nube: cortar o, si es la respuesta de PostgREST a esta guardada (un 4xx), null = rechazar.
   Se corta (y la cola se conserva) sin red, sin sesión, con un 5xx, si falló Auth al renovar (origen 'auth':
   no habla de esta guardada) o con un 408, 425 o 429 (plazo, «muy temprano» o límite de pedidos: pasajeros).
   Sin respuesta es 'sin-conexion'; con respuesta (5xx, 408, 425, 429, Auth) es 'error-servidor'.
   Un 403 de PostgREST ('permiso') es de la cuenta, no de esta guardada: corta como sesión cerrada. */
const _SYNC_PASAJEROS = [408, 425, 429];
function _syncCorte(r) {
  const e = r.error;
  if (e.tipo === 'sin-conexion') return e.estado === undefined ? 'sin-conexion' : 'error-servidor';
  if (e.tipo === 'sesion' || e.tipo === 'permiso') return 'sin-sesion';   // _syncCorrer cierra la sesión
  if (e.origen === 'auth' || _SYNC_PASAJEROS.includes(e.estado)) return 'error-servidor';
  return null;
}

/* Termina un pendiente según la respuesta: null si se sigue con el próximo, o el corte. */
function _syncTerminar(p, r) {
  if (r.ok) { _syncQuitar(p); return null; }
  const corte = _syncCorte(r);
  if (corte) return corte;
  _syncRechazar(p);
  return null;
}

async function _syncSubirGuardar(pid, p, ctx) {
  const g = leerGuardadas().find((x) => x.id === p.id);
  // Ya no está en la copia local (se perdió o la escribió otro dock a destiempo): no hay nada que subir ahora,
  // pero tampoco se descarta ni se rechaza (la nube no dijo nada): queda en la cola por si la guardada vuelve.
  if (!g) return null;
  let fila = GUARDADAS.aFila(g, 'panel', pid);
  let r = await subirGuardadaNube(fila);
  if (!r.ok && r.error.codigo === '23505') {
    // Otro aparato ya tiene una guardada con ese nombre: esta pasa a «(copia)» y se reintenta una vez.
    const nube = await ctx.nube();
    if (!nube.ok) return _syncCorte(nube) || 'error-servidor';
    const ocupados = nube.valor.filter((f) => !f.borrada_en && f.id !== g.id).map((f) => f.nombre)
      .concat(leerGuardadas().filter((x) => x.id !== g.id).map((x) => x.nombre));
    const nombre = GUARDADAS.nombreLibre(g.nombre, ocupados);
    reemplazarGuardadas(leerGuardadas().map((x) => (x.id === g.id ? Object.assign({}, x, { nombre }) : x)));
    fila = Object.assign({}, fila, { nombre });
    r = await subirGuardadaNube(fila);
  }
  return _syncTerminar(p, r);
}

/* La baja necesita la fila completa (nombre, tipo, datos): sale de la nube, porque la copia local ya no la tiene. */
async function _syncSubirBorrar(pid, p, ctx) {
  const nube = await ctx.nube();
  if (!nube.ok) return _syncCorte(nube) || 'error-servidor';
  const f = nube.valor.find((x) => x.id === p.id);
  if (!f || f.borrada_en) { _syncQuitar(p); return null; }   // nunca subió, o ya está borrada
  const cuando = new Date(p.cuando).toISOString();
  const baja = Object.assign({}, f, { parroquia_id: pid, borrada_en: cuando, actualizado_en: cuando, actualizado_desde: 'panel' });
  delete baja.actualizado_por;   // lo pone el servidor
  return _syncTerminar(p, await subirGuardadaNube(baja));
}

/* Guardar y borrar primero, en orden; después un solo «usar» por guardada (el último). */
async function _syncSubirPendientes(pid, ctx) {
  const cola = leerPendientes().filter((p) => !p.rechazado);
  for (const p of cola.filter((x) => x.op !== 'usar')) {
    const corte = p.op === 'guardar' ? await _syncSubirGuardar(pid, p, ctx) : await _syncSubirBorrar(pid, p, ctx);
    if (corte) return corte;
  }
  const ultimos = new Map();
  cola.filter((x) => x.op === 'usar').forEach((p) => { if (!ultimos.has(p.id) || ultimos.get(p.id).cuando < p.cuando) ultimos.set(p.id, p); });
  for (const p of ultimos.values()) {
    if (leerPendientes().some((x) => x.op === 'borrar' && x.id === p.id)) { _syncQuitar(p); continue; }   // se borró: usarla no importa
    const corte = _syncTerminar(p, await usarGuardadaNube(pid, p.id, p.cuando));
    if (corte) return corte;
  }
  return null;
}

const _syncPorId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const _syncFirmaLista = (lista) => JSON.stringify(_syncOrdenado(lista.slice().sort(_syncPorId)));

/* ---------- Una sincronización ---------- */

async function _syncCorrer() {
  if (!SLUG || (typeof PARROQUIA_NO_EXISTE !== 'undefined' && PARROQUIA_NO_EXISTE)) return 'sin-sesion';
  if (!leerSesionNube()) return _syncSinSesion();
  const r = await _syncCorrerConSesion();
  if (r !== 'sin-sesion') return r;
  // Empezó con sesión y el servidor la rechazó, venció o dio 403: se recuerda para decirlo y se borra.
  // Si la borra este panel (401 aun renovada, 403), la marca va ANTES: los otros docks la leen ya en el evento
  // storage de la sesión. Si la borró renovarNube (refresh rechazado), la sesión ya no estaba al escribir la
  // marca: los otros docks se enteran por el evento storage de la marca (ver iniciarSincronizacionGuardadas).
  _syncEscribir(CLAVE_SESION_CERRADA, { cuando: Date.now() });
  salirNube();
  return 'sesion-cerrada';
}

async function _syncCorrerConSesion() {
  if (!(await _syncTomarCandado())) return 'ocupado';
  try {
    if (!_syncParroquiaId) {
      const r = await parroquiaIdNube(SLUG);
      // 'permiso' (la cuenta ya no es de esta parroquia) corta como sin-sesion: _syncCorrer cierra la sesión.
      if (!r.ok) return _syncCorte(r) || 'error-servidor';
      _syncParroquiaId = r.valor;
    }
    const pid = _syncParroquiaId;

    // Primera vez con sesión en esta computadora: suben todas las guardadas locales válidas.
    let migrados = null;
    if (_syncLeer(CLAVE_MIGRADAS) === null) {
      let cola = leerPendientes();
      const ahora = Date.now();
      migrados = leerGuardadas().map((g) => g.id);
      migrados.forEach((id) => { cola = GUARDADAS.anotar(cola, { op: 'guardar', id, cuando: ahora }); });
      escribirPendientes(cola);
    }

    if (leerPendientes().some((p) => !p.rechazado)) _syncAvisar('guardando');
    let nubeAntes = null;
    const ctx = { nube: async () => (nubeAntes = nubeAntes || await listarGuardadasNube(pid)) };
    const corte = await _syncSubirPendientes(pid, ctx);
    if (corte) return corte;

    let subidas = 0;
    if (migrados) {
      const quedan = leerPendientes();
      subidas = migrados.filter((id) => !quedan.some((p) => p.op === 'guardar' && p.id === id)).length;
      _syncEscribir(CLAVE_MIGRADAS, { cuando: Date.now(), cantidad: subidas });
    }

    const r = await listarGuardadasNube(pid);
    if (!r.ok) return _syncCorte(r) || 'error-servidor';
    // Sin esperas entre leer y escribir: lo que se guardó en este panel durante la subida entra en la fusión.
    const local = leerGuardadas();
    const lista = GUARDADAS.fusionar(local, r.valor, leerPendientes());
    if (_syncFirmaLista(lista) !== _syncFirmaLista(local)) {
      reemplazarGuardadas(lista);
      try { _syncOpciones.alCambiarLista(); } catch (e) {}
    }
    _syncAvisar('ok', subidas ? textoMigracion(subidas) : undefined);
    return 'ok';
  } finally {
    _syncSoltarCandado();
  }
}

function _syncAvisar(estado, texto) {
  try { _syncOpciones.alEstado(estado, texto || TEXTO_SYNC[estado] || ''); } catch (e) {}
}

/* Corre una sincronización. Si ya hay una en curso en este panel, devuelve esa misma y, al terminar, corre
   otra (así sube también lo que cambió mientras tanto). */
function sincronizarGuardadas() {
  if (_syncModoApp()) return Promise.resolve('sin-sesion');
  if (_syncEnCurso) { _syncOtraVez = true; return _syncEnCurso; }
  const enCurso = (async () => {
    let r;
    try { r = await _syncCorrer(); } catch (e) { r = 'sin-conexion'; }
    if (r === 'sin-sesion' || r === 'sesion-cerrada') { _syncParroquiaId = null; _syncAvisar(r); }
    else if (r === 'sin-conexion' || r === 'error-servidor') _syncAvisar(r);
    else if (r === 'ocupado') programarSincronizacionGuardadas(REINTENTO_OCUPADO_MS);   // otro panel está subiendo
    return r;
  })();
  _syncEnCurso = enCurso;
  enCurso.then(() => {
    _syncEnCurso = null;
    if (_syncOtraVez) { _syncOtraVez = false; programarSincronizacionGuardadas(0); }
  });
  return enCurso;
}

/* Sincroniza dentro de `ms` (por defecto 1,5 s, después de un cambio). Varios pedidos seguidos hacen uno solo. */
function programarSincronizacionGuardadas(ms) {
  if (_syncModoApp()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { sincronizarGuardadas(); }, ms === undefined ? DEMORA_TRAS_CAMBIO_MS : ms);
}

/* ---------- Entrar y salir ---------- */

const SIN_INTERNET_ENTRAR = 'No hay internet. Probá de nuevo.';
const NO_SE_PUDO_ENTRAR = 'No se pudo entrar. Probá de nuevo en un rato.';

/* El texto de un error al entrar. Sin respuesta (sin `estado`) es falta de red; con respuesta (5xx, 429, otro
   error de Auth) la red anda y falló el servidor. */
function _syncTextoAlEntrar(e) {
  if (e.tipo === 'credenciales') return 'Correo o contraseña incorrectos';
  if (e.tipo === 'permiso') return 'Esta cuenta no es de esta parroquia';
  if (e.tipo === 'sin-conexion' && e.estado === undefined) return SIN_INTERNET_ENTRAR;
  return NO_SE_PUDO_ENTRAR;
}

/* Entra con la cuenta del editor web. Devuelve { ok:true } o { ok:false, texto } con el error para el voluntario.
   `sigue()` (opcional) dice si el voluntario todavía espera (no cerró el diálogo): si ya no, la sesión que llegó
   se borra y devuelve { ok:false, cancelado:true }, sin sincronizar. */
async function entrarGuardadas(correo, clave, sigue) {
  if (_syncModoApp()) return { ok: false, texto: '' };
  const vigente = typeof sigue === 'function' ? sigue : () => true;
  const cancelado = () => { salirNube(); return { ok: false, texto: '', cancelado: true }; };
  const r = await entrarNube(correo, clave);
  if (!r.ok) return { ok: false, texto: _syncTextoAlEntrar(r.error) };
  if (!vigente()) return cancelado();
  const p = await parroquiaIdNube(SLUG);
  if (!vigente()) return cancelado();
  if (!p.ok) {
    salirNube();
    return { ok: false, texto: _syncTextoAlEntrar(p.error) };
  }
  _syncOlvidarCierre();
  _syncParroquiaId = p.valor;
  // Lo rechazado antes (por ejemplo por un 403 de una cuenta sin permiso) se vuelve a intentar una vez.
  const cola = leerPendientes();
  if (cola.some((x) => x.rechazado)) {
    escribirPendientes(cola.map((x) => { if (!x.rechazado) return x; const y = Object.assign({}, x); delete y.rechazado; return y; }));
  }
  sincronizarGuardadas();
  return { ok: true };
}

/* Borra la sesión. Las guardadas locales y los pendientes se quedan. */
function salirGuardadas() {
  salirNube();
  _syncOlvidarCierre();
  _syncParroquiaId = null;
  _syncAvisar('sin-sesion');
}

function haySesionGuardadas() { return !_syncModoApp() && !!leerSesionNube(); }

/* El panel lo llama una vez al cargar. opciones: { alEstado(estado, texto), alCambiarLista(), enVivo() }.
   Con sesión sincroniza ya; después, cada 120 s (salvo con En vivo abierta) y al volver la conexión. */
function iniciarSincronizacionGuardadas(opciones) {
  _syncOpciones = Object.assign({}, _syncOpciones, opciones || {});
  if (_syncModoApp()) return;
  if (haySesionGuardadas()) sincronizarGuardadas(); else _syncAvisar(_syncSinSesion());
  setInterval(() => { if (!_syncOpciones.enVivo() && haySesionGuardadas()) sincronizarGuardadas(); }, CADA_SYNC_MS);
  window.addEventListener('online', () => { if (haySesionGuardadas()) sincronizarGuardadas(); });
  window.addEventListener('storage', (e) => {
    // Otro dock cerró la sesión: al renovar, nube-cliente la borra antes de que llegue la marca, así que
    // también se escucha la marca.
    if (e.key === CLAVE_SESION_CERRADA) { if (!haySesionGuardadas()) _syncAvisar(_syncSinSesion()); return; }
    if (e.key !== CLAVE_SESION_NUBE) return;   // se entró o se salió en otro panel de esta PC
    _syncParroquiaId = null;
    if (haySesionGuardadas()) sincronizarGuardadas(); else _syncAvisar(_syncSinSesion());
  });
}
