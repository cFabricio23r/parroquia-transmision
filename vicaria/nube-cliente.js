/* Cliente de la nube (Supabase) para el panel de la PC: entrar, renovar la sesión y leer/escribir las
   transmisiones guardadas con `fetch` (Auth y PostgREST). Sin librerías. Espejo en JS plano de
   app/src/supabase/cliente.ts.

   Necesita cargados antes: parroquia.js (claveDe) y nube.js (NUBE = { url, clavePublica }).
   - La llave `sb_publishable_…` va SOLO en el encabezado `apikey`; el Bearer es el token de acceso.
   - Nada de este archivo escribe en la consola ni deja un token o una contraseña en un resultado.
   - La sesión vive en claveDe('sesion_nube_v1') = { access, refresh, vence } (vence en ms desde epoch).

   Toda función devuelve una promesa de { ok:true, valor } o
   { ok:false, error:{ tipo:'sin-conexion'|'credenciales'|'permiso'|'sesion'|'servidor', estado?, codigo? } }.
   `fetch` es inyectable para las pruebas (usarFetchNube); por defecto es el del navegador. */

const CLAVE_SESION_NUBE = claveDe('sesion_nube_v1');
const PLAZO_NUBE_MS = 10000;      // plazo de cada pedido
const MARGEN_RENOVAR_MS = 60000;  // se renueva si faltan menos de 60 s

let _nubeFetch = null;            // el inyectado (pruebas); null = el del navegador
let _nubeRenovando = null;        // promesa compartida: nunca corren dos renovaciones a la vez

function usarFetchNube(f) { _nubeFetch = typeof f === 'function' ? f : null; }

function _nubeFalla(tipo, extra) {
  return { ok: false, error: Object.assign({ tipo }, extra || {}) };
}

function _nubeBase() { return String(NUBE.url).replace(/\/+$/, ''); }

function _nubeJson(texto) {
  try { return JSON.parse(texto); } catch (e) { return undefined; }
}

function _nubeEsObjeto(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/* Pide con plazo. Devuelve { estado, texto } o null si no hubo respuesta (red caída o plazo vencido).
   Nunca rechaza y nunca deja ver el error original (puede traer la URL). */
async function _nubePedir(url, init) {
  const f = _nubeFetch || (typeof fetch === 'function' ? fetch : window.fetch.bind(window));
  const control = typeof AbortController === 'function' ? new AbortController() : null;
  let temporizador;
  const plazo = new Promise((resolver) => {
    temporizador = setTimeout(() => {
      try { if (control) control.abort(); } catch (e) {}
      resolver(null);
    }, PLAZO_NUBE_MS);
  });
  const pedido = (async () => {
    try {
      const r = await f(url, control ? Object.assign({}, init, { signal: control.signal }) : init);
      const texto = await r.text();
      return { estado: r.status, texto };
    } catch (e) {
      return null;
    }
  })();
  try {
    return await Promise.race([pedido, plazo]);
  } finally {
    clearTimeout(temporizador);
  }
}

/* ---------- Sesión guardada ---------- */

function leerSesionNube() {
  let crudo = null;
  try { crudo = localStorage.getItem(CLAVE_SESION_NUBE); } catch (e) { return null; }
  if (!crudo) return null;
  const s = _nubeJson(crudo);
  if (!_nubeEsObjeto(s) || typeof s.access !== 'string' || typeof s.refresh !== 'string' || typeof s.vence !== 'number') return null;
  return { access: s.access, refresh: s.refresh, vence: s.vence };
}

function _guardarSesionNube(s) {
  try { localStorage.setItem(CLAVE_SESION_NUBE, JSON.stringify({ access: s.access, refresh: s.refresh, vence: s.vence })); } catch (e) {}
}

function salirNube() {
  try { localStorage.removeItem(CLAVE_SESION_NUBE); } catch (e) {}
}

/* De la respuesta de /auth/v1/token a { access, refresh, vence, correo }, o null si no trae lo esperado. */
function _nubeSesionDeToken(cuerpo) {
  if (!_nubeEsObjeto(cuerpo)) return null;
  const { access_token: access, refresh_token: refresh, expires_in: dura, expires_at: expiraS, user } = cuerpo;
  if (typeof access !== 'string' || access === '' || typeof refresh !== 'string' || refresh === '') return null;
  let vence;
  if (typeof expiraS === 'number' && isFinite(expiraS)) vence = Math.floor(expiraS) * 1000;
  else if (typeof dura === 'number' && isFinite(dura)) vence = Date.now() + Math.floor(dura) * 1000;
  else return null;
  return { access, refresh, vence, correo: _nubeEsObjeto(user) && typeof user.email === 'string' ? user.email : '' };
}

function _nubeToken(tipo, cuerpo) {
  return _nubePedir(_nubeBase() + '/auth/v1/token?grant_type=' + tipo, {
    method: 'POST',
    headers: { apikey: NUBE.clavePublica, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
}

/* Guarda la sesión y devuelve { ok:true, valor:{ correo, vence } } (los tokens no salen de aquí). */
function _nubeGuardarDeRespuesta(r) {
  const s = _nubeSesionDeToken(_nubeJson(r.texto));
  if (!s) return _nubeFalla('servidor', { estado: r.estado });
  _guardarSesionNube(s);
  return { ok: true, valor: { correo: s.correo, vence: s.vence } };
}

async function entrarNube(correo, clave) {
  const r = await _nubeToken('password', { email: String(correo).trim().toLowerCase(), password: clave });
  if (r === null || r.estado >= 500) return _nubeFalla('sin-conexion');
  if (r.estado === 400 || r.estado === 401 || r.estado === 422) return _nubeFalla('credenciales');
  if (r.estado < 200 || r.estado >= 300) return _nubeFalla('servidor', { estado: r.estado });
  return _nubeGuardarDeRespuesta(r);
}

/* Rota el refresh. Si ya hay una renovación en curso, devuelve esa misma promesa. Si el servidor rechaza
   el refresh (400/401) la sesión ya no sirve: se borra y el error es 'sesion'. */
function renovarNube() {
  if (_nubeRenovando) return _nubeRenovando;
  const actual = leerSesionNube();
  if (!actual) return Promise.resolve(_nubeFalla('sesion'));
  _nubeRenovando = (async () => {
    try {
      const r = await _nubeToken('refresh_token', { refresh_token: actual.refresh });
      if (r === null || r.estado >= 500) return _nubeFalla('sin-conexion');
      if (r.estado === 400 || r.estado === 401) { salirNube(); return _nubeFalla('sesion'); }
      if (r.estado < 200 || r.estado >= 300) return _nubeFalla('servidor', { estado: r.estado });
      return _nubeGuardarDeRespuesta(r);
    } finally {
      _nubeRenovando = null;
    }
  })();
  return _nubeRenovando;
}

/* Corre fn(access) con una sesión vigente: renueva antes si faltan menos de 60 s. fn devuelve un resultado
   { ok, ... }. Sin sesión (o con la renovación rechazada) da { tipo:'sesion' }.
   - Si renovar falla por la red pero el access todavía no venció, se usa ese access.
   - Si fn recibe un 401 de PostgREST (el reloj del aparato puede estar corrido), renueva una vez y
     reintenta fn una vez. */
async function conSesion(fn) {
  let s = leerSesionNube();
  if (!s) return _nubeFalla('sesion');
  if (s.vence - Date.now() < MARGEN_RENOVAR_MS) {
    const r = await renovarNube();
    if (!r.ok && !(r.error.tipo === 'sin-conexion' && s.vence > Date.now())) return r;
    s = leerSesionNube();
    if (!s) return _nubeFalla('sesion');
  }
  const primero = await fn(s.access);
  if (primero.ok || !primero.error || primero.error.tipo !== 'sesion' || primero.error.estado !== 401) return primero;
  const r = await renovarNube();
  if (!r.ok) return r;
  s = leerSesionNube();
  if (!s) return _nubeFalla('sesion');
  return fn(s.access);
}

/* ---------- PostgREST ---------- */

/* Error de un pedido a PostgREST, o null si salió bien. Un 4xx con cuerpo { code } (23505, P0001…) lleva
   ese `codigo`, para que la capa de sincronización decida (nombre repetido, tope de guardadas). */
function _nubeErrorRest(r) {
  if (r === null || r.estado >= 500) return _nubeFalla('sin-conexion');
  if (r.estado === 401) return _nubeFalla('sesion', { estado: 401 });   // estado 401: conSesion renueva y reintenta
  if (r.estado === 403) return _nubeFalla('permiso');
  if (r.estado >= 200 && r.estado < 300) return null;
  const cuerpo = _nubeJson(r.texto);
  const extra = { estado: r.estado };
  if (_nubeEsObjeto(cuerpo) && typeof cuerpo.code === 'string') extra.codigo = cuerpo.code;
  return _nubeFalla('servidor', extra);
}

function _nubeRest(access, ruta, init) {
  const cabeceras = Object.assign({ apikey: NUBE.clavePublica, Authorization: 'Bearer ' + access }, init.headers || {});
  return _nubePedir(_nubeBase() + '/rest/v1/' + ruta, Object.assign({}, init, { headers: cabeceras }));
}

async function _nubeLeerLista(access, ruta) {
  const r = await _nubeRest(access, ruta, { method: 'GET' });
  const e = _nubeErrorRest(r);
  if (e) return e;
  const filas = _nubeJson(r.texto);
  return Array.isArray(filas) ? { ok: true, valor: filas } : _nubeFalla('servidor', { estado: r.estado });
}

/* Id de la parroquia con ese slug. Si la cuenta no ve ninguna fila (no es de esta parroquia), 'permiso'. */
function parroquiaIdNube(slug) {
  return conSesion(async (access) => {
    const r = await _nubeLeerLista(access, 'parroquias?select=id&slug=eq.' + encodeURIComponent(slug));
    if (!r.ok) return r;
    const fila = r.valor[0];
    if (!fila || typeof fila.id !== 'string') return _nubeFalla('permiso');
    return { ok: true, valor: fila.id };
  });
}

/* Las guardadas activas de la parroquia y las borradas (borrada_en) de los últimos 30 días: las bajas más
   viejas ya no hacen falta para que un aparato sin conexión no resucite una guardada. */
const DIAS_BAJAS_NUBE = 30;
function listarGuardadasNube(parroquiaId) {
  const desde = new Date(Date.now() - DIAS_BAJAS_NUBE * 86400000).toISOString();
  const filtro = '&or=' + encodeURIComponent('(borrada_en.is.null,borrada_en.gte.' + desde + ')');
  return conSesion((access) => _nubeLeerLista(access, 'guardadas?select=*&parroquia_id=eq.' + encodeURIComponent(parroquiaId) + filtro));
}

/* Sube una fila (upsert por parroquia_id,id). Un nombre repetido vuelve como { tipo:'servidor', codigo:'23505' }. */
function subirGuardadaNube(fila) {
  return conSesion(async (access) => {
    const r = await _nubeRest(access, 'guardadas?on_conflict=parroquia_id,id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([fila])
    });
    return _nubeErrorRest(r) || { ok: true, valor: true };
  });
}

/* Anota que se usó una guardada (rpc usar_guardada). `cuando`: epoch en ms o texto ISO. */
function usarGuardadaNube(parroquiaId, id, cuando) {
  const iso = typeof cuando === 'number' ? new Date(cuando).toISOString() : cuando;
  return conSesion(async (access) => {
    const r = await _nubeRest(access, 'rpc/usar_guardada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_parroquia: parroquiaId, p_id: id, p_cuando: iso })
    });
    return _nubeErrorRest(r) || { ok: true, valor: true };
  });
}
