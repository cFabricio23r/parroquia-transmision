/*
  Pruebas en el navegador de vicaria/ (Playwright), contra herramientas/servidor-vicaria.js,
  que aplica vicaria/vercel.json. Guarda capturas en pruebas/capturas/vicaria/.

  Uso:  npm run prueba:vicaria:navegador

  Notas:
  - «Sin red» se simula de dos formas: con route() que aborta config.json (la página sí carga) y con
    context.setOffline(true) más una llamada a cargarParroquia() en una página ya abierta. Recargar
    la página entera sin red no sirve: el servidor local no tiene caché y la página misma no cargaría.
  - «Actualiza en vivo» usa page.clock: vigilarParroquia() sigue con su intervalo de producción
    (60000 ms) y la prueba adelanta el reloj, sin tocar el código de la página.
*/
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { crearServidor } = require('../../herramientas/servidor-vicaria');
const { huella: huellaBase, CASOS: CASOS_BASE } = require('./linea-base');

const CAPTURAS = path.join(__dirname, '..', 'capturas', 'vicaria');
const RAIZ = path.join(__dirname, '..', '..', 'vicaria');
fs.mkdirSync(path.join(CAPTURAS, 'comparacion'), { recursive: true });
fs.mkdirSync(path.join(CAPTURAS, '1b'), { recursive: true });

const CA = 'ciudad-arce';
const SJ = 'san-jose-ejemplo';
const HOST = '127.0.0.1';   // el servidor escucha solo en IPv4: «localhost» pasaría primero por ::1
const configDe = (slug) => JSON.parse(fs.readFileSync(path.join(RAIZ, slug, 'config.json'), 'utf8'));
const CONFIG = { [CA]: configDe(CA), [SJ]: configDe(SJ) };
const CONFIG_NOMBRE_CA = CONFIG[CA].nombre.toUpperCase();

let fallos = 0;
const revisar = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fallos++; };
const igual = (real, esperado, msg) => revisar(real === esperado, msg + (real === esperado ? '' : ' (era ' + JSON.stringify(real) + ', se esperaba ' + JSON.stringify(esperado) + ')'));

let base;
let errores = [];

/* Abre una página con el visor indicado; anota los errores de JavaScript (los 404 de recursos que la prueba provoca no cuentan). */
async function abrir(ctx, ruta, ancho = 1920, alto = 1080, antes) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(ruta + ': ' + e.message));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errores.push(ruta + ' (consola): ' + m.text());
  });
  // Un script o una hoja de la página que no se pudo pedir deja errores sueltos («ordenTipos is not defined»):
  // se anota la causa. Las imágenes y config.json que la prueba aborta a propósito no cuentan; ERR_ABORTED es navegar a otra página.
  p.on('requestfailed', (q) => {
    if (/\.(js|css|html)(\?|$)/.test(q.url()) && !/ERR_ABORTED/.test(q.failure().errorText)) errores.push(ruta + ': no se pudo cargar ' + q.url() + ' (' + q.failure().errorText + ')');
  });
  await p.setViewportSize({ width: ancho, height: alto });
  if (antes) await antes(p);
  await p.goto(base + ruta);
  return p;
}

const nuevoContexto = () => browser.newContext();
let browser;

/* Elige un tipo desde Preparar, como lo haría el voluntario. */
async function elegirTipo(panel, clave) {
  await panel.click('[data-hoja="preparar"]');
  await panel.click('#cambiar-tipo');
  await panel.click(`[data-tipo="${clave}"]`);
  await panel.click('#continuar');
}

const texto = (p, sel) => p.textContent(sel);

/* ¿El <img> se ve de verdad? (no oculto y con píxeles) */
const imagenVisible = (p, sel) => p.evaluate((s) => {
  const i = document.querySelector(s);
  if (!i) return false;
  for (let n = i; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return i.complete && i.naturalWidth > 0;
}, sel);

/* Imágenes visibles que no cargaron (ícono de imagen rota). */
const imagenesRotas = (p) => p.evaluate(() => [...document.images].filter((i) => {
  for (let n = i; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return !(i.complete && i.naturalWidth > 0);
}).map((i) => i.getAttribute('src')));

const reyDe = (p) => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--rey').trim());
const claves = (p) => p.evaluate(() => Object.keys(localStorage));

const rutaConfig = '**/config.json';
const servirConfig = (cuerpo) => (r) => r.fulfill({ status: 200, contentType: 'application/json', body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });

async function captura(p, nombre) {
  await p.screenshot({ path: path.join(CAPTURAS, nombre + '.png') });
}

/* ---------- Casos ---------- */

async function casoCarga() {
  console.log('Carga');
  const ctx = await nuevoContexto();
  const inicio = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await inicio.waitForSelector('#marca-logo:not([hidden])');
  await inicio.waitForTimeout(900);
  revisar((await inicio.innerText('body')).includes('Inmaculada'), 'Ciudad Arce: la pantalla de inicio muestra «Inmaculada»');
  revisar(await imagenVisible(inicio, '#marca-logo'), 'Ciudad Arce: el logo se ve');
  igual(await inicio.getAttribute('#marca-logo', 'alt'), CONFIG[CA].logos.blanco.alt, 'Ciudad Arce: el logo lleva su alt');
  igual(await reyDe(inicio), '#1155a4', 'Ciudad Arce: --rey es el principal de su configuración');
  await captura(inicio, `${CA}_inicio`);

  // San José: portada patronal. El tipo se elige en su panel (el estado es de su parroquia).
  const panel = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250);
  const portada = await abrir(ctx, `/${SJ}/pantalla.html?tipo=portada`);
  await panel.waitForTimeout(600);
  await elegirTipo(panel, 'patronal');
  await portada.waitForTimeout(900);
  igual((await texto(portada, '#p-caja-num')).trim(), '19', 'San José: la portada patronal muestra el día 19');
  igual((await texto(portada, '#p-caja-mes')).trim(), 'MAR', 'San José: la portada patronal muestra MAR');
  revisar((await texto(portada, '#p-titulo')).includes('San José'), 'San José: la portada nombra al patrono');
  igual((await texto(portada, '#p-cursiva')).trim(), 'en honor a', 'San José: la portada dice «en honor a» San José (sin «la»)');
  igual(await reyDe(portada), '#8a1c2b', 'San José: --rey es #8a1c2b');
  const fondo = await portada.evaluate(() => getComputedStyle(document.getElementById('lienzo')).backgroundImage);
  revisar(fondo.includes('rgb(75, 15, 24)') && fondo.includes('rgb(138, 28, 43)'), 'San José: el fondo usa #4b0f18 y #8a1c2b (' + fondo.slice(0, 90) + '…)');
  revisar((await portada.innerText('body')).trim() !== '' && !(await portada.innerText('body')).includes('Inmaculada'), 'San José: ningún texto de Ciudad Arce');
  await captura(portada, `${SJ}_portada`);
  await ctx.close();
}

async function casoNoSeCruzan() {
  console.log('Dos parroquias no se cruzan');
  const ctx = await nuevoContexto();
  const panelCA = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  const panelSJ = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250);
  const pantCA = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  const pantSJ = await abrir(ctx, `/${SJ}/pantalla.html?tipo=inicio`);
  await panelSJ.waitForTimeout(1200);
  const antesCA = await texto(pantCA, '#i-pildora');
  const antesSJ = await texto(pantSJ, '#i-pildora');
  await elegirTipo(panelSJ, 'patronal');
  await pantSJ.waitForTimeout(900);
  const despuesCA = await texto(pantCA, '#i-pildora');
  const despuesSJ = await texto(pantSJ, '#i-pildora');
  igual(despuesCA, antesCA, 'cambiar el tipo en el panel de San José no cambia la pantalla de Ciudad Arce («' + despuesCA + '»)');
  revisar(despuesSJ !== antesSJ, 'la pantalla de San José sí cambia («' + antesSJ + '» → «' + despuesSJ + '»)');
  revisar(/PATRONAL/i.test(despuesSJ), 'la pantalla de San José dice fiesta patronal');

  await elegirTipo(panelCA, 'dominical');
  await pantCA.waitForTimeout(900);
  igual(await texto(pantSJ, '#i-pildora'), despuesSJ, 'y al revés: el panel de Ciudad Arce no mueve a San José');
  revisar((await texto(pantCA, '#i-pildora')) !== antesCA, 'la pantalla de Ciudad Arce sí cambia');

  const ks = await claves(panelCA);
  revisar(ks.length > 0 && ks.every((k) => k.startsWith('pev_')), 'localStorage: todas las claves empiezan con pev_ (' + ks.join(', ') + ')');
  revisar(!ks.some((k) => k.startsWith('parroquia_')), 'localStorage: ninguna clave parroquia_');
  revisar(ks.includes(`pev_${CA}_estado_v1`) && ks.includes(`pev_${SJ}_estado_v1`), 'cada parroquia guarda su propio estado');
  const estadoCA = await panelCA.evaluate((k) => JSON.parse(localStorage.getItem(k)).tipo, `pev_${CA}_estado_v1`);
  const estadoSJ = await panelCA.evaluate((k) => JSON.parse(localStorage.getItem(k)).tipo, `pev_${SJ}_estado_v1`);
  revisar(estadoCA === 'dominical' && estadoSJ === 'patronal', 'estados guardados por separado (' + estadoCA + ' / ' + estadoSJ + ')');
  const copias = ks.filter((k) => k.endsWith('_config_v1'));
  revisar(copias.length === 2, 'una copia de configuración por parroquia (' + copias.join(', ') + ')');
  await ctx.close();
}

async function casoSinLema() {
  console.log('Sin lema no hay franja');
  const ctx = await nuevoContexto();
  const sj = await abrir(ctx, `/${SJ}/pantalla.html?tipo=inicio`);
  const ca = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await sj.waitForTimeout(1100);
  igual(await texto(sj, '#frase'), '', 'San José: la franja no tiene texto');
  igual(await sj.evaluate(() => getComputedStyle(document.getElementById('frase').parentNode).visibility), 'hidden', 'San José: la frase de la franja está oculta');
  const cuerpo = await sj.innerText('body');
  revisar(!/[«»]/.test(cuerpo), 'San José: ninguna comilla «» suelta en la pantalla');
  revisar(!(await sj.evaluate(() => document.querySelector('.franja .frase').innerText.includes('✦') && getComputedStyle(document.querySelector('.franja .frase')).visibility !== 'hidden')), 'San José: tampoco los ✦ de la franja');
  await captura(sj, `${SJ}_inicio`);
  igual((await texto(ca, '#frase')).trim(), '«TODA HERMOSA ERES, MARÍA»', 'Ciudad Arce: la franja trae su lema');
  await ctx.close();
}

async function casoSinRedConCopia() {
  console.log('Sin red, con copia guardada');
  const ctx = await nuevoContexto();
  const AVISO = /^Usando la configuración guardada del \d{1,2} de [a-záéíóú]+ de \d{4}$/;
  // 1) recargar con config.json caído
  let panel = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  let pant = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await pant.waitForSelector('#marca-logo:not([hidden])');
  await panel.waitForTimeout(800);
  igual(await panel.isHidden('#aviso-config'), true, 'con red no hay aviso de configuración');
  await ctx.route(rutaConfig, (r) => r.abort());
  await panel.reload();
  await pant.reload();
  await panel.waitForSelector('#aviso-config:not([hidden])');
  const aviso = (await texto(panel, '#aviso-config')).trim();
  revisar(AVISO.test(aviso), 'el panel avisa: «' + aviso + '»');
  await pant.waitForTimeout(900);
  revisar(await imagenVisible(pant, '#marca-logo'), 'la pantalla mantiene el logo (recargada sin config.json)');
  igual(await reyDe(pant), '#1155a4', 'la pantalla mantiene los colores');
  await captura(pant, `${CA}_inicio_sin-red`);
  await ctx.unroute(rutaConfig);

  // 2) la red se corta con las páginas abiertas: la vuelta siguiente avisa y no borra nada
  panel = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  pant = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await pant.waitForSelector('#marca-logo:not([hidden])');
  await panel.waitForTimeout(800);
  await ctx.setOffline(true);
  await panel.evaluate(() => cargarParroquia());
  await pant.evaluate(() => cargarParroquia());
  await panel.waitForSelector('#aviso-config:not([hidden])');
  revisar(AVISO.test((await texto(panel, '#aviso-config')).trim()), 'context.setOffline: el panel avisa que usa la copia guardada');
  revisar(await imagenVisible(pant, '#marca-logo'), 'context.setOffline: la pantalla mantiene el logo');
  await ctx.setOffline(false);
  await panel.evaluate(() => cargarParroquia());
  await panel.waitForSelector('#aviso-config', { state: 'hidden' });
  revisar(true, 'al volver la red el aviso desaparece solo');
  await ctx.close();
}

async function casoPrimeraVezSinRed() {
  console.log('Primera vez sin red');
  const ctx = await nuevoContexto();
  await ctx.route(rutaConfig, (r) => r.abort());
  const panel = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  const pant = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await panel.waitForSelector('#aviso-config:not([hidden])');
  igual((await texto(panel, '#aviso-config')).trim(), 'Sin conexión y sin configuración guardada: se muestran pantallas neutras.', 'el panel avisa de las pantallas neutras');
  await pant.waitForTimeout(900);
  revisar(!(await imagenVisible(pant, '#marca-logo')) && !(await imagenVisible(pant, '#fachada')), 'la pantalla neutra no muestra logo ni fachada');
  revisar((await imagenesRotas(pant)).length === 0, 'y no queda ninguna imagen rota');
  revisar(!(await pant.innerText('body')).includes('Inmaculada'), 'la pantalla neutra no nombra a ninguna parroquia');
  igual(await reyDe(pant), '#1155a4', 'la pantalla neutra usa la paleta neutra');
  revisar(!(await claves(pant)).some((k) => k.endsWith('_config_v1')), 'la neutra nunca se guarda como copia');
  await captura(pant, `${CA}_neutra`);
  await captura(panel, `${CA}_panel_neutra`);
  await ctx.close();
}

async function casoConfigDanada() {
  console.log('Configuración dañada');
  const ctx = await nuevoContexto();
  // con copia
  const p0 = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await p0.waitForSelector('#marca-logo:not([hidden])');
  await ctx.route(rutaConfig, servirConfig('{'));
  const panel = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  const pant = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);
  await panel.waitForSelector('#aviso-config:not([hidden])');
  igual((await texto(panel, '#aviso-config')).trim(), 'La configuración del servidor está dañada: se usa la guardada.', 'con copia: el panel avisa que la configuración está dañada');
  await pant.waitForTimeout(900);
  revisar(await imagenVisible(pant, '#marca-logo'), 'con copia: la pantalla sigue con la copia (logo)');
  igual(await reyDe(pant), '#1155a4', 'con copia: los colores son los de la copia');
  await ctx.unroute(rutaConfig);
  await ctx.close();

  // sin copia
  const ctx2 = await nuevoContexto();
  await ctx2.route(rutaConfig, servirConfig('{'));
  const panel2 = await abrir(ctx2, `/${CA}/panel.html`, 360, 1250);
  await panel2.waitForSelector('#aviso-config:not([hidden])');
  igual((await texto(panel2, '#aviso-config')).trim(), 'La configuración del servidor está dañada: se muestran pantallas neutras.', 'sin copia: el panel avisa de las pantallas neutras');
  revisar(!(await claves(panel2)).some((k) => k.endsWith('_config_v1')), 'sin copia: lo dañado no se guarda');
  await ctx2.close();

  // JSON válido pero que no pasa la validación (sin alt en el logo)
  const ctx3 = await nuevoContexto();
  const mala = JSON.parse(JSON.stringify(CONFIG[CA]));
  delete mala.logos.blanco.alt;
  await ctx3.route(rutaConfig, servirConfig(mala));
  const panel3 = await abrir(ctx3, `/${CA}/panel.html`, 360, 1250);
  await panel3.waitForSelector('#aviso-config:not([hidden])');
  revisar(/dañada/.test(await texto(panel3, '#aviso-config')), 'una configuración sin alt en el logo cuenta como dañada');
  await ctx3.close();
}

async function casoDireccionesRaras() {
  console.log('Direcciones raras');
  const ctx = await nuevoContexto();
  for (const ruta of [`/Ciudad-Arce/pantalla.html`, `/no-existe/pantalla.html`, `/no-existe/panel.html`, `/no-existe/rotulos.html`, `/no-existe/produccion.html`]) {
    const p = await abrir(ctx, ruta, ruta.includes('panel') ? 360 : 1920, ruta.includes('panel') ? 800 : 1080);
    await p.waitForSelector('#no-existe', { state: 'visible' });
    igual((await texto(p, '#no-existe')).trim(), 'Esta parroquia no existe, revisá el link', ruta + ': «Esta parroquia no existe, revisá el link»');
    const cuerpo = await p.innerText('body');
    revisar(!/Inmaculada|San José/.test(cuerpo), ruta + ': sin datos de ninguna parroquia');
    revisar((await claves(p)).filter((k) => !k.startsWith('pev_')).length === 0, ruta + ': sin claves ajenas a pev_');
    if (ruta === '/no-existe/pantalla.html') await captura(p, 'no-existe_pantalla');
    if (ruta === '/no-existe/panel.html') await captura(p, 'no-existe_panel');
  }
  // mayúsculas: ni siquiera se pide config.json ni se guarda copia
  const mayus = await abrir(ctx, '/Ciudad-Arce/pantalla.html');
  await mayus.waitForTimeout(500);
  revisar((await claves(mayus)).length === 0 || !(await claves(mayus)).some((k) => k.endsWith('_config_v1')), '/Ciudad-Arce/: no guarda ninguna copia');

  const raiz = await ctx.request.get(base + `/${CA}/`);
  igual(raiz.status(), 404, `/${CA}/ sin archivo: 404 del servidor`);
  revisar(!/Inmaculada|San José|Ciudad Arce/.test(await raiz.text()), `/${CA}/: el 404 no trae datos de ninguna parroquia`);
  igual((await ctx.request.get(base + '/Ciudad-Arce/config.json')).status(), 404, '/Ciudad-Arce/config.json: 404 (mayúsculas no valen)');
  igual((await ctx.request.get(base + '/')).status(), 404, '/: 404');
  igual((await ctx.request.get(base + `/${CA}/vercel.json`)).status(), 404, `/${CA}/vercel.json: 404 (no es una ruta publicada)`);
  const cfg = await ctx.request.get(base + `/${CA}/config.json`);
  igual(cfg.headers()['cache-control'], 'public, max-age=0, must-revalidate', 'config.json trae Cache-Control must-revalidate (de vercel.json)');
  await ctx.close();
}

async function casoActualizaEnVivo() {
  console.log('Actualiza en vivo');
  const ctx = await nuevoContexto();
  const v2 = Object.assign({}, CONFIG[CA], { version: 2, publicado: '2026-11-08T12:00:00Z', colores: { principal: '#7a3b12', oscuro: '#4a2008' } });
  let sirve = null;   // null: el archivo real; un objeto: esa configuración
  await ctx.route(rutaConfig, (r) => (sirve ? servirConfig(sirve)(r) : r.continue()));
  const pant = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`, 1920, 1080, (p) => p.clock.install());
  await pant.waitForSelector('#marca-logo:not([hidden])');
  await pant.evaluate(() => { window.__sinRecargar = 1; });
  igual(await reyDe(pant), '#1155a4', 'antes: color azul');
  sirve = v2;
  await pant.clock.runFor(61000);   // un tic de vigilarParroquia(60000)
  await pant.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--rey').trim() === '#7a3b12', null, { timeout: 5000 }).catch(() => {});
  igual(await reyDe(pant), '#7a3b12', 'después de un tic: el color cambió');
  igual(await pant.evaluate(() => window.__sinRecargar), 1, 'sin recargar la página');
  igual(await pant.evaluate((k) => JSON.parse(localStorage.getItem(k)).version, `pev_${CA}_config_v1`), 2, 'la copia guardada pasó a la versión 2');
  await captura(pant, `${CA}_inicio_v2`);
  await ctx.close();
}

async function casoImagenRota() {
  console.log('Imagen rota');
  const ctx = await nuevoContexto();
  await ctx.route('**/medios/patrono.png', (r) => r.abort());
  const pant = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`);   // novena: imagen del patrono
  await pant.waitForTimeout(1500);
  const src = await pant.getAttribute('#virgen', 'src');
  igual(src, 'medios/fachada.jpg', 'cae a la fachada (src: ' + src + ')');
  revisar(await imagenVisible(pant, '#virgen'), 'la fachada se ve');
  igual(await pant.getAttribute('#virgen', 'alt'), CONFIG[CA].fachada.alt, 'con el alt de la fachada');
  igual((await imagenesRotas(pant)).length, 0, 'ninguna imagen rota a la vista');
  await captura(pant, `${CA}_inicio_patrono-roto`);

  // si falla también la fachada: se oculta y queda el degradado
  const ctx2 = await nuevoContexto();
  await ctx2.route(/medios\/(patrono\.png|fachada\.jpg)$/, (r) => r.abort());
  const pant2 = await abrir(ctx2, `/${CA}/pantalla.html?tipo=inicio`);
  await pant2.waitForTimeout(1500);
  igual((await imagenesRotas(pant2)).length, 0, 'sin patrono ni fachada: tampoco hay ícono roto');
  await captura(pant2, `${CA}_inicio_sin-imagenes`);
  await ctx.close();
  await ctx2.close();
}

async function casoRecursosComunes() {
  console.log('Recursos comunes (fuentes e imágenes de la raíz, vía vercel.json)');
  const ctx = await nuevoContexto();
  for (const slug of [CA, SJ]) {
    const panel = await abrir(ctx, `/${slug}/panel.html`, 360, 1250);
    const pant = await abrir(ctx, `/${slug}/pantalla.html?tipo=inicio`);
    const mal = [];
    pant.on('response', (r) => { if (r.status() >= 400) mal.push(r.status() + ' ' + new URL(r.url()).pathname); });
    await panel.waitForTimeout(500);
    for (const [tipo, archivo] of [['horasanta', 'img/custodia.png'], ['otros', 'img/santo.png']]) {
      await elegirTipo(panel, tipo);
      await pant.waitForTimeout(1000);
      igual(await pant.getAttribute('#virgen', 'src'), archivo, `${slug}: ${tipo} pide ${archivo}`);
      revisar(await imagenVisible(pant, '#virgen'), `${slug}: ${archivo} carga y se ve`);
    }
    await pant.reload();
    await pant.waitForTimeout(1000);
    const fuentes = await pant.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join(','); });
    revisar(/Mont/.test(fuentes) && /Vibes/.test(fuentes), `${slug}: las fuentes locales cargan (${fuentes})`);
    revisar(mal.length === 0, `${slug}: ningún recurso responde 4xx/5xx (${mal.join(', ') || 'ninguno'})`);
  }
  await ctx.close();
}

/* Capturas de cada pantalla (1920×1080 y 800×600) y medidas de «marca» y «barra». */
async function casoCapturasYMedidas() {
  console.log('Capturas y medidas');
  const medidas = {};
  for (const slug of [CA, SJ]) {
    const ctx = await nuevoContexto();
    const panel = await abrir(ctx, `/${slug}/panel.html`, 360, 1250);
    const inicio = await abrir(ctx, `/${slug}/pantalla.html?tipo=inicio`);
    const gracias = await abrir(ctx, `/${slug}/pantalla.html?tipo=gracias`);
    const avisos = await abrir(ctx, `/${slug}/pantalla.html?tipo=avisos`);
    const portada = await abrir(ctx, `/${slug}/pantalla.html?tipo=portada`);
    const rotulos = await abrir(ctx, `/${slug}/rotulos.html`);
    const chica = await abrir(ctx, `/${slug}/pantalla.html?tipo=inicio`, 800, 600);
    const prod = await abrir(ctx, `/${slug}/produccion.html`, 1280, 800);
    await panel.waitForTimeout(1500);
    await elegirTipo(panel, 'patronal');
    await panel.waitForTimeout(1200);
    const errPag = await Promise.all([inicio, gracias, avisos, portada, rotulos, chica, prod].map((p) => imagenesRotas(p)));
    revisar(errPag.every((r) => r.length === 0), slug + ': ninguna pantalla tiene imágenes rotas');
    await captura(panel, `${slug}_panel`);
    await captura(inicio, `${slug}_inicio_patronal`);
    await captura(gracias, `${slug}_gracias`);
    await captura(avisos, `${slug}_avisos`);
    await captura(portada, `${slug}_portada`);
    await captura(rotulos, `${slug}_rotulos`);
    await captura(chica, `${slug}_inicio_800x600`);
    await captura(prod, `${slug}_produccion`);

    // «marca»: nombre · lugar en una línea; ¿cabe?
    medidas[slug] = {};
    for (const [nombre, p] of [['inicio', inicio], ['chica', chica]]) {
      medidas[slug]['marca_' + nombre] = await p.evaluate(() => {
        const m = document.getElementById('marca').getBoundingClientRect();
        const t = document.getElementById('t-marca');
        const r = t.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(t).fontSize) * 1.25;
        return { ancho: Math.round(m.width), derecha: Math.round(m.right), lineas: Math.round(r.height / lh), texto: t.textContent, ventana: innerWidth };
      });
    }
    // «barra»: con tipo que usa {parroquia} (semana, evento) y con el patronal
    for (const tipo of ['semana', 'evento', 'patronal']) {
      await elegirTipo(panel, tipo);
      await rotulos.waitForTimeout(1400);
      medidas[slug]['barra_' + tipo] = await rotulos.evaluate(() => {
        const b = document.getElementById('barra').getBoundingClientRect();
        const l = document.getElementById('logo').getBoundingClientRect();
        return { izquierda: Math.round(b.left), ancho: Math.round(b.width), derecha: Math.round(b.right), texto: document.getElementById('barra-y').textContent, tocaLogo: b.left < l.right && b.top < l.bottom };
      });
      if (tipo === 'semana') await captura(rotulos, `${slug}_rotulos_barra_semana`);
      if (tipo === 'evento') await captura(rotulos, `${slug}_rotulos_barra_evento`);
    }
    await ctx.close();
  }
  console.log(JSON.stringify(medidas, null, 2));
  for (const slug of [CA, SJ]) {
    for (const k of ['marca_inicio', 'marca_chica']) {
      const m = medidas[slug][k];
      revisar(m.derecha <= m.ventana, `${slug}: ${k} cabe en pantalla (borde derecho ${m.derecha} de ${m.ventana}; ${m.lineas} línea(s))`);
    }
    for (const k of ['barra_semana', 'barra_evento', 'barra_patronal']) {
      const b = medidas[slug][k];
      revisar(b.izquierda >= 0 && b.derecha <= 1920, `${slug}: ${k} no se sale de la pantalla (x ${b.izquierda}–${b.derecha}, ancho ${b.ancho})`);
    }
  }
  return medidas;
}

/* ---------- Etapa 1b: personalización por pantalla ---------- */

const conBloques = (cambios) => { const c = JSON.parse(JSON.stringify(CONFIG[CA])); cambios(c); return c; };
const estadoCA = (estado) => (p) => p.addInitScript(([k, v]) => localStorage.setItem(k, v), [`pev_${CA}_estado_v1`, JSON.stringify(estado)]);
const clasesNuevas = (p) => p.evaluate(() => [...document.getElementById('escenario').classList].filter((c) => /^(fondo-|dist-|oculto-)/.test(c)));
const visibleEl = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return false;
  for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false; }
  return true;
}, sel);

async function casoComoViene() {
  console.log('1b · Como viene (Ciudad Arce sin bloques nuevos)');
  const ctx = await nuevoContexto();
  // [vista, tipo del estado, [id del elemento, clave de texto]]
  const vistas = [
    ['inicio', 'novena', [['i-pildora', 'inicio_pildora'], ['i-ceja', 'inicio_ceja'], ['i-titulo', 'inicio_titulo'], ['i-cursiva', 'inicio_cursiva'], ['i-cuenta-txt', 'inicio_cuenta'], ['t-marca', 'marca'], ['frase', 'franja']]],
    ['portada', 'patronal', [['p-ceja', 'portada_ceja'], ['p-cursiva', 'portada_cursiva'], ['p-titulo', 'portada_titulo'], ['p-fecha', 'portada_fecha'], ['p-sub', 'portada_sub']]],
    ['gracias', 'novena', [['g-pildora', 'gracias_pildora'], ['g-titulo', 'gracias_titulo'], ['g-cursiva', 'gracias_cursiva'], ['g-ceja', 'gracias_ceja']]],
    ['avisos', 'novena', [['a-sub', 'avisos_sub'], ['a-titulo', 'avisos_titulo']]]
  ];
  for (const [vista, tipo, textos] of vistas) {
    const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=${vista}`, 1920, 1080, estadoCA({ tipo }));
    await p.waitForTimeout(1200);
    igual((await clasesNuevas(p)).join(' '), '', `${vista}: .escenario no recibe ninguna clase fondo-/dist-/oculto-`);
    igual(await p.evaluate(() => document.getElementById('escenario').style.getPropertyValue('--fondo-vista')), '', `${vista}: no hay --fondo-vista`);
    revisar(!(await visibleEl(p, '#fondo-img')), `${vista}: no hay imagen de fondo`);
    const distintos = await p.evaluate((pares) => {
      const s = leerEstado();
      return pares.filter(([id, clave]) => document.getElementById(id).textContent !== tx(s, clave)).map(([id]) => id);
    }, textos);
    igual(distintos.join(','), '', `${vista}: los textos son los de tx`);
    // Fachada de fondo, rayos y chispas vuelven en todas las vistas, como en obs/ (decisión del usuario, 2026-11-14)
    revisar(await visibleEl(p, '#chispas') && await p.evaluate(() => document.querySelectorAll('#chispas .chispa').length) > 0, `${vista}: las chispas se ven`);
    revisar(await visibleEl(p, '.rayos') && await imagenVisible(p, '#fachada'), `${vista}: los rayos y la fachada de fondo se ven`);
    revisar(await visibleEl(p, '#marca') !== (vista === 'avisos'), `${vista}: marca como en la 1a`);
    await captura(p, `1b/${CA}_${vista}_como-viene`);
  }
  // y la vista nueva, sin horarios ni redes: el aviso del panel
  const h = await abrir(ctx, `/${CA}/pantalla.html?tipo=horarios`);
  await h.waitForTimeout(1000);
  igual((await texto(h, '#h-titulo')).trim(), 'Horarios de misa', 'horarios: el título por defecto');
  igual((await texto(h, '#h-filas')).trim(), '', 'horarios: sin horarios ni redes no se pone ninguna instrucción al aire');
  revisar(!(await visibleEl(h, '#h-filas')), 'horarios: sin horarios ni redes la lista queda oculta');
  revisar(!/panel/i.test(await h.innerText('body')), 'horarios: ninguna mención del panel en la pantalla');
  revisar(!(await visibleEl(h, '#h-redes')), 'horarios: sin redes no hay franja de redes');
  igual((await clasesNuevas(h)).join(' '), '', 'horarios: sin clases nuevas');
  await ctx.close();
}

async function casoEstiloRotulos() {
  console.log('1b · Estilo de rótulos');
  const ctx = await nuevoContexto();
  const cfg = conBloques((c) => { c.rotulos = { esquinas: 'rectas', posicion: 'centro', colorLado: '#1a5276', cargos: ['LECTOR', 'MONAGUILLO'] }; });
  await ctx.route(rutaConfig, servirConfig(cfg));
  const r = await abrir(ctx, `/${CA}/rotulos.html`, 1920, 1080, estadoCA({ tipo: 'semana', rotulo: 'persona' }));
  await r.waitForSelector('#rotulo.en');
  await r.waitForTimeout(1500);
  const medidas = () => r.evaluate(() => {
    const el = document.getElementById('rotulo'); const b = el.getBoundingClientRect();
    return { radio: getComputedStyle(el).borderRadius, centro: b.left + b.width / 2, lado: getComputedStyle(el.querySelector('.lado')).backgroundColor,
      logo: getComputedStyle(document.getElementById('logo')).borderRadius, barra: getComputedStyle(document.getElementById('barra')).borderRadius,
      clases: [...document.getElementById('escenario').classList].filter((x) => /^(esquinas-|pos-)/.test(x)).join(' ') };
  });
  let m = await medidas();
  igual(m.radio, '0px', 'rótulo: esquinas rectas (borderRadius 0px)');
  igual(m.logo, '0px', 'capa del logo: esquinas rectas');
  igual(m.barra, '0px', 'barra: esquinas rectas');
  revisar(Math.abs(m.centro - 960) <= 2, 'rótulo: centrado en 960 (centro en ' + m.centro.toFixed(1) + ')');
  igual(m.lado, 'rgb(26, 82, 118)', 'rótulo: el lado usa colorLado');
  const anim = await r.evaluate(() => getComputedStyle(document.querySelector('#rotulo .cuerpo')).animationName);
  igual(anim, 'cuerpoEntra', 'rótulo centrado: la animación de entrada sigue activa');
  await captura(r, `1b/${CA}_rotulo_estilo`);
  // al quitar el bloque, todo vuelve a lo de siempre
  await r.evaluate(() => { PARROQUIA = Object.assign({}, PARROQUIA, { rotulos: undefined }); aplicarParroquia(PARROQUIA); });
  m = await medidas();
  igual(m.clases, '', 'sin bloque: se quitan las clases');
  igual(m.radio, '24px', 'sin bloque: vuelven las esquinas suaves (24px)');
  revisar(m.lado !== 'rgb(26, 82, 118)', 'sin bloque: se quita --lado');
  revisar(await r.evaluate(() => document.getElementById('escenario').style.getPropertyValue('--lado') === ''), 'sin bloque: --lado vacío');

  const panel = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  await panel.waitForSelector('#cargos option', { state: 'attached' });
  const op = await panel.evaluate(() => [...document.querySelectorAll('#cargos option')].map((o) => o.value));
  igual(JSON.stringify(op), JSON.stringify(['LECTOR', 'MONAGUILLO']), 'panel: el datalist tiene los cargos de la configuración');
  await ctx.close();

  const ctx2 = await nuevoContexto();
  const p2 = await abrir(ctx2, `/${CA}/panel.html`, 360, 1250);
  await p2.waitForSelector('#cargos option', { state: 'attached' });
  const op2 = await p2.evaluate(() => [...document.querySelectorAll('#cargos option')].map((o) => o.value));
  igual(JSON.stringify(op2), JSON.stringify(['CELEBRANTE', 'PREDICADOR', 'CONCELEBRANTE', 'DIÁCONO', 'GUÍA', 'CORO']), 'panel sin bloque: el datalist es CARGOS');
  const r2 = await abrir(ctx2, `/${CA}/rotulos.html`, 1920, 1080, estadoCA({ tipo: 'semana', rotulo: 'persona' }));
  await r2.waitForSelector('#rotulo.en');
  igual(await r2.evaluate(() => [...document.getElementById('escenario').classList].filter((x) => /^(esquinas-|pos-)/.test(x)).join(' ')), '', 'Ciudad Arce sin bloque: ninguna clase nueva');
  await ctx2.close();
}

async function casoPersonalizada() {
  console.log('1b · Pantalla personalizada');
  const ctx = await nuevoContexto();
  const cfg = conBloques((c) => {
    c.galeria = [{ id: 'fondo-fiesta', src: 'medios/fachada.jpg', alt: 'Fachada como fondo' }];
    c.pantallas = {
      inicio: {
        modo: 'personalizada', fondo: { tipo: 'color', color: '#7a3b12' }, imagen: 'patrono',
        distribucion: 'derecha', ocultar: ['chispas'], textos: { inicio_titulo: 'Bienvenidos a {patrono}' }
      },
      gracias: { modo: 'personalizada', fondo: { tipo: 'imagen', imagen: 'fondo-fiesta' }, imagen: 'ninguna', distribucion: 'centro', ocultar: ['marca', 'envivo', 'franja', 'esquina', 'rayos', 'fachada'] }
    };
  });
  await ctx.route(rutaConfig, servirConfig(cfg));
  const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`, 1920, 1080, estadoCA({ tipo: 'novena' }));
  await p.waitForSelector('#marca-logo:not([hidden])');
  await p.waitForTimeout(1500);
  igual(await p.evaluate(() => document.getElementById('escenario').style.getPropertyValue('--fondo-vista')), '#7a3b12', 'inicio: --fondo-vista es el color de la configuración');
  igual(await p.evaluate(() => getComputedStyle(document.getElementById('lienzo')).backgroundColor), 'rgb(122, 59, 18)', 'inicio: el lienzo se pinta de ese color');
  revisar(await p.evaluate(() => document.getElementById('virgen').closest('.escenario').classList.contains('dist-derecha')), 'inicio: #virgen está dentro de un escenario dist-derecha');
  const caja = await p.evaluate(() => { const r = document.getElementById('virgen').getBoundingClientRect(); const t = document.querySelector('#v-inicio').getBoundingClientRect(); return { virgen: r.left, texto: t.right }; });
  revisar(caja.virgen > 960 && caja.texto < caja.virgen + 1, 'inicio: la imagen queda a la derecha y el texto a la izquierda (' + Math.round(caja.virgen) + ' / ' + Math.round(caja.texto) + ')');
  revisar(!(await visibleEl(p, '#chispas')), 'inicio: #chispas no se ve');
  revisar(await visibleEl(p, '#marca') && await visibleEl(p, '#envivo'), 'inicio: lo que no se ocultó sigue a la vista');
  igual((await texto(p, '#i-titulo')).trim(), 'Bienvenidos a ' + await p.evaluate(() => rellenar('{patrono}', leerEstado())), 'inicio: el título sale de la configuración con el hueco {patrono} relleno');
  revisar((await texto(p, '#i-titulo')).includes('Inmaculada'), 'inicio: el hueco {patrono} es el patrono de la parroquia');
  await captura(p, `1b/${CA}_inicio_personalizada`);

  const g = await abrir(ctx, `/${CA}/pantalla.html?tipo=gracias`, 1920, 1080, estadoCA({ tipo: 'novena' }));
  await g.waitForTimeout(1500);
  const cl = await clasesNuevas(g);
  revisar(['fondo-imagen', 'dist-centro', 'oculto-marca', 'oculto-envivo', 'oculto-franja', 'oculto-esquina', 'oculto-rayos', 'oculto-fachada'].every((x) => cl.includes(x)), 'gracias: clases ' + cl.join(' '));
  revisar(await visibleEl(g, '#fondo-img') && await imagenVisible(g, '#fondo-img'), 'gracias: la imagen de fondo de la galería se ve');
  igual(await g.getAttribute('#fondo-img', 'alt'), 'Fachada como fondo', 'gracias: el fondo lleva su alt');
  revisar(!(await visibleEl(g, '#virgen')), 'gracias: imagen «ninguna» oculta la imagen (sin ícono roto)');
  igual((await imagenesRotas(g)).length, 0, 'gracias: ninguna imagen rota');
  revisar(!(await visibleEl(g, '#marca')) && !(await visibleEl(g, '#envivo')), 'gracias: marca y EN VIVO ocultos');
  revisar(!(await visibleEl(g, '.rayos')) && !(await visibleEl(g, '#fachada')), 'gracias: rayos y fachada ocultos');
  revisar(await visibleEl(g, '#chispas'), 'gracias: las chispas, que no se ocultaron, siguen a la vista');
  revisar((await texto(g, '#g-titulo')).trim() !== '', 'gracias: el título nunca se oculta');
  await captura(g, `1b/${CA}_gracias_personalizada`);
  await ctx.close();

  // si la imagen de fondo falla: se oculta y queda el degradado
  const ctx2 = await nuevoContexto();
  await ctx2.route(rutaConfig, servirConfig(cfg));
  await ctx2.route('**/medios/fachada.jpg', (r) => r.abort());
  const f = await abrir(ctx2, `/${CA}/pantalla.html?tipo=gracias`, 1920, 1080, estadoCA({ tipo: 'novena' }));
  await f.waitForTimeout(1500);
  revisar(!(await visibleEl(f, '#fondo-img')), 'fondo roto: la imagen de fondo se oculta');
  revisar((await f.evaluate(() => getComputedStyle(document.getElementById('lienzo')).backgroundImage)).includes('linear-gradient'), 'fondo roto: queda el degradado');
  igual((await imagenesRotas(f)).length, 0, 'fondo roto: ninguna imagen rota');
  await ctx2.close();
}

async function casoPortadaCaeAInicio() {
  console.log('1b · Portada que pinta Inicio usa los ajustes de Inicio');
  const ctx = await nuevoContexto();
  const cfg = conBloques((c) => {
    c.pantallas = {
      inicio: { modo: 'personalizada', fondo: { tipo: 'color', color: '#7a3b12' }, ocultar: ['chispas'], textos: { inicio_titulo: 'Titulo de inicio' } },
      portada: { modo: 'personalizada', fondo: { tipo: 'color', color: '#4a2008' }, textos: { inicio_titulo: 'Titulo de portada' } }
    };
  });
  await ctx.route(rutaConfig, servirConfig(cfg));
  const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=portada`, 1920, 1080, estadoCA({ tipo: 'dominical' }));
  await p.waitForTimeout(1200);
  revisar(await visibleEl(p, '#v-inicio') && !(await visibleEl(p, '#v-portada')), 'dominical no tiene portada: se pinta Inicio');
  igual(await p.evaluate(() => document.getElementById('escenario').style.getPropertyValue('--fondo-vista')), '#7a3b12', 'el fondo es el del bloque inicio');
  igual((await texto(p, '#i-titulo')).trim(), 'Titulo de inicio', 'el texto es el del bloque inicio');
  revisar(!(await visibleEl(p, '#chispas')), 'lo oculto es lo del bloque inicio');
  await ctx.close();
}

async function casoHorarios() {
  console.log('1b · Horarios y redes');
  const ctx = await nuevoContexto();
  const cfg = conBloques((c) => {
    c.horarios = [
      { dia: 'Domingo', hora: '7:00 a. m.', nota: 'Misa con niños' },
      { dia: 'Domingo', hora: '10:00 a. m.' },
      { dia: 'Sábado', hora: '6:00 p. m.', nota: 'Vigilia' }
    ];
    c.redes = [
      { red: 'facebook', url: 'https://facebook.com/ParroquiaCiudadArce', texto: '/ParroquiaCiudadArce' },
      { red: 'whatsapp', url: 'https://wa.me/50370000000', texto: '7000-0000' }
    ];
    c.pantallas = { horarios: { modo: 'personalizada', textos: { horarios_titulo: 'Misas de la semana' } } };
  });
  await ctx.route(rutaConfig, servirConfig(cfg));
  const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=horarios`);
  await p.waitForSelector('#h-filas .fila');
  await p.waitForTimeout(1200);
  igual((await texto(p, '#h-titulo')).trim(), 'Misas de la semana', 'el título se edita con horarios_titulo');
  igual(await p.evaluate(() => document.querySelectorAll('#h-filas .fila').length), 3, 'tres horarios en la lista');
  const filas = await p.evaluate(() => [...document.querySelectorAll('#h-filas .fila')].map((f) => f.innerText.replace(/\s+/g, ' ').trim()));
  revisar(filas[0].includes('7:00 a. m.') && filas[0].includes('Domingo') && filas[0].includes('Misa con niños'), 'la primera fila trae hora, día y nota (' + filas[0] + ')');
  revisar(await visibleEl(p, '#h-filas') && await visibleEl(p, '#h-redes'), 'lista y redes visibles');
  const redes = await p.evaluate(() => [...document.querySelectorAll('#h-redes .red')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
  igual(redes.join(' | '), 'FACEBOOK /ParroquiaCiudadArce | WHATSAPP 7000-0000', 'las redes muestran su texto');
  const cuerpo = await p.innerText('body');
  revisar(!/https?:|facebook\.com|wa\.me/i.test(cuerpo), 'ninguna URL aparece en el texto de la página');
  revisar(await p.evaluate(() => !document.documentElement.outerHTML.match(/facebook\.com|wa\.me/)), 'ni siquiera en el HTML (las URL no se usan)');
  igual((await imagenesRotas(p)).length, 0, 'horarios: ninguna imagen rota');
  await captura(p, `1b/${CA}_horarios`);
  await ctx.close();

  // el tope de 12 horarios cabe dentro de la tarjeta
  const ctx2 = await nuevoContexto();
  const lleno = conBloques((c) => {
    c.horarios = Array.from({ length: 12 }, (_, i) => ({ dia: 'Día ' + (i + 1), hora: (i + 1) + ':00 p. m.', nota: i % 2 ? 'Nota de ejemplo' : '' }));
    c.redes = [{ red: 'youtube', url: 'https://youtube.com/@x', texto: '@ParroquiaCiudadArce' }];
  });
  await ctx2.route(rutaConfig, servirConfig(lleno));
  const q = await abrir(ctx2, `/${CA}/pantalla.html?tipo=horarios`);
  await q.waitForSelector('#h-filas .fila');
  await q.waitForTimeout(1500);
  const dentro = await q.evaluate(() => {
    const t = document.getElementById('v-horarios').getBoundingClientRect();
    const fuera = [...document.querySelectorAll('#h-filas .fila, #h-redes .red')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > t.bottom - 20 || r.right > t.right; });
    return fuera.length;
  });
  igual(dentro, 0, '12 horarios y una red caben dentro de la tarjeta');
  await captura(q, `1b/${CA}_horarios_12`);
  await ctx2.close();
}

async function casoAvisosFijos() {
  console.log('1b · Avisos fijos');
  const ctx = await nuevoContexto();
  const cfg = conBloques((c) => {
    c.avisos = [
      { texto: 'Fijo vencido', hasta: '2020-01-01', orden: 1 },
      { texto: 'Fijo vigente', detalle: 'Sáb · 6:00 p. m.', orden: 2 },
      { texto: 'Fijo futuro', desde: '2999-01-01', orden: 3 }
    ];
  });
  await ctx.route(rutaConfig, servirConfig(cfg));
  const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=avisos`, 1920, 1080, estadoCA({ tipo: 'novena', avisos: [{ a: 'Aviso del panel', f: 'det' }, { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }] }));
  await p.waitForSelector('#a-filas .fila');
  await p.waitForTimeout(1200);
  const a = await p.evaluate(() => [...document.querySelectorAll('#a-filas .fila .a')].map((e) => e.textContent));
  igual(a.join(' | '), 'Fijo vigente | Aviso del panel', 'el fijo vigente va antes que el del panel; el vencido y el futuro no aparecen');
  igual(await p.evaluate(() => document.querySelector('#a-filas .fila .f').textContent), 'Sáb · 6:00 p. m.', 'el fijo trae su detalle');
  await captura(p, `1b/${CA}_avisos_fijos`);

  // seis filas caben en la tarjeta
  const ctx2 = await nuevoContexto();
  const seis = conBloques((c) => { c.avisos = Array.from({ length: 6 }, (_, i) => ({ texto: 'Aviso fijo número ' + (i + 1), detalle: 'Detalle ' + (i + 1), orden: i + 1 })); });
  await ctx2.route(rutaConfig, servirConfig(seis));
  const q = await abrir(ctx2, `/${CA}/pantalla.html?tipo=avisos`, 1920, 1080, estadoCA({ tipo: 'novena', avisos: [{ a: 'Del panel', f: '' }, { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }] }));
  await q.waitForSelector('#a-filas .fila');
  await q.waitForTimeout(1200);
  igual(await q.evaluate(() => document.querySelectorAll('#a-filas .fila').length), 6, 'con 6 fijos y 1 del panel se ven 6 filas');
  const fuera = await q.evaluate(() => { const t = document.getElementById('v-avisos').getBoundingClientRect(); return [...document.querySelectorAll('#a-filas .fila')].filter((e) => e.getBoundingClientRect().bottom > t.bottom - 20).length; });
  igual(fuera, 0, 'las 6 filas caben dentro de la tarjeta');
  await captura(q, `1b/${CA}_avisos_6`);
  await ctx.close();
  await ctx2.close();
}

async function casoTiposPropios() {
  console.log('1b · Tipos propios, tipos apagados y galería');
  const ctx = await nuevoContexto();
  const propio = { clave: 'hora-misionera', nombre: 'Hora misionera', descripcion: 'Oración por las misiones de {parroquia}.', titulo: 'HORA MISIONERA', ceja: 'EN HONOR A {patronoCorto}', cursiva: 'Id y anunciad', imagen: 'galeria:galeria-a', esquina: 'fiesta', rotulos: ['persona', 'lectura1', 'oracion'] };
  const g2 = { id: 'galeria-a', src: 'medios/logo-blanco.svg', alt: 'Primera imagen de la galería' };
  const g3 = { id: 'galeria-b', src: 'medios/fachada.svg', alt: 'Segunda imagen de la galería' };
  const v1 = JSON.parse(JSON.stringify(CONFIG[SJ]));
  v1.version = 1;                 // San José de ejemplo ya está en la versión 2: aquí la serie empieza en 1
  delete v1.pantallas;            // las pantallas del ejemplo usan su propia galería, que este caso reemplaza
  v1.galeria = [g2];
  v1.tipos = { apagados: ['horasanta'], propios: [propio] };
  const v2 = Object.assign(JSON.parse(JSON.stringify(v1)), { version: 2, publicado: '2026-11-08T12:00:00Z' });
  v2.galeria = [Object.assign({}, g2, { alt: 'Alt actualizado de la primera imagen' }), g3];   // mismo src, otro alt
  v2.tipos.propios = [propio, { clave: 'silencio', nombre: 'Hora de silencio' }];
  const v3 = Object.assign(JSON.parse(JSON.stringify(v1)), { version: 3, publicado: '2026-11-08T13:00:00Z' });
  v3.tipos = { apagados: ['horasanta'] };   // el propio se borró de la configuración
  let sirve = v1;   // solo San José cambia: Ciudad Arce sigue con su archivo real
  await ctx.route(`**/${SJ}/config.json`, (r) => servirConfig(sirve)(r));
  const panelCA = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
  const panel = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250, (p) => p.clock.install());
  const pant = await abrir(ctx, `/${SJ}/pantalla.html?tipo=inicio`, 1920, 1080);
  await panel.waitForSelector('[data-tipo="hora-misionera"]', { state: 'attached' });
  await panelCA.waitForSelector('[data-tipo="dominical"]', { state: 'attached' });
  const tiposDe = (p) => p.evaluate(() => [...document.querySelectorAll('#tipos [data-tipo]')].map((b) => b.dataset.tipo));
  const imgsDe = (p) => p.evaluate(() => [...document.querySelectorAll('#imagenes [data-imagen]')].map((b) => b.dataset.imagen));
  const tipoGuardado = () => panel.evaluate((k) => JSON.parse(localStorage.getItem(k)).tipo, `pev_${SJ}_estado_v1`);

  let tipos = await tiposDe(panel);
  revisar(tipos.includes('hora-misionera') && !tipos.includes('horasanta'), 'el panel muestra el propio y no muestra Hora Santa (' + tipos.join(', ') + ')');
  igual(tipos[tipos.length - 1], 'hora-misionera', 'el propio va al final de la lista');
  igual(tipos.length, 11, '11 tipos: 10 comunes y 1 propio');
  const botonPropio = await panel.evaluate(() => [...document.querySelectorAll('[data-tipo="hora-misionera"] span')].map((e) => e.textContent).join(' / '));
  igual(botonPropio, 'Hora misionera / Oración por las misiones de Parroquia San José (ejemplo).', 'el botón del propio trae su nombre y su descripción con los huecos rellenos');
  igual((await imgsDe(panel)).join(','), ',patrono,fachada,logo,custodia,santo,galeria:galeria-a', 'IMAGENES suma la imagen de la galería');
  igual((await panel.textContent('[data-imagen="galeria:galeria-a"]')).trim(), 'Primera imagen de la galería', 'la imagen de la galería se llama como su alt');

  // dos parroquias abiertas: los propios de una no aparecen en la otra
  const tiposCA = await tiposDe(panelCA);
  revisar(!tiposCA.includes('hora-misionera') && tiposCA.includes('horasanta') && tiposCA.length === 11, 'Ciudad Arce no ve el propio de San José y conserva Hora Santa (' + tiposCA.join(', ') + ')');
  revisar(!(await imgsDe(panelCA)).some((k) => k.startsWith('galeria:')), 'Ciudad Arce no ve la galería de San José');

  // elegirlo: la pantalla muestra su título, su ceja con los huecos y la imagen de la galería
  await elegirTipo(panel, 'hora-misionera');
  await pant.waitForFunction(() => document.getElementById('i-pildora').textContent === 'HORA MISIONERA', null, { timeout: 5000 }).catch(() => {});
  igual(await texto(pant, '#i-pildora'), 'HORA MISIONERA', 'al elegirlo, la pantalla muestra su título');
  igual((await texto(pant, '#i-ceja')).trim(), 'EN HONOR A SAN JOSÉ', 'la ceja del propio rellena los huecos');
  igual(await pant.getAttribute('#virgen', 'src'), 'medios/logo-blanco.svg', 'la pantalla usa la imagen de la galería del propio');
  igual(await pant.getAttribute('#virgen', 'alt'), 'Primera imagen de la galería', 'con el alt de la galería');
  igual((await imagenesRotas(pant)).length, 0, 'tipo propio: ninguna imagen rota');
  await panel.click('[data-hoja="vivo"]');
  igual(await panel.evaluate(() => document.querySelectorAll('#rotulos [data-rotulo]').length), 3, 'los rótulos del propio salen de sus bases (persona, lectura1, oracion)');
  await captura(pant, `1b/${SJ}_tipo-propio`);

  // la configuración cambia en vivo: se suman tipos e imágenes sin duplicar lo que ya estaba
  sirve = v2;
  await panel.clock.runFor(61000);
  await panel.waitForSelector('[data-tipo="silencio"]', { state: 'attached', timeout: 5000 }).catch(() => {});
  tipos = await tiposDe(panel);
  igual(tipos.length, 12, 'tras el cambio de configuración: 12 tipos, sin repetir (' + tipos.join(', ') + ')');
  igual(new Set(tipos).size, tipos.length, 'ningún tipo repetido');
  igual((await imgsDe(panel)).join(','), ',patrono,fachada,logo,custodia,santo,galeria:galeria-a,galeria:galeria-b', 'la galería se suma una vez cada imagen');
  await pant.waitForTimeout(1500);
  igual(await pant.getAttribute('#virgen', 'alt'), 'Alt actualizado de la primera imagen', 'el alt de la imagen se refresca aunque el src sea el mismo');
  igual(await tipoGuardado(), 'hora-misionera', 'el tipo elegido se conserva');
  igual(await panel.getAttribute('[data-tipo="hora-misionera"]', 'aria-pressed'), 'true', 'y sigue marcado');

  // el propio se borra de la configuración mientras está elegido: cae al primero disponible, sin error
  sirve = v3;
  await panel.clock.runFor(61000);
  await panel.waitForFunction(() => !document.querySelector('[data-tipo="hora-misionera"]'), null, { timeout: 5000 }).catch(() => {});
  tipos = await tiposDe(panel);
  revisar(!tipos.includes('hora-misionera') && tipos.length === 10, 'el propio borrado ya no está en el panel (' + tipos.length + ' tipos)');
  igual(await tipoGuardado(), 'dominical', 'el tipo guardado cae al primero disponible');
  igual(await panel.getAttribute('[data-tipo="dominical"]', 'aria-pressed'), 'true', 'el panel marca el primero disponible');
  await pant.waitForFunction(() => !/MISIONERA/.test(document.getElementById('i-pildora').textContent), null, { timeout: 5000 }).catch(() => {});
  revisar(!/MISIONERA/.test(await texto(pant, '#i-pildora')), 'la pantalla también cae al primero disponible («' + (await texto(pant, '#i-pildora')) + '»)');
  await ctx.close();
}

/* Rediseño: acento, portada de evento con sus ajustes, horarios y redes pedidos a propósito, aviso apagado. */
async function casoPantallasRediseno() {
  console.log('Rediseño · Pantallas con acento, evento, horarios y redes');
  const cfg = JSON.parse(JSON.stringify(CONFIG[SJ]));
  cfg.colores.acento = '#d9a441';
  cfg.pantallas = {
    inicio: { modo: 'personalizada', ocultar: ['cuenta'], mostrar: ['redes'] },
    evento: { modo: 'personalizada', ocultar: ['franja'] },
    avisos: { modo: 'personalizada', mostrar: ['horarios'] },
    gracias: { modo: 'personalizada', mostrar: ['horarios', 'redes'] }
  };
  cfg.horarios = [
    { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }, { hora: '9:00 a. m.', nota: 'Misa con niños' }], lugar: 'Templo parroquial' },
    { dia: 'Jueves', horas: [{ hora: '6:00 p. m.', nota: 'Hora Santa' }] }
  ];
  cfg.avisos = [
    { texto: 'Ensayo del coro', detalle: 'Jueves · 7:00 p. m.', orden: 1 },
    { texto: 'Aviso apagado', detalle: 'No se ve', orden: 2, activo: false }
  ];
  const ctx = await nuevoContexto();
  await ctx.route(`**/${SJ}/config.json`, servirConfig(cfg));
  const estado = (e) => (p) => p.addInitScript(([k, v]) => localStorage.setItem(k, v), [`pev_${SJ}_estado_v1`, JSON.stringify(e)]);
  const textos = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText.replace(/\s+/g, ' ').trim()), sel);

  // Inicio: sin cuenta, con redes; la línea de la franja es el acento
  const ini = await abrir(ctx, `/${SJ}/pantalla.html?tipo=inicio`, 1920, 1080, estado({ tipo: 'dominical', cuenta: true }));
  await ini.waitForTimeout(1500);
  igual(await ini.evaluate(() => getComputedStyle(document.getElementById('i-cuenta')).display), 'none', 'Inicio: la cuenta regresiva se oculta');
  revisar(await visibleEl(ini, '#v-inicio .extra'), 'Inicio: la caja de redes se ve');
  igual((await textos(ini, '#v-inicio .extra .red')).join(' | '), 'FACEBOOK /ParroquiaSanJoseEjemplo | YOUTUBE @ParroquiaSanJoseEjemplo | WHATSAPP 0000-0000', 'Inicio: muestra las redes');
  igual(await ini.evaluate(() => getComputedStyle(document.querySelector('.franja-linea')).backgroundColor), 'rgb(217, 164, 65)', 'la línea de la franja es el acento');
  igual(await ini.evaluate(() => getComputedStyle(document.querySelector('.franja .frase i')).color), 'rgb(217, 164, 65)', 'los adornos del lema son el acento');
  revisar(!(await ini.evaluate(() => document.documentElement.outerHTML.match(/facebook\.com|wa\.me/))), 'Inicio: ninguna URL de redes en el HTML');
  igual((await imagenesRotas(ini)).length, 0, 'Inicio: ninguna imagen rota');
  await captura(ini, 'rediseno_inicio');

  // Portada: el tipo evento usa el bloque evento; patronal, no
  const ev = await abrir(ctx, `/${SJ}/pantalla.html?tipo=portada`, 1920, 1080, estado({ tipo: 'evento', evento: 'Concierto', fecha: '2026-12-20', lugar: 'Atrio' }));
  await ev.waitForTimeout(1200);
  revisar(await ev.evaluate(() => document.getElementById('escenario').classList.contains('oculto-franja')), 'Portada de evento: el escenario lleva oculto-franja');
  const pat = await abrir(ctx, `/${SJ}/pantalla.html?tipo=portada`, 1920, 1080, estado({ tipo: 'patronal' }));
  await pat.waitForTimeout(1200);
  revisar(!(await pat.evaluate(() => document.getElementById('escenario').classList.contains('oculto-franja'))), 'Portada de la fiesta: sin oculto-franja');

  // Avisos: el apagado no está; los horarios van al final
  const av = await abrir(ctx, `/${SJ}/pantalla.html?tipo=avisos`, 1920, 1080, estado({ tipo: 'dominical' }));
  await av.waitForSelector('#a-filas .fila');
  await av.waitForTimeout(1200);
  const filas = await av.evaluate(() => [...document.querySelectorAll('#a-filas .fila')].map((f) => f.querySelector('.a').textContent + ' | ' + f.querySelector('.f').textContent));
  igual(filas[filas.length - 1], 'Jueves · Hora Santa | 6:00 p. m.', 'Avisos: la última fila es la de horarios del jueves');
  revisar(!filas.some((f) => f.includes('Aviso apagado')), 'Avisos: el aviso con activo:false no aparece (' + filas.join(' / ') + ')');
  revisar(!(await visibleEl(av, '#a-redes')), 'Avisos: sin redes en mostrar, no hay redes');
  await captura(av, 'rediseno_avisos');

  // Horarios: varias horas en una fila; lugar y notas en el detalle
  const ho = await abrir(ctx, `/${SJ}/pantalla.html?tipo=horarios`);
  await ho.waitForSelector('#h-filas .fila');
  await ho.waitForTimeout(800);
  igual((await textos(ho, '#h-filas .n'))[0], '7:00 a. m. · 9:00 a. m.', 'Horarios: el domingo muestra sus dos horas');
  igual((await textos(ho, '#h-filas .a'))[0], 'Domingo', 'Horarios: el día');
  igual((await textos(ho, '#h-filas .f'))[0], 'Templo parroquial · Misa con niños', 'Horarios: el lugar y las notas');

  // Gracias: horarios y redes en la caja de abajo
  const gr = await abrir(ctx, `/${SJ}/pantalla.html?tipo=gracias`, 1920, 1080, estado({ tipo: 'dominical' }));
  await gr.waitForTimeout(1500);
  revisar(await visibleEl(gr, '#v-gracias .extra'), 'Gracias: la caja de horarios y redes se ve');
  const extra = await gr.evaluate(() => document.querySelector('#v-gracias .extra').textContent);   // textContent: sin las mayúsculas del CSS
  revisar(extra.includes('Domingo') && extra.includes('7:00 a. m. · 9:00 a. m.') && extra.includes('Jueves · Hora Santa') && extra.includes('6:00 p. m.'), 'Gracias: trae los horarios (' + extra + ')');
  revisar(extra.includes('/ParroquiaSanJoseEjemplo') && extra.includes('0000-0000'), 'Gracias: trae las redes');
  const pisa = await gr.evaluate(() => {
    const e = document.querySelector('#v-gracias .extra');
    if (!e) return true;
    return e.getBoundingClientRect().bottom > document.querySelector('.franja-linea').getBoundingClientRect().top;
  });
  revisar(!pisa, 'Gracias: la caja no pisa la franja');
  igual((await imagenesRotas(gr)).length, 0, 'Gracias: ninguna imagen rota');
  await captura(gr, 'rediseno_gracias');
  await ctx.close();

  // Avisos con redes pedidas: van debajo de las filas, dentro de la tarjeta
  const cfg2 = JSON.parse(JSON.stringify(cfg));
  cfg2.pantallas.avisos.mostrar = ['horarios', 'redes'];
  cfg2.avisos = Array.from({ length: 5 }, (_, i) => ({ texto: 'Aviso fijo número ' + (i + 1), detalle: 'Detalle ' + (i + 1), orden: i + 1 }));   // el peor caso: 6 filas y redes
  const ctx2 = await nuevoContexto();
  await ctx2.route(`**/${SJ}/config.json`, servirConfig(cfg2));
  const av2 = await abrir(ctx2, `/${SJ}/pantalla.html?tipo=avisos`, 1920, 1080, estado({ tipo: 'dominical' }));
  await av2.waitForSelector('#a-filas .fila');
  await av2.waitForTimeout(1200);
  igual((await textos(av2, '#a-redes .red')).join(' | '), 'FACEBOOK /ParroquiaSanJoseEjemplo | YOUTUBE @ParroquiaSanJoseEjemplo | WHATSAPP 0000-0000', 'Avisos: con mostrar redes, las redes se ven');
  const fueraAv = await av2.evaluate(() => { const t = document.getElementById('v-avisos').getBoundingClientRect(); return [...document.querySelectorAll('#a-filas .fila, #a-redes .red')].filter((e) => e.getBoundingClientRect().bottom > t.bottom - 20).length; });
  igual(fueraAv, 0, 'Avisos: 6 filas y las redes caben en la tarjeta');
  await captura(av2, 'rediseno_avisos_redes');
  await ctx2.close();
}

async function casoRotulosRediseno() {
  console.log('Rediseño · Rótulos, capa EN VIVO y producción');
  const ACENTO = 'rgb(217, 164, 65)';
  const cfg = conBloques((c) => {
    c.colores.acento = '#d9a441';
    c.rotulos = { tipografia: 'lora', esquinas: 'suaves', colorLado: 'blanco', colorLinea: 'acento', logoEsquina: false };
    c.pantallas = {
      envivo: { modo: 'personalizada', ocultar: ['envivo'], textos: { capa_logo: 'Pastoral' } },
      produccion: { modo: 'personalizada', ocultar: ['marca'], textos: { prod_ceja: 'UN TRABAJO DE', prod_nombre: 'Pastoral' } }
    };
  });
  const ctx = await nuevoContexto();
  await ctx.route(rutaConfig, servirConfig(cfg));
  const r = await abrir(ctx, `/${CA}/rotulos.html`, 1920, 1080, estadoCA({ tipo: 'semana', rotulo: 'persona', celebrante: 'Pbro. José Martínez', mostrarLogo: true, mostrarEnVivo: true }));
  await r.waitForSelector('#rotulo.en');
  await r.waitForTimeout(1500);
  const m = await r.evaluate(async () => {
    await document.fonts.ready;
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    return {
      familia: cs('#r-t').fontFamily,
      chequeo: document.fonts.check('700 52px Lora'),
      cargada: [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Lora' && f.status === 'loaded'),
      fuentes: [...document.fonts].filter((f) => /Lora/.test(f.family)).map((f) => f.family + ' ' + f.weight + ' ' + f.status).join(' / '),
      radio: cs('#rotulo').borderRadius,
      linea: cs('#rotulo .cuerpo').borderTopColor,
      lado: cs('#rotulo .lado').backgroundColor,
      ladoLogo: document.getElementById('lado-logo').getAttribute('src'),
      logoOculto: document.getElementById('logo').classList.contains('oculto'),
      envivoOculto: document.getElementById('envivo').classList.contains('oculto'),
      logoTxt: document.getElementById('logo-txt').textContent,
      clases: [...document.getElementById('escenario').classList].filter((x) => /^(tipo-|esquinas-)/.test(x)).sort().join(' ')
    };
  });
  revisar(/^"?Lora"?/.test(m.familia), 'rótulo: la font-family del nombre empieza con Lora (' + m.familia + ')');
  revisar(m.chequeo && m.cargada, 'rótulo: la fuente Lora 700 está cargada (check ' + m.chequeo + ', ' + m.fuentes + ')');
  igual(m.clases, 'tipo-lora', 'rótulo: clase de tipografía en el escenario (suaves es el defecto y no pone clase)');
  igual(m.radio, '24px', 'rótulo: esquinas suaves (24px, F6:24)');
  igual(m.linea, ACENTO, 'rótulo: la línea del cuerpo es el acento');
  igual(m.lado, 'rgb(255, 255, 255)', 'rótulo: el lado es blanco');
  igual(m.ladoLogo, 'medios/logo-color.png', 'rótulo: con el lado claro, el logo del lado es el de color');
  revisar(m.logoOculto, 'capa: con rótulo, la capa del logo se aparta');
  revisar(await r.evaluate(() => document.getElementById('logo-esquina').classList.contains('oculto')), 'capa: sin logoEsquina, tampoco hay logo de esquina');
  revisar(m.envivoOculto, 'capa: el EN VIVO se oculta (pantallas.envivo.ocultar)');
  igual(m.logoTxt, 'Pastoral', 'capa: el texto del logo sale de pantallas.envivo.textos');
  igual((await imagenesRotas(r)).length, 0, 'rótulos: ninguna imagen rota');
  await captura(r, 'rediseno_rotulo');

  // Sin rótulo vuelve el logo de la capa; el EN VIVO sigue oculto
  await r.evaluate(() => pintar(Object.assign({}, estado, { rotulo: 'ninguno' })));
  await r.waitForTimeout(600);
  revisar(!(await r.evaluate(() => document.getElementById('logo').classList.contains('oculto'))), 'capa: sin rótulo, el logo vuelve');
  revisar(await r.evaluate(() => document.getElementById('envivo').classList.contains('oculto')), 'capa: sin rótulo, el EN VIVO sigue oculto');

  // Source Sans y vuelta a lo de siempre
  await r.evaluate(() => { PARROQUIA = Object.assign({}, PARROQUIA, { rotulos: { tipografia: 'source-sans' } }); aplicarParroquia(PARROQUIA); });
  const ss = await r.evaluate(() => ({
    familia: getComputedStyle(document.getElementById('r-t')).fontFamily,
    clases: [...document.getElementById('escenario').classList].filter((x) => /^(tipo-|esquinas-)/.test(x)).join(' '),
    ladoLogo: document.getElementById('lado-logo').getAttribute('src')
  }));
  revisar(/^"?SourceSans"?/.test(ss.familia), 'rótulo: con source-sans, la font-family empieza con SourceSans (' + ss.familia + ')');
  igual(ss.clases, 'tipo-source-sans', 'rótulo: se quita tipo-lora y no aparece ninguna clase de esquinas');
  igual(ss.ladoLogo, 'medios/logo-blanco.png', 'rótulo: sin lado claro, el logo del lado vuelve a ser el blanco');
  await r.evaluate(() => { PARROQUIA = Object.assign({}, PARROQUIA, { rotulos: undefined, colores: { principal: '#1155a4', oscuro: '#0c3562' } }); aplicarParroquia(PARROQUIA); });
  const sin = await r.evaluate(() => ({
    clases: [...document.getElementById('escenario').classList].filter((x) => /^(tipo-|esquinas-)/.test(x)).join(' '),
    linea: document.getElementById('escenario').style.getPropertyValue('--linea')
  }));
  igual(sin.clases, '', 'sin bloque ni acento: ninguna clase nueva');
  igual(sin.linea, '', 'sin bloque ni acento: --linea vacía');

  // Producción: textos y marca de pantallas.produccion
  for (const estilo of ['azul', 'claro']) {
    const p = await abrir(ctx, `/${CA}/produccion.html?estilo=${estilo}`, 1280, 800);
    await p.waitForTimeout(800);
    const pr = await p.evaluate(() => ({
      ceja: document.querySelector('.lamina [data-texto]').textContent,
      grande: document.querySelector('.lamina .grande').textContent,
      logo: document.querySelector('.lamina img').hidden
    }));
    igual(pr.ceja, 'UN TRABAJO DE', 'producción ' + estilo + ': la ceja sale de prod_ceja');
    igual(pr.grande, 'Pastoral', 'producción ' + estilo + ': el nombre sale de prod_nombre');
    revisar(pr.logo, 'producción ' + estilo + ': con ocultar marca, el logo no se ve');
    await captura(p, 'rediseno_produccion_' + estilo);
  }
  await ctx.close();
}

async function casoPanelNeutroConservaPropio() {
  console.log('1b · Panel con configuración neutra al arrancar conserva el tipo propio');
  const ctx = await nuevoContexto();
  let bloquear = true;
  await ctx.route(`**/${SJ}/config.json`, (r) => (bloquear ? r.abort() : r.continue()));
  const clave = `pev_${SJ}_estado_v1`;
  const panel = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250, async (p) => {
    await p.clock.install();
    await p.addInitScript(([k, v]) => localStorage.setItem(k, v), [clave, JSON.stringify({ tipo: 'misa-de-ninos', imagen: 'galeria:taller' })]);
  });
  await panel.waitForSelector('#aviso-config:not([hidden])');
  const guardado = () => panel.evaluate((k) => { const e = JSON.parse(localStorage.getItem(k)); return e.tipo + '|' + e.imagen; }, clave);
  igual(await guardado(), 'misa-de-ninos|galeria:taller', 'sin configuración: el estado guardado conserva el tipo propio y su imagen');
  bloquear = false;
  await panel.clock.runFor(61000);
  await panel.waitForSelector('[data-tipo="misa-de-ninos"]', { state: 'attached', timeout: 5000 }).catch(() => {});
  igual(await panel.getAttribute('[data-tipo="misa-de-ninos"]', 'aria-pressed'), 'true', 'al llegar la configuración, el panel muestra el propio elegido');
  igual(await guardado(), 'misa-de-ninos|galeria:taller', 'y el estado sigue siendo el propio');
  await ctx.close();
}

async function casoPlaceholdersTextos() {
  console.log('1b · Los placeholders de Textos muestran lo que sale al aire');
  const ctx = await nuevoContexto();
  const panel = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250);
  await panel.waitForSelector('[data-tipo="misa-de-ninos"]', { state: 'attached' });
  const ph = (k) => panel.evaluate((c) => document.querySelector(`[data-texto="${c}"]`).placeholder, k);
  igual(await ph('avisos_titulo'), 'Avisos de la semana', 'avisos_titulo: el de la configuración');
  igual(await ph('gracias_titulo'), '¡Dios les bendiga!', 'gracias_titulo: el de la configuración');
  revisar(/^Bienvenidos a Parroquia San José/.test(await ph('inicio_cursiva')), 'inicio_cursiva: con el hueco {parroquia} rellenado');
  igual(await ph('horarios_titulo'), 'Misas en San José', 'horarios_titulo existe en el panel y muestra el de la configuración');
  const auto = await panel.evaluate(() => textosBase(s).inicio_titulo);
  igual(await ph('inicio_titulo'), auto, 'sin texto en la configuración: el automático');
  await ctx.close();
}

/* Etapa 2a · Vista previa: una página padre del mismo origen (como el editor) con la pantalla en un iframe. */
async function casoVistaPrevia() {
  console.log('2a · Vista previa dentro de un iframe del mismo origen');
  const ctx = await nuevoContexto();
  const pedidosConfig = [];
  await ctx.route(/\/config\.json(\?|$)/, (r) => { pedidosConfig.push(r.request().url()); return r.abort(); });
  await ctx.route(base + '/padre-de-prueba.html', (r) => r.fulfill({
    status: 200, contentType: 'text/html',
    body: `<!doctype html><title>padre</title><iframe id="vp" title="Vista previa: inicio" width="480" height="270" src="/${CA}/pantalla.html?tipo=inicio&vista-previa=1"></iframe>`
  }));
  const padre = await ctx.newPage();
  padre.on('pageerror', (e) => errores.push('padre: ' + e.message));
  await padre.goto(base + '/padre-de-prueba.html');
  const marco = padre.frameLocator('#vp');
  await marco.locator('#marca').waitFor({ state: 'attached' });
  await padre.evaluate(() => {
    const f = document.getElementById('vp');
    f.contentWindow.postMessage({ tipo: 'pev-vista-previa', config: { nombre: 'Parroquia de Prueba', lugar: 'Lugar de Prueba', colores: { principal: '#7a3b12', oscuro: '#4a2008' } } }, location.origin);
  });
  await padre.waitForFunction(() => document.getElementById('vp').contentDocument.body.innerText.includes('Parroquia de Prueba'));
  revisar(true, 'el iframe muestra el nombre que manda el padre');
  igual(await padre.evaluate(() => getComputedStyle(document.getElementById('vp').contentDocument.documentElement).getPropertyValue('--rey').trim()), '#7a3b12', 'el iframe usa el color mandado');
  const clavesFrame = await padre.evaluate(() => Object.keys(localStorage));   // mismo origen: el almacenamiento es el mismo
  revisar(!clavesFrame.some((k) => k.startsWith('pev_' + CA + '_')), 'localStorage no tiene ninguna clave pev_' + CA + '_ (' + clavesFrame.join(', ') + ')');
  revisar(clavesFrame.every((k) => !k.startsWith('pev_') || k.startsWith('pev_vistaprevia_')), 'las claves de la vista previa llevan pev_vistaprevia_');

  // Un mensaje de otro tipo se ignora
  await padre.evaluate(() => document.getElementById('vp').contentWindow.postMessage({ tipo: 'otra-cosa', config: { nombre: 'Intruso' } }, location.origin));
  await padre.waitForTimeout(300);
  revisar(!(await padre.evaluate(() => document.getElementById('vp').contentDocument.body.innerText)).includes('Intruso'), 'un mensaje de otro tipo no cambia nada');

  igual(pedidosConfig.length, 0, 'no hubo pedido a config.json (' + pedidosConfig.join(', ') + ')');
  await ctx.close();
}

async function casoSanJoseCompleto() {
  console.log('1b · San José completo (las 5 vistas, rótulos y panel)');
  const ctx = await nuevoContexto();
  const estadoSJ = (estado) => (p) => p.addInitScript(([k, v]) => localStorage.setItem(k, v), [`pev_${SJ}_estado_v1`, JSON.stringify(estado)]);
  const AJENO = /Inmaculada|Ciudad Arce|diciembre/i;
  const cfg = CONFIG[SJ];
  const vistas = [
    ['inicio', 'inicio', { tipo: 'misa-de-ninos' }],
    ['portada', 'portada', { tipo: 'patronal' }],
    ['gracias', 'gracias', { tipo: 'novena' }],
    ['avisos', 'avisos', { tipo: 'novena', avisos: [{ a: 'Aviso del panel', f: 'Detalle del panel' }, { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }] }],
    ['horarios', 'horarios', { tipo: 'novena' }]
  ];
  for (const [nombre, tipo, estado] of vistas) {
    const p = await abrir(ctx, `/${SJ}/pantalla.html?tipo=${tipo}`, 1920, 1080, estadoSJ(estado));
    await p.waitForTimeout(1800);
    const cuerpo = await p.innerText('body');
    revisar(cuerpo.trim() !== '' && !AJENO.test(cuerpo), 'San José · ' + nombre + ': tiene texto y ninguno de Ciudad Arce');
    igual((await imagenesRotas(p)).length, 0, 'San José · ' + nombre + ': ninguna imagen rota');
    await captura(p, `1b/${SJ}_${nombre}`);
    if (nombre === 'inicio') {
      igual(await texto(p, '#i-pildora'), 'MISA DE NIÑOS', 'inicio: el tipo propio de la configuración se ve');
      igual(await p.getAttribute('#virgen', 'src'), 'medios/taller.svg', 'inicio: la imagen es la de la galería');
      revisar(!(await visibleEl(p, '#chispas')), 'inicio: sin chispas');
      revisar(/Bienvenidos a Parroquia San José/.test(await texto(p, '#i-cursiva')), 'inicio: el texto de la configuración rellena {parroquia}');
    }
    if (nombre === 'avisos') {
      const a = await p.evaluate(() => [...document.querySelectorAll('#a-filas .fila .a')].map((e) => e.textContent));
      igual(a.join(' | '), 'Ensayo del coro | Colecta para el techo del salón | Aviso del panel', 'avisos: fijos vigentes primero y después el del panel');
    }
    if (nombre === 'horarios') {
      igual(await p.evaluate(() => document.querySelectorAll('#h-filas .fila').length), cfg.horarios.length, 'horarios: una fila por horario');
      igual(await p.evaluate(() => document.querySelectorAll('#h-redes .red').length), cfg.redes.length, 'horarios: una línea por red');
      revisar(!/https?:|facebook\.com|youtube\.com|wa\.me/i.test(cuerpo), 'horarios: ninguna URL en pantalla');
    }
    await p.close();
  }
  const r = await abrir(ctx, `/${SJ}/rotulos.html`, 1920, 1080, estadoSJ({ tipo: 'misa-de-ninos', rotulo: 'persona', datos: {} }));
  await r.waitForSelector('#rotulo.en', { timeout: 5000 }).catch(() => {});
  await r.waitForTimeout(1200);
  const cr = await r.innerText('body');
  revisar(!AJENO.test(cr), 'San José · rótulos: ningún texto de Ciudad Arce');
  igual((await imagenesRotas(r)).length, 0, 'San José · rótulos: ninguna imagen rota');
  igual(await r.evaluate(() => getComputedStyle(document.getElementById('rotulo')).borderRadius), '0px', 'rótulos: esquinas rectas');
  await captura(r, `1b/${SJ}_rotulos`);
  const panel = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250, estadoSJ({ tipo: 'misa-de-ninos' }));
  await panel.waitForSelector('[data-tipo="misa-de-ninos"]', { state: 'attached' });
  await panel.waitForTimeout(600);
  const cp = await panel.innerText('body');
  revisar(!AJENO.test(cp), 'San José · panel: ningún texto de Ciudad Arce');
  igual((await imagenesRotas(panel)).length, 0, 'San José · panel: ninguna imagen rota');
  const tp = await panel.evaluate(() => [...document.querySelectorAll('#tipos [data-tipo]')].map((b) => b.dataset.tipo));
  revisar(tp.includes('misa-de-ninos') && !tp.includes('procesion'), 'panel: tipo propio presente y Procesión apagada (' + tp.length + ' tipos)');
  igual(await panel.evaluate(() => [...document.querySelectorAll('#cargos option')].map((o) => o.value).join(',')), cfg.rotulos.cargos.join(','), 'panel: los cargos son los de la configuración');
  await captura(panel, `1b/${SJ}_panel`);
  await ctx.close();
}

/* ---------- Comparación Ciudad Arce vicaria/ vs obs/ ---------- */

const urlObs = (archivo) => 'file://' + path.join(__dirname, '..', '..', 'obs', archivo).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
const CONGELAR = '*,*::before,*::after{animation:none!important;transition:none!important}#chispas{display:none!important}';

async function tomar(ctx, url, estado, claveEstado, ancho, alto, sel) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: ancho, height: alto });
  if (estado) await p.addInitScript(([k, v]) => localStorage.setItem(k, v), [claveEstado, JSON.stringify(estado)]);
  await p.goto(url);
  await p.waitForTimeout(1800);
  await p.addStyleTag({ content: CONGELAR });
  await p.waitForTimeout(300);
  const png = await p.screenshot();
  await p.close();
  return png;
}

/* Compara dos PNG con un canvas: porcentaje de píxeles distintos (>16 por canal) y caja que los contiene. */
async function diferencia(aux, a, b) {
  return aux.evaluate(async ([x, y]) => {
    const cargar = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
    const [ia, ib] = await Promise.all([cargar(x), cargar(y)]);
    const datos = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const da = datos(ia), db = datos(ib);
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let k = 0; k < da.data.length; k += 4) {
      if (Math.abs(da.data[k] - db.data[k]) > 16 || Math.abs(da.data[k + 1] - db.data[k + 1]) > 16 || Math.abs(da.data[k + 2] - db.data[k + 2]) > 16) {
        n++;
        const px = (k / 4) % da.width, py = Math.floor(k / 4 / da.width);
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
    }
    return { pct: +(100 * n / (da.width * da.height)).toFixed(2), caja: n ? [x0, y0, x1, y1] : null };
  }, [a.toString('base64'), b.toString('base64')]);
}

async function comparacion() {
  console.log('Comparación Ciudad Arce: vicaria/ vs obs/');
  const aux = await (await nuevoContexto()).newPage();
  const casos = [
    ['inicio_novena', 'pantalla.html?tipo=inicio', { tipo: 'novena' }, 1920, 1080],
    ['inicio_dominical', 'pantalla.html?tipo=inicio', { tipo: 'dominical' }, 1920, 1080],
    ['inicio_patronal', 'pantalla.html?tipo=inicio', { tipo: 'patronal' }, 1920, 1080],
    ['portada_patronal', 'pantalla.html?tipo=portada', { tipo: 'patronal' }, 1920, 1080],
    ['gracias_novena', 'pantalla.html?tipo=gracias', { tipo: 'novena' }, 1920, 1080],
    ['avisos', 'pantalla.html?tipo=avisos', { tipo: 'novena' }, 1920, 1080],
    ['rotulos_semana', 'rotulos.html', { tipo: 'semana' }, 1920, 1080],
    ['rotulos_novena', 'rotulos.html', { tipo: 'novena' }, 1920, 1080],
    ['inicio_800x600', 'pantalla.html?tipo=inicio', { tipo: 'novena' }, 800, 600]
  ];
  const resultados = {};
  for (const [nombre, pagina, estado, w, h] of casos) {
    const ctxO = await nuevoContexto();
    const ctxV = await nuevoContexto();
    const pngO = await tomar(ctxO, urlObs(pagina), estado, 'parroquia_obs_estado_v1', w, h);
    const pngV = await tomar(ctxV, base + '/' + CA + '/' + pagina, estado, `pev_${CA}_estado_v1`, w, h);
    fs.writeFileSync(path.join(CAPTURAS, 'comparacion', nombre + '_obs.png'), pngO);
    fs.writeFileSync(path.join(CAPTURAS, 'comparacion', nombre + '_vicaria.png'), pngV);
    const d = await diferencia(aux, pngO, pngV);
    resultados[nombre] = d;
    console.log(`  ${nombre}: ${d.pct}% de píxeles distintos` + (d.caja ? ' · caja ' + d.caja.join(',') : ''));
    await ctxO.close();
    await ctxV.close();
  }
  return resultados;
}


/* ---------- Línea base de compatibilidad ---------- */

/* Rediseño · Panel: nombre corto de los tipos, rótulos ocultados por ajuste, portada de evento del propio y nombre de la galería. */
async function casoPanelRediseno() {
  console.log('Rediseño · Panel con nombres cortos, ajustes y nombres de galería');
  const ctx = await nuevoContexto();
  const cfg = JSON.parse(JSON.stringify(CONFIG[SJ]));
  cfg.galeria = (cfg.galeria || []).concat([{ id: 'custodia-dorada', src: 'medios/logo-blanco.svg', alt: 'Custodia sobre el altar', nombre: 'Custodia dorada' }]);
  cfg.tipos = Object.assign({}, cfg.tipos, {
    ajustes: { horasanta: { nombrePanel: 'Adoración', ocultarRotulos: ['bendicion'] } },
    propios: ((cfg.tipos && cfg.tipos.propios) || []).concat([{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora', nombrePanel: 'Rosario', portada: 'evento', rotulos: ['persona', 'rosario'] }])
  });
  await ctx.route(`**/${SJ}/config.json`, (r) => servirConfig(cfg)(r));
  const panel = await abrir(ctx, `/${SJ}/panel.html`, 360, 1250);
  await panel.waitForSelector('[data-tipo="rosario-aurora"]', { state: 'attached' });
  const nombreBoton = (clave) => panel.evaluate((k) => document.querySelector(`[data-tipo="${k}"] .nom`).textContent, clave);
  igual(await nombreBoton('horasanta'), 'Adoración', 'el botón de Hora Santa usa el nombre corto del ajuste');
  igual(await nombreBoton('rosario-aurora'), 'Rosario', 'el botón del propio usa su nombre corto');
  igual(await nombreBoton('dominical'), 'Misa dominical', 'un tipo sin ajuste conserva su nombre');

  await elegirTipo(panel, 'horasanta');
  await panel.click('[data-hoja="vivo"]');
  const rotulos = () => panel.evaluate(() => [...document.querySelectorAll('#rotulos [data-rotulo]')].map((b) => b.dataset.rotulo));
  let ids = await rotulos();
  revisar(ids.length > 0 && !ids.includes('bendicion'), 'Hora Santa sin el control de Bendición (' + ids.join(', ') + ')');

  await elegirTipo(panel, 'rosario-aurora');
  const visibles = await panel.evaluate(() => ['evento', 'fecha', 'lugar', 'sector', 'santo'].filter((d) => !document.getElementById('caja-' + d).hidden));
  igual(visibles.join(','), 'evento,fecha,lugar', 'el propio con portada de evento pide evento, fecha y lugar');
  await panel.click('[data-hoja="vivo"]');
  ids = await rotulos();
  igual(ids.join(','), 'persona,rosario', 'los rótulos del propio');

  await panel.click('[data-hoja="preparar"]');
  igual((await panel.textContent('[data-imagen="galeria:custodia-dorada"]')).trim(), 'Custodia dorada', 'el selector de imagen ofrece el nombre de la galería');
  await ctx.close();
}

/* Rediseño · Vista previa con estado: el editor manda también el tipo y el rótulo al aire. */
async function casoVistaPreviaEstado() {
  console.log('Rediseño · Vista previa con estado mandado por mensaje');
  const ctx = await nuevoContexto();
  const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`, 1280, 800);
  const config = { nombre: 'Parroquia de Prueba', lugar: 'Lugar de Prueba', colores: { principal: '#7a3b12', oscuro: '#4a2008' } };
  const conIframe = async (src, estado, listo) => {
    await p.evaluate((s) => {
      const viejo = document.getElementById('vp'); if (viejo) viejo.remove();
      const f = document.createElement('iframe'); f.id = 'vp'; f.title = 'Vista previa'; f.width = 480; f.height = 270; f.src = s;
      document.body.append(f);
    }, src);
    await p.waitForFunction(() => { const d = document.getElementById('vp').contentDocument; return d && d.readyState === 'complete' && typeof d.defaultView.leerEstado === 'function'; });
    await p.evaluate(([c, e]) => document.getElementById('vp').contentWindow.postMessage({ tipo: 'pev-vista-previa', config: c, estado: e }, location.origin), [config, estado]);
    await p.waitForFunction(listo, null, { timeout: 5000 }).catch(() => {});
  };
  await conIframe(`/${CA}/rotulos.html?vista-previa=1`, { rotulo: 'persona', celebrante: 'P. Juan Pérez' },
    () => (document.getElementById('vp').contentDocument.getElementById('r-t') || {}).textContent === 'P. Juan Pérez');
  igual(await p.evaluate(() => document.getElementById('vp').contentDocument.getElementById('r-t').textContent), 'P. Juan Pérez', 'rótulos: #r-t muestra el celebrante mandado');
  await conIframe(`/${CA}/pantalla.html?tipo=inicio&vista-previa=1`, { tipo: 'horasanta' },
    () => document.getElementById('vp').contentDocument.getElementById('i-pildora').textContent === 'HORA SANTA');
  igual(await p.evaluate(() => document.getElementById('vp').contentDocument.getElementById('i-pildora').textContent), 'HORA SANTA', 'pantalla: #i-pildora muestra el tipo mandado');
  const guardadas = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pev_vistaprevia_') && k.endsWith('_estado_v1')));
  igual(guardadas.length, 0, 'el estado de la vista previa no se guarda en localStorage (' + guardadas.join(', ') + ')');
  await ctx.close();
}

/* Revisión final del rediseño: los seis hallazgos confirmados, cada uno con el peor caso que acepta validarConfig
   (12 horarios, 6 horas por día, 6 redes, 6 filas de avisos). Mide en 1920×1080 (escala 1). */
async function casoRevisionFinal() {
  console.log('Rediseño · Revisión final: peores casos que acepta la validación');
  const estado = (e) => (p) => p.addInitScript(([k, v]) => localStorage.setItem(k, v), [`pev_${SJ}_estado_v1`, JSON.stringify(e)]);
  const copia = () => JSON.parse(JSON.stringify(CONFIG[SJ]));
  const valida = async (p, cfg, nombre) => {
    const r = await p.evaluate((c) => validarConfig(c), cfg);
    revisar(r.ok, nombre + ': la configuración pasa validarConfig' + (r.ok ? '' : ' (' + r.errores.join(' / ') + ')'));
  };
  const conConfig = async (cfg, ruta, e) => {
    const ctx = await nuevoContexto();
    await ctx.route(`**/${SJ}/config.json`, servirConfig(cfg));
    const p = await abrir(ctx, ruta, 1920, 1080, e ? estado(e) : undefined);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1800);
    return { ctx, p };
  };
  const HORAS = ['6:00 a. m.', '7:00 a. m.', '9:00 a. m.', '11:00 a. m.', '5:00 p. m.', '6:00 p. m.'];
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const REDES6 = [
    { red: 'facebook', url: 'https://www.facebook.com/parroquia.san.jose.ejemplo', texto: '/ParroquiaSanJoseEjemplo' },
    { red: 'youtube', url: 'https://www.youtube.com/@parroquia-san-jose-ejemplo', texto: '@ParroquiaSanJoseEjemplo' },
    { red: 'instagram', url: 'https://www.instagram.com/parroquiasanjose', texto: '@parroquiasanjose' },
    { red: 'whatsapp', url: 'https://wa.me/50370000000', texto: '7000-0000' },
    { red: 'web', url: 'https://parroquiasanjose.org', texto: 'parroquiasanjose.org' },
    { red: 'facebook', url: 'https://www.facebook.com/pastoral.juvenil.san.jose', texto: '/PastoralJuvenilSanJose' }
  ];

  // 1. Portada de evento sin bloque pantallas.evento: usa el bloque portada, como antes del rediseño
  {
    const cfg = copia();
    cfg.pantallas = Object.assign({}, cfg.pantallas, { portada: { modo: 'personalizada', fondo: { tipo: 'color', color: '#224466' }, ocultar: ['marca', 'franja'], textos: { franja: 'Lema de portada' } } });
    delete cfg.pantallas.evento;
    const { ctx, p } = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=portada`, { tipo: 'evento' });
    await valida(p, cfg, 'Portada de evento sin bloque evento');
    const clases = await p.evaluate(() => [...document.getElementById('escenario').classList].sort().join(' '));
    igual(clases, 'escenario fondo-color oculto-franja oculto-marca', 'Portada de evento sin bloque evento: fondo y ocultos del bloque portada');
    igual(await texto(p, '#frase'), 'Lema de portada', 'Portada de evento sin bloque evento: el lema del bloque portada');
    await ctx.close();
  }

  // 2 y 3. Gracias con 12 horarios (2 horas y notas cada uno) y 5 o 6 redes: ni pisa la franja ni saca el título del cuadro
  for (const nRedes of [5, 6]) {
    const cfg = copia();
    cfg.pantallas = Object.assign({}, cfg.pantallas, { gracias: { modo: 'personalizada', mostrar: ['horarios', 'redes'] } });
    cfg.horarios = Array.from({ length: 12 }, (_, i) => ({ dia: DIAS[i % 7], horas: [{ hora: HORAS[i % 6], nota: 'Misa con niños' }, { hora: HORAS[(i + 2) % 6], nota: 'Misa solemne' }] }));
    cfg.redes = REDES6.slice(0, nRedes);
    const { ctx, p } = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=gracias`, { tipo: 'dominical' });
    await valida(p, cfg, 'Gracias con 12 horarios y ' + nRedes + ' redes');
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const hijos = [...document.getElementById('v-gracias').children].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect());
      return {
        extraAbajo: r('#v-gracias .extra').bottom, franja: r('.franja-linea').top,
        arriba: Math.min(...hijos.map((h) => h.top)), pildora: r('#g-pildora').top, titulo: r('#g-titulo').top,
        filas: document.querySelectorAll('#v-gracias .extra .hora').length, redes: document.querySelectorAll('#v-gracias .extra .red').length
      };
    });
    const nombre = 'Gracias (12 horarios, ' + nRedes + ' redes)';
    revisar(m.extraAbajo <= m.franja, nombre + ': la caja no pisa la franja (abajo ' + Math.round(m.extraAbajo) + ', franja ' + m.franja + ')');
    revisar(m.arriba >= 0 && m.pildora >= 0 && m.titulo >= 0, nombre + ': la píldora y el título quedan dentro del cuadro (arriba ' + Math.round(m.arriba) + ')');
    revisar(m.filas >= 1 && m.filas <= 6, nombre + ': muestra de 1 a 6 horarios (' + m.filas + ')');
    igual(m.redes, nRedes, nombre + ': muestra todas las redes');
    await captura(p, 'revision_gracias_' + nRedes + '_redes');
    await ctx.close();
  }

  // 4. Tipo propio con portada de evento: la portada lleva el nombre del evento escrito en el panel
  {
    const cfg = copia();
    cfg.tipos = Object.assign({}, cfg.tipos, { propios: (cfg.tipos.propios || []).concat([{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora', portada: 'evento' }]) });
    const ev = 'Rosario de la aurora · Barrio El Centro';
    const a = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=portada`, { tipo: 'rosario-aurora', evento: ev, fecha: '2026-12-20', lugar: 'Barrio El Centro' });
    await valida(a.p, cfg, 'Propio con portada de evento');
    igual((await texto(a.p, '#p-titulo')).trim(), ev.toUpperCase(), 'Propio con portada de evento: el título es el evento escrito en el panel');
    await a.ctx.close();
    const b = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=portada`, { tipo: 'rosario-aurora', fecha: '2026-12-20' });
    igual((await texto(b.p, '#p-titulo')).trim(), 'ROSARIO DE LA AURORA', 'Propio con portada de evento: sin evento, el título del tipo');
    await b.ctx.close();
  }

  // 5. Horarios: varias horas en un día caben en su píldora y no tapan el día (1, 2, 4 y 6 horas; 4, 6 y 12 filas)
  const medirHorarios = (p) => p.evaluate(() => {
    const t = document.getElementById('v-horarios');
    const fondo = t.getBoundingClientRect().bottom - parseFloat(getComputedStyle(t).paddingBottom);
    return [...document.querySelectorAll('#h-filas .fila')].map((f) => {
      const n = f.querySelector('.n'); const a = f.querySelector('.a');
      const rn = n.getBoundingClientRect(); const ra = a.getBoundingClientRect();
      return {
        dia: a.textContent, horas: n.textContent,
        dentro: n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1,
        noTapa: rn.right <= ra.left + 0.5 && a.scrollWidth <= a.clientWidth + 1,
        enTarjeta: f.getBoundingClientRect().bottom <= fondo + 0.5,
        // el lugar y las notas (.f) quedan dentro de su fila y del cuadro
        fDentro: (() => { const e = f.querySelector('.f'); const r = e.getBoundingClientRect(); return !r.height || (r.bottom <= f.getBoundingClientRect().bottom + 0.5 && r.right <= f.getBoundingClientRect().right + 0.5 && r.bottom <= 1080); })()
      };
    });
  });
  const casosHorarios = [
    { nombre: '4 filas (1, 2, 4 y 6 horas)', horarios: [1, 2, 4, 6].map((k, i) => ({ dia: DIAS[i + 3], horas: HORAS.slice(0, k).map((h) => ({ hora: h })), lugar: i === 1 ? 'Templo parroquial' : undefined })) },
    { nombre: '4 filas de 2 horas', horarios: Array.from({ length: 4 }, (_, i) => ({ dia: DIAS[i + 2], horas: [{ hora: '11:00 a. m.', nota: 'Misa con niños' }, { hora: '11:00 p. m.' }], lugar: 'Templo parroquial' })) },
    { nombre: '4 filas de 6 horas', horarios: Array.from({ length: 4 }, (_, i) => ({ dia: DIAS[i + 2], horas: HORAS.map((h) => ({ hora: h })) })) },
    { nombre: '6 filas de 6 horas', horarios: Array.from({ length: 6 }, (_, i) => ({ dia: DIAS[i], horas: HORAS.map((h) => ({ hora: h, nota: 'Misa' })) })) },
    { nombre: '12 filas de 6 horas', horarios: Array.from({ length: 12 }, (_, i) => ({ dia: DIAS[i % 7], horas: HORAS.map((h) => ({ hora: h })) })) },
    // Ronda 2: notas en todas las horas y lugar, al máximo del validador; y 12 filas con un lugar de largo normal
    { nombre: '4 filas de 6 horas con nota larga y lugar largo', horarios: Array.from({ length: 4 }, () => ({ dia: 'Miércoles de Ceniza', horas: HORAS.map((h) => ({ hora: h, nota: 'Misa con imposición de ceniza' })), lugar: 'Capilla Nuestra Señora de Guadalupe, Cantón El Tránsito' })) },
    { nombre: '12 filas de 6 horas con nota y lugar', horarios: Array.from({ length: 12 }, (_, i) => ({ dia: DIAS[i % 7] + ' (vigilia)', horas: HORAS.map((h) => ({ hora: h, nota: 'Misa' })), lugar: 'Templo parroquial' })), fEsperado: 'Templo parroquial · Misa' },
    { nombre: '6 filas de 6 horas con nota y lugar', horarios: Array.from({ length: 6 }, (_, i) => ({ dia: DIAS[i], horas: HORAS.map((h) => ({ hora: h, nota: 'Misa' })), lugar: 'Capilla del Cantón San Antonio de los Ranchos' })) },
    { nombre: '12 filas de una hora con lugar de 39 letras', horarios: Array.from({ length: 12 }, (_, i) => ({ dia: DIAS[i % 7], horas: [{ hora: HORAS[i % 6] }], lugar: 'Capilla San Antonio de Padua del cantón' })) },
    { nombre: '12 filas de 6 horas, cada hora con otra nota, y lugar largo', horarios: Array.from({ length: 12 }, (_, i) => ({ dia: DIAS[i % 7] + ' (vigilia)', horas: HORAS.map((h, k) => ({ hora: h, nota: ['Misa con niños', 'Misa solemne', 'Confesiones', 'Adoración', 'Misa de sanación', 'Rosario'][k] })), lugar: 'Capilla Nuestra Señora de Guadalupe, Cantón El Tránsito' })) }
  ];
  for (const c of casosHorarios) {
    const cfg = copia();
    cfg.horarios = c.horarios.map((h) => JSON.parse(JSON.stringify(h)));
    const { ctx, p } = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=horarios`);
    await valida(p, cfg, 'Horarios ' + c.nombre);
    const filas = await medirHorarios(p);
    igual(filas.length, c.horarios.length, 'Horarios ' + c.nombre + ': todas las filas');
    const mal = (k) => filas.filter((f) => !f[k]).map((f) => f.dia + ' [' + f.horas + ']').join(' / ');
    revisar(!mal('dentro'), 'Horarios ' + c.nombre + ': las horas caben en la píldora' + (mal('dentro') ? ' (' + mal('dentro') + ')' : ''));
    revisar(!mal('noTapa'), 'Horarios ' + c.nombre + ': la píldora no tapa el día' + (mal('noTapa') ? ' (' + mal('noTapa') + ')' : ''));
    revisar(!mal('enTarjeta'), 'Horarios ' + c.nombre + ': las filas caben en la tarjeta' + (mal('enTarjeta') ? ' (' + mal('enTarjeta') + ')' : ''));
    revisar(!mal('fDentro'), 'Horarios ' + c.nombre + ': el lugar y las notas quedan dentro de su fila' + (mal('fDentro') ? ' (' + mal('fDentro') + ')' : ''));
    const redesFuera = await p.evaluate(() => {
      const t = document.getElementById('v-horarios');
      const fondo = t.getBoundingClientRect().bottom - parseFloat(getComputedStyle(t).paddingBottom);
      return [...document.querySelectorAll('#h-redes .red')].filter((e) => e.getBoundingClientRect().bottom > fondo + 0.5).map((e) => e.textContent);
    });
    revisar(!redesFuera.length, 'Horarios ' + c.nombre + ': las redes caben en la tarjeta' + (redesFuera.length ? ' (fuera: ' + redesFuera.join(' / ') + ')' : ''));
    igual(await p.evaluate(() => document.querySelectorAll('#h-redes .red').length), cfg.redes.length, 'Horarios ' + c.nombre + ': se ven todas las redes');
    igual(filas[0].horas.replace(/\s+/g, ' ').trim(), c.horarios[0].horas.map((h) => h.hora).join(' · '), 'Horarios ' + c.nombre + ': el texto de las horas no cambia');
    if (c.fEsperado) igual(await p.evaluate(() => document.querySelector('#h-filas .fila .f').textContent), c.fEsperado, 'Horarios ' + c.nombre + ': la misma nota en todas las horas se escribe una vez');
    await captura(p, 'revision_horarios_' + (casosHorarios.indexOf(c) + 1));
    await ctx.close();
  }

  // 6. Avisos: 6 filas (2 fijos y 4 de horarios) y 6 redes, todo dentro de la tarjeta
  for (const dist of ['izquierda', 'derecha', 'centro']) {
    const cfg = copia();
    cfg.pantallas = Object.assign({}, cfg.pantallas, { avisos: { modo: 'personalizada', distribucion: dist, mostrar: ['horarios', 'redes'] } });
    cfg.avisos = [{ texto: 'Ensayo del coro', detalle: 'Jueves · 7:00 p. m.', orden: 1 }, { texto: 'Catequesis de primera comunión', detalle: 'Sábado · 9:00 a. m.', orden: 2 }];
    cfg.redes = REDES6;
    const { ctx, p } = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=avisos`, { tipo: 'dominical' });
    await valida(p, cfg, 'Avisos (' + dist + ') con 6 filas y 6 redes');
    const m = await p.evaluate(() => {
      const t = document.getElementById('v-avisos');
      const fondo = t.getBoundingClientRect().bottom - parseFloat(getComputedStyle(t).paddingBottom);
      const fuera = [...document.querySelectorAll('#a-filas .fila, #a-redes .red')].filter((e) => e.getBoundingClientRect().bottom > fondo + 0.5).map((e) => e.textContent);
      return { fuera, filas: document.querySelectorAll('#a-filas .fila').length, redes: document.querySelectorAll('#a-redes .red').length };
    });
    igual(m.filas, 6, 'Avisos (' + dist + '): 6 filas');
    igual(m.redes, 6, 'Avisos (' + dist + '): 6 redes');
    revisar(!m.fuera.length, 'Avisos (' + dist + '): filas y redes caben en la tarjeta' + (m.fuera.length ? ' (fuera: ' + m.fuera.join(' / ') + ')' : ''));
    await captura(p, 'revision_avisos_redes_' + dist);
    await ctx.close();
  }

  // 7. Ronda 2: Avisos que pintar() no compacta (4 filas sin redes, 2 con redes) con texto largo y detalle normal,
  // vacío o de una palabra sin espacios: las filas quedan en la tarjeta y ni el aviso ni el detalle se salen de su caja
  const LARGO = 'Inscripciones para la catequesis de confirmación';
  const casosAvisos = [
    { nombre: '4 avisos largos, detalle normal', n: 4, detalle: 'Sábado · 9:00 a. m.' },
    { nombre: '4 avisos largos, sin detalle', n: 4, detalle: '' },
    // con 420 de detalle el aviso se va a tres líneas y no cabe: la tarjeta compacta la lista (encajarRedesAvisos)
    { nombre: '4 avisos largos, detalle sin espacios', n: 4, detalle: 'parroquiasanjoseejemplo.org/inscripciones', compacta: true },
    { nombre: '2 avisos largos con 6 redes, detalle sin espacios', n: 2, detalle: 'parroquiasanjoseejemplo.org/inscripciones', redes: true }
  ];
  for (const c of casosAvisos) {
    const cfg = copia();
    cfg.pantallas = Object.assign({}, cfg.pantallas, { avisos: { modo: 'personalizada', mostrar: c.redes ? ['redes'] : [] } });
    cfg.avisos = Array.from({ length: c.n }, (_, i) => Object.assign({ texto: LARGO, orden: i + 1 }, c.detalle ? { detalle: c.detalle } : {}));
    if (c.redes) cfg.redes = REDES6;
    const { ctx, p } = await conConfig(cfg, `/${SJ}/pantalla.html?tipo=avisos`, { tipo: 'dominical' });
    const nombre = 'Avisos (' + c.nombre + ')';
    await valida(p, cfg, nombre);
    const m = await p.evaluate(() => {
      const t = document.getElementById('v-avisos'); const rt = t.getBoundingClientRect(); const cs = getComputedStyle(t);
      const fondo = rt.bottom - parseFloat(cs.paddingBottom); const derecha = rt.right - parseFloat(cs.paddingRight);
      const filas = [...document.querySelectorAll('#a-filas .fila')];
      const sale = (e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > e.parentElement.getBoundingClientRect().right + 0.5;
      return {
        compacta: document.getElementById('a-filas').classList.contains('compacta'),
        filas: filas.length,
        fuera: [...document.querySelectorAll('#a-filas .fila, #a-redes .red')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > fondo + 0.5 || r.right > derecha + 0.5; }).length,
        saleA: filas.filter((f) => sale(f.querySelector('.a'))).length,
        saleF: filas.filter((f) => sale(f.querySelector('.f'))).length
      };
    });
    igual(m.compacta, !!c.compacta, nombre + (c.compacta ? ': la lista se compacta para caber' : ': la lista no se compacta'));
    igual(m.filas, c.n, nombre + ': todas las filas');
    igual(m.fuera, 0, nombre + ': filas y redes caben en la tarjeta');
    igual(m.saleA, 0, nombre + ': el aviso no se sale de su fila');
    igual(m.saleF, 0, nombre + ': el detalle no se sale de su fila');
    await captura(p, 'revision_avisos_largos_' + (casosAvisos.indexOf(c) + 1));
    await ctx.close();
  }
}

/* ---------- Diseño (plan 1.1): los artboards F4, F5 y F6 ----------
   configDiseno(slug): la configuración real con lo que dibujan los artboards. San José: lema, acento, pantallas
   «como vienen» y rótulos Lora con esquinas suaves y línea del acento (sin colorLado: la vista previa de F6 pinta el
   lado con el degradado rey→oscuro). Ciudad Arce: pantallas «como vienen» y rótulos Lora suaves.
   El reloj queda fijo a 5 días de la fiesta, como la cuenta del artboard: San José el domingo 14 de marzo de 2027
   (fiesta el 19), Ciudad Arce el jueves 3 de diciembre de 2026 (fiesta el 8). */
const FECHA_DISENO = { [SJ]: '2027-03-14T10:00:00', [CA]: '2026-12-03T10:00:00' };
function configDiseno(slug) {
  const c = JSON.parse(JSON.stringify(CONFIG[slug]));
  c.pantallas = {};
  if (slug === SJ) {
    c.fiesta = Object.assign({}, c.fiesta, { lema: 'JOSÉ, HOMBRE JUSTO Y FIEL' });
    c.colores = Object.assign({}, c.colores, { acento: '#d9a441' });
    c.rotulos = { tipografia: 'lora', esquinas: 'suaves', colorLinea: 'acento', cargos: CONFIG[SJ].rotulos.cargos.slice() };
    // Avisos con cuatro filas, como F4:31 (los del config real vencen antes de la fecha del caso).
    c.avisos = [
      { texto: 'Ensayo del coro', detalle: 'Jueves · 7:00 p. m.', orden: 1 },
      { texto: 'Catequesis de confirmación', detalle: 'Sábado · 9:00 a. m.', orden: 2 },
      { texto: 'Hora Santa', detalle: 'Jueves · 6:00 p. m.', orden: 3 },
      { texto: 'Colecta para el techo', detalle: 'Domingo · todas las misas', orden: 4 }
    ];
  } else {
    c.rotulos = { tipografia: 'lora', esquinas: 'suaves' };
  }
  return c;
}
/* Abre `ruta` de `slug` a 1920×1080 con la configuración `cfg` (por defecto configDiseno), el estado y el reloj
   fijo; comprueba que la configuración pase validarConfig, espera las fuentes y congela las animaciones.
   Devuelve { ctx, p }. */
async function abrirDiseno(slug, ruta, estado, opciones = {}) {
  const cfg = opciones.cfg || configDiseno(slug);
  const fecha = opciones.fecha || FECHA_DISENO[slug];
  const ctx = await nuevoContexto();
  await ctx.route(`**/${slug}/config.json`, servirConfig(cfg));
  const p = await abrir(ctx, `/${slug}/${ruta}`, 1920, 1080, async (pg) => {
    await pg.clock.setFixedTime(new Date(fecha));
    if (estado) await pg.addInitScript(([k, v]) => localStorage.setItem(k, v), [`pev_${slug}_estado_v1`, JSON.stringify(estado)]);
  });
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1600);
  const r = await p.evaluate((c) => validarConfig(c), cfg);
  if (!r.ok) revisar(false, slug + ' ' + ruta + ': la configuración del caso pasa validarConfig (' + r.errores.join(' / ') + ')');
  await p.evaluate(() => document.fonts.ready);
  const congelar = await p.addStyleTag({ content: CONGELAR });
  await congelar.evaluate((e) => { e.dataset.congelar = ''; });
  await p.waitForTimeout(300);
  return { ctx, p };
}
/* Corre `fn` con la página tal como sale al aire: sin el estilo CONGELAR de abrirDiseno (que apaga las animaciones y
   esconde #chispas para que las capturas sean estables). Lo vuelve a poner al terminar. */
async function sinCongelar(p, fn) {
  const poner = (on) => p.evaluate((o) => { for (const e of document.querySelectorAll('style[data-congelar]')) e.disabled = !o; }, on);
  await poner(false);
  try { return await fn(); } finally { await poner(true); }
}
/* Estilos calculados { prop: valor } del primer elemento que coincide con `sel` (null si no hay). */
const estilosDe = (p, sel, props) => p.evaluate(([s, l]) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  const o = {};
  for (const k of l) o[k] = cs[k];
  return o;
}, [sel, props]);

/* R4 (sección B y A5 del informe): lema, cuenta, día de la semana y colores de Producción salen de los datos. */
async function casoDisenoDatos() {
  console.log('Diseño · Lema, cuenta, día de la semana y Producción salen de los datos');
  // Inicio de San José, dominical (F4:25)
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=inicio', { tipo: 'dominical' });
    igual(await texto(p, '#frase'), '«JOSÉ, HOMBRE JUSTO Y FIEL»', 'San José, Inicio: el lema en la franja');
    igual((await estilosDe(p, '.franja .frase', ['visibility'])).visibility, 'visible', 'San José, Inicio: la franja se ve');
    igual(await texto(p, '#f-num'), '14', 'San José, Inicio: la fecha de la franja es el 14');
    igual(await texto(p, '#f-txt'), 'DOMINGO\nMARZO', 'San José, Inicio: la franja dice DOMINGO / MARZO');
    igual((await estilosDe(p, '#i-cuenta', ['display'])).display, 'flex', 'San José, Inicio: la cuenta regresiva se ve');
    igual(await texto(p, '#i-dias'), '5', 'San José, Inicio: faltan 5 días');
    igual((await estilosDe(p, '.franja .frase i', ['color'])).color, 'rgb(217, 164, 65)', 'San José, Inicio: las estrellas del lema son el acento');
    await captura(p, `diseno_${SJ}_inicio`);
    await ctx.close();
  }
  // Portada de la fiesta de San José (F4:27)
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=portada', { tipo: 'patronal' });
    igual(await texto(p, '#f-num'), '19', 'San José, portada: la franja dice 19');
    igual(await texto(p, '#f-txt'), 'DE\nMARZO', 'San José, portada: la franja dice DE / MARZO');
    await captura(p, `diseno_${SJ}_portada`);
    await ctx.close();
  }
  // Inicio de Ciudad Arce, dominical
  {
    const { ctx, p } = await abrirDiseno(CA, 'pantalla.html?tipo=inicio', { tipo: 'dominical' });
    igual(await texto(p, '#f-txt'), 'JUEVES\nDICIEMBRE', 'Ciudad Arce, Inicio: la franja dice JUEVES / DICIEMBRE');
    igual(await texto(p, '#i-dias'), '5', 'Ciudad Arce, Inicio: faltan 5 días');
    igual(await texto(p, '#frase'), '«TODA HERMOSA ERES, MARÍA»', 'Ciudad Arce, Inicio: el lema en la franja');
    await captura(p, `diseno_${CA}_inicio`);
    await ctx.close();
  }
  // Avisos y Gracias, para las capturas (F4:31 y F4:33)
  for (const slug of [SJ, CA]) {
    for (const vista of ['avisos', 'gracias']) {
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=' + vista, { tipo: 'dominical' });
      await captura(p, `diseno_${slug}_${vista}`);
      await ctx.close();
    }
  }
  // Rótulo de persona (F6:24)
  for (const slug of [SJ, CA]) {
    const { ctx, p } = await abrirDiseno(slug, 'rotulos.html', { tipo: 'dominical', rotulo: 'persona', celebrante: 'P. Juan Pérez', mostrarLogo: true, mostrarEnVivo: true });
    await captura(p, `diseno_${slug}_rotulo`);
    await ctx.close();
  }
  // Producción claro de San José, sin pantallas.produccion (F4:35): el color sale de la paleta
  {
    const { ctx, p } = await abrirDiseno(SJ, 'produccion.html?estilo=claro', null);
    revisar(await visibleEl(p, '#claro'), 'San José, Producción claro: la lámina se ve');
    igual(await reyDe(p), '#8a1c2b', 'San José, Producción claro: --rey es el principal de su paleta');
    await captura(p, `diseno_${SJ}_produccion_claro`);
    await ctx.close();
  }
}

/* A1, A2 y C3 en las pantallas: degradado liso de la paleta, un brillo, marco de arco y sin sombras (F4:25 y F4:31). */
async function casoDisenoFondo() {
  console.log('Diseño · Fondo, marco de arco y sin sombras');
  const ARCO = '300px 300px 40px 40px';
  const RELLENO = 'rgba(0, 0, 0, 0.12)';
  const geometria = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight } : null; }, sel);
  const sinSombra = async (p, sels, nombre) => {
    for (const sel of sels) igual((await estilosDe(p, sel, ['boxShadow'])).boxShadow, 'none', nombre + ': ' + sel + ' sin sombra');
  };
  const decoracion = async (p, nombre) => {
    // Fachada de fondo, rayos, chispas y la imagen que flota vuelven, como en obs/ (decisión del usuario, 2026-11-14).
    // Se mira sin CONGELAR: abrirDiseno apaga las animaciones y esconde #chispas para las capturas, no el producto.
    await sinCongelar(p, async () => {
      const rayos = await estilosDe(p, '.rayos', ['display', 'animationName']);
      revisar(rayos.display !== 'none' && rayos.animationName === 'gira', nombre + ': los rayos se ven y giran (' + rayos.animationName + ')');
      const fachada = await estilosDe(p, '#fachada', ['animationName']);
      revisar(await imagenVisible(p, '#fachada') && fachada.animationName === 'kenburns', nombre + ': la fachada se ve de fondo y se mueve (' + fachada.animationName + ')');
      const chispas = await p.evaluate(() => [...document.querySelectorAll('#chispas .chispa')].map((c) => getComputedStyle(c).animationName));
      revisar(await visibleEl(p, '#chispas') && chispas.length > 0 && chispas.every((a) => a === 'chispa'), nombre + ': las chispas se ven y suben (' + chispas.length + ')');
      const flota = (await estilosDe(p, '#virgen', ['animationName'])).animationName;
      revisar(/(^|, )flota(,|$)/.test(flota), nombre + ': la imagen flota (' + flota + ')');
    });
  };
  const arco = async (p, nombre, x, y, w, h) => {
    const e = await estilosDe(p, '#virgen', ['borderRadius', 'objectFit', 'borderTopWidth', 'filter', 'backgroundColor']);
    igual(e.borderRadius, ARCO, nombre + ': la imagen va en el arco');
    // Ronda 2: el arco lleva el relleno del artboard, así su forma se lee también con una imagen recortada (PNG sin fondo)
    igual(e.backgroundColor, RELLENO, nombre + ': el arco lleva el relleno del artboard');
    igual(e.objectFit, 'cover', nombre + ': la imagen llena el arco');
    igual(e.borderTopWidth, '0px', nombre + ': el arco no tiene borde');
    igual(e.filter, 'none', nombre + ': la imagen no tiene sombra');
    igual(JSON.stringify(await geometria(p, '#virgen')), JSON.stringify({ x, y, w, h }), nombre + ': el arco mide ' + w + '×' + h + ' en ' + x + ',' + y);
  };
  // San José, Inicio (F4:25)
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=inicio', { tipo: 'dominical' });
    igual((await estilosDe(p, '#lienzo', ['backgroundImage'])).backgroundImage, 'linear-gradient(135deg, rgb(75, 15, 24) 0%, rgb(138, 28, 43) 48%, rgb(192, 72, 90) 100%)', 'San José, Inicio: el degradado del artboard');
    igual((await estilosDe(p, '.brillo', ['backgroundImage'])).backgroundImage, 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 62%)', 'San José, Inicio: un brillo suave');
    const b = await geometria(p, '.brillo');
    igual([b.x, b.y, b.w].join(' '), '-160 -120 1100', 'San José, Inicio: el brillo en -160,-120, de 1100');
    await decoracion(p, 'San José, Inicio');
    await arco(p, 'San José, Inicio', 150, 80, 620, 960);
    await sinSombra(p, ['#envivo', '#i-pildora', '.cuenta'], 'San José, Inicio');
    await ctx.close();
  }
  // San José, Avisos (F4:31)
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=avisos', { tipo: 'dominical' });
    await arco(p, 'San José, Avisos', 40, 140, 500, 820);
    await sinSombra(p, ['#v-avisos'], 'San José, Avisos');
    await ctx.close();
  }
  // San José, portada patronal
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=portada', { tipo: 'patronal' });
    await sinSombra(p, ['#p-caja'], 'San José, portada');
    await ctx.close();
  }
  // Ciudad Arce, Inicio: lo mismo con su paleta
  {
    const { ctx, p } = await abrirDiseno(CA, 'pantalla.html?tipo=inicio', { tipo: 'dominical' });
    igual((await estilosDe(p, '#lienzo', ['backgroundImage'])).backgroundImage, 'linear-gradient(135deg, rgb(12, 53, 98) 0%, rgb(17, 85, 164) 48%, rgb(49, 118, 195) 100%)', 'Ciudad Arce, Inicio: el degradado de su paleta');
    await decoracion(p, 'Ciudad Arce, Inicio');
    await arco(p, 'Ciudad Arce, Inicio', 150, 80, 620, 960);
    // Ronda 2: la Virgen de Ciudad Arce es un PNG sin fondo. Dentro del arco, donde no hay figura, tiene que verse el
    // relleno: se mide el mismo punto (entre el manto y el pie, transparente en el PNG) con y sin el relleno.
    revisar(await imagenVisible(p, '#virgen'), 'Ciudad Arce, Inicio: la imagen cargó');
    const luzEn = async (x, y) => {
      const b64 = (await p.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString('base64');
      return p.evaluate(async (d) => {
        const im = new Image(); im.src = 'data:image/png;base64,' + d; await im.decode();
        const c = document.createElement('canvas'); c.width = 1; c.height = 1;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0); const v = g.getImageData(0, 0, 1, 1).data;
        return v[0] + v[1] + v[2];
      }, b64);
    };
    const conRelleno = await luzEn(170, 633);
    await p.addStyleTag({ content: '#virgen{background:none !important}' });
    const sinRelleno = await luzEn(170, 633);
    revisar(conRelleno < sinRelleno - 20, 'Ciudad Arce, Inicio: el relleno se ve detrás de la figura y deja leer el arco (' + conRelleno + ' con relleno, ' + sinRelleno + ' sin)');
    await p.addStyleTag({ content: '#virgen{background:rgba(0,0,0,.12) !important}' });
    await captura(p, `diseno_${CA}_inicio`);
    await ctx.close();
  }
  // Distribuciones e imagen logo
  const conInicio = (inicio) => { const c = configDiseno(SJ); c.pantallas = { inicio: Object.assign({ modo: 'personalizada' }, inicio) }; return c; };
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=inicio', { tipo: 'dominical' }, { cfg: conInicio({ distribucion: 'derecha' }) });
    const g = await geometria(p, '#virgen');
    igual(1920 - g.x - g.w, 150, 'distribución derecha: el arco queda a 150 del borde derecho');
    igual((await estilosDe(p, '#virgen', ['borderRadius'])).borderRadius, ARCO, 'distribución derecha: con arco');
    await ctx.close();
  }
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=inicio', { tipo: 'dominical' }, { cfg: conInicio({ distribucion: 'centro' }) });
    const g = await geometria(p, '#virgen');
    revisar(Math.abs(g.x + g.w / 2 - 960) <= 1, 'distribución centro: el arco queda centrado (' + (g.x + g.w / 2) + ')');
    igual((await estilosDe(p, '#virgen', ['opacity'])).opacity, '0.28', 'distribución centro: el arco va tenue');
    await ctx.close();
  }
  {
    const { ctx, p } = await abrirDiseno(SJ, 'pantalla.html?tipo=inicio', { tipo: 'dominical' }, { cfg: conInicio({ imagen: 'logo' }) });
    const e = await estilosDe(p, '#virgen', ['borderRadius', 'backgroundColor']);
    igual(e.borderRadius, '0px', 'imagen logo: sin arco');
    igual(e.backgroundColor, 'rgba(0, 0, 0, 0)', 'imagen logo: sin relleno');
    await ctx.close();
  }
}

/* A3, A4, C6 y C7: tintes de la paleta en las pantallas, marca en dos líneas, Gracias sin EN VIVO y Avisos con
   logo redondo y filas del velo (F4:25, 27, 31 y 33). */
/* Ronda 2: el logo blanco (#a-logo o #h-logo) cabe en su círculo de 78 sea cual sea su forma: su lado mayor mide
   de 50 a 60, su caja queda dentro de la del círculo y, si no es cuadrado, sus cuatro esquinas dentro del redondel
   (el cuadrado de 56 del artboard tiene las esquinas fuera, pero el dibujo no llega a ellas). */
async function logoEnCirculo(p, x, nombre) {
  const m = await p.evaluate((v) => {
    const c = document.getElementById(v + '-logo-caja').getBoundingClientRect(); const i = document.getElementById(v + '-logo').getBoundingClientRect();
    const cx = c.left + c.width / 2; const cy = c.top + c.height / 2; const r = c.width / 2;
    const esquinas = [[i.left, i.top], [i.right, i.top], [i.left, i.bottom], [i.right, i.bottom]];
    return {
      w: i.width, h: i.height, cw: c.width,
      caja: i.left >= c.left - 0.5 && i.right <= c.right + 0.5 && i.top >= c.top - 0.5 && i.bottom <= c.bottom + 0.5,
      redondel: esquinas.every(([a, b]) => Math.hypot(a - cx, b - cy) <= r + 0.5)
    };
  }, x);
  const lado = Math.round(Math.max(m.w, m.h));
  revisar(lado >= 50 && lado <= 60, nombre + ': el lado mayor del logo mide de 50 a 60 (' + Math.round(m.w) + '×' + Math.round(m.h) + ')');
  revisar(m.caja, nombre + ': el logo queda dentro del círculo de ' + m.cw);
  // un logo apaisado o alto llena su caja hasta los bordes: sus esquinas no pueden salir del redondel
  if (Math.max(m.w, m.h) / Math.min(m.w, m.h) > 1.2) revisar(m.redondel, nombre + ': las esquinas del logo apaisado quedan dentro del redondel');
}

async function casoDisenoColores() {
  console.log('Diseño · Colores de la paleta, marca, Gracias y Avisos');
  const color = async (p, sel) => { const e = await estilosDe(p, sel, ['color']); return e && e.color; };
  const lineas = (p, sel) => p.evaluate((s) => {
    const r = document.createRange(); r.selectNodeContents(document.querySelector(s));
    return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
  }, sel);
  const T = {
    [SJ]: { tenue: 'rgb(242, 214, 218)', velo: 'rgb(251, 238, 240)', vivo: 'rgb(192, 72, 90)', rey: 'rgb(138, 28, 43)', oscuro: 'rgb(75, 15, 24)', fila: 'rgb(138, 28, 43)', logo: 'medios/logo-blanco.svg' },
    [CA]: { tenue: 'rgb(211, 227, 245)', velo: 'rgb(237, 244, 252)', vivo: 'rgb(49, 118, 195)', rey: 'rgb(17, 85, 164)', oscuro: 'rgb(12, 53, 98)', fila: 'rgb(17, 85, 164)', logo: 'medios/logo-blanco.png' }
  };
  for (const slug of [SJ, CA]) {
    const t = T[slug];
    const n = slug === SJ ? 'San José' : 'Ciudad Arce';
    // Inicio (F4:25)
    {
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=inicio', { tipo: 'dominical' });
      igual(await color(p, '#i-ceja'), t.tenue, n + ', Inicio: la ceja es --tenue');
      igual(await color(p, '#i-cursiva'), t.velo, n + ', Inicio: la cursiva es --velo');
      const brilla = (await estilosDe(p, '#i-titulo', ['backgroundImage'])).backgroundImage;
      revisar(brilla.includes(t.tenue + ' 50%'), n + ', Inicio: el destello del título es --tenue (' + brilla + ')');
      if (slug === SJ) {
        igual(await texto(p, '#t-marca'), 'Parroquia San José (ejemplo)\nCiudad de ejemplo', n + ': la marca dice nombre y lugar');
        igual(await lineas(p, '#t-marca'), 2, n + ': la marca va en dos líneas');
      }
      await ctx.close();
    }
    // Portada de la fiesta (F4:27)
    {
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=portada', { tipo: 'patronal' });
      igual(await color(p, '#p-ceja'), t.tenue, n + ', portada: la ceja es --tenue');
      igual(await color(p, '#p-sub'), t.tenue, n + ', portada: el sub es --tenue');
      igual(await color(p, '#p-cursiva'), t.velo, n + ', portada: la cursiva es --velo');
      await ctx.close();
    }
    // Gracias (F4:33)
    {
      const cfg = configDiseno(slug);
      cfg.pantallas = { gracias: { modo: 'personalizada', mostrar: ['horarios', 'redes'] } };
      if (!cfg.horarios) cfg.horarios = CONFIG[SJ].horarios;
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=gracias', { tipo: 'dominical' }, { cfg });
      igual((await estilosDe(p, '#envivo', ['display'])).display, 'none', n + ', Gracias: sin EN VIVO');
      igual(await color(p, '#g-ceja'), t.tenue, n + ', Gracias: la ceja es --tenue');
      igual(await color(p, '#v-gracias .extra .hora b'), t.tenue, n + ', Gracias: los días de los horarios son --tenue');
      await ctx.close();
    }
    // Avisos (F4:31)
    {
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=avisos', { tipo: 'dominical' });
      igual(await color(p, '#a-sub'), t.vivo, n + ', Avisos: el sub es --vivo');
      const h1 = await estilosDe(p, '#a-titulo', ['color', 'letterSpacing']);
      igual(h1.color, t.rey, n + ', Avisos: el título es el principal');
      igual(h1.letterSpacing, 'normal', n + ', Avisos: el título sin letter-spacing');
      const caja = await estilosDe(p, '#a-logo-caja', ['width', 'height', 'borderRadius', 'backgroundColor']);
      igual(caja && [caja.width, caja.height, caja.borderRadius, caja.backgroundColor].join(' '), '78px 78px 50% ' + t.rey, n + ', Avisos: el logo va en un círculo de 78 del principal');
      revisar(await imagenVisible(p, '#a-logo'), n + ', Avisos: el logo se ve');
      await logoEnCirculo(p, 'a', n + ', Avisos');
      igual(await p.getAttribute('#a-logo', 'src'), t.logo, n + ', Avisos: el logo es el blanco');
      revisar(await p.evaluate(() => { const c = document.getElementById('a-logo-caja'); return !!c && c.getBoundingClientRect().right <= document.querySelector('#v-avisos .envivo').getBoundingClientRect().left; }), n + ', Avisos: el logo queda a la izquierda del EN VIVO');
      const ev = await estilosDe(p, '#v-avisos .envivo', ['fontSize', 'padding']);
      igual(ev.fontSize + ' / ' + ev.padding, '22px / 8px 16px 8px 12px', n + ', Avisos: el EN VIVO chico de la tarjeta');
      igual((await estilosDe(p, '#a-filas', ['justifyContent'])).justifyContent, 'space-between', n + ', Avisos: las filas se reparten');
      const fila = await estilosDe(p, '#a-filas .fila', ['backgroundColor', 'gridTemplateColumns']);
      igual(fila.backgroundColor, t.velo, n + ', Avisos: la fila es --velo');
      // Ronda 2: los 420 px del artboard son el máximo del detalle, no una columna fija (la columna sigue al detalle)
      const cols = fila.gridTemplateColumns.split(' ').map(parseFloat);
      revisar(cols.length === 3 && cols[0] === 120 && cols[2] <= 420, n + ', Avisos: columnas 120px … hasta 420px (' + fila.gridTemplateColumns + ')');
      igual((await estilosDe(p, '#a-filas .fila .f', ['maxWidth'])).maxWidth, '420px', n + ', Avisos: el detalle mide como mucho 420');
      igual(await color(p, '#a-filas .fila .a'), t.oscuro, n + ', Avisos: el aviso es el oscuro');
      igual(await color(p, '#a-filas .fila .f'), t.fila, n + ', Avisos: el detalle es --fila-texto');
      await captura(p, `diseno_${slug}_avisos`);
      await ctx.close();
    }
    // Horarios: el mismo círculo del logo (Ronda 2)
    {
      const cfg = configDiseno(slug);
      if (!cfg.horarios) cfg.horarios = CONFIG[SJ].horarios;
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=horarios', { tipo: 'dominical' }, { cfg });
      revisar(await imagenVisible(p, '#h-logo'), n + ', Horarios: el logo se ve');
      await logoEnCirculo(p, 'h', n + ', Horarios');
      await captura(p, `diseno_${slug}_horarios`);
      await ctx.close();
    }
    // Ninguna pantalla con el celeste #bfe0ff
    for (const vista of ['inicio', 'portada', 'gracias', 'avisos', 'horarios']) {
      const cfg = configDiseno(slug);
      cfg.pantallas = { inicio: { modo: 'personalizada', mostrar: ['redes'] }, gracias: { modo: 'personalizada', mostrar: ['horarios', 'redes'] } };
      if (!cfg.horarios) cfg.horarios = CONFIG[SJ].horarios;
      if (!cfg.redes) cfg.redes = CONFIG[SJ].redes;
      const { ctx, p } = await abrirDiseno(slug, 'pantalla.html?tipo=' + vista, { tipo: vista === 'portada' ? 'patronal' : 'dominical' }, { cfg });
      const celestes = await p.evaluate(() => [...document.querySelectorAll('#escenario *')].filter((e) => {
        if (e.getClientRects().length === 0) return false;
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden') return false;
        return [cs.color, cs.backgroundColor, cs.backgroundImage, cs.borderTopColor].some((v) => v.includes('rgb(191, 224, 255)'));
      }).map((e) => e.id || e.className));
      igual(celestes.join(', '), '', n + ', ' + vista + ': ningún elemento visible con #bfe0ff');
      await ctx.close();
    }
  }
}

/* C1 a C4 y R3: rótulo de persona como F6:24 (esquinas del diseño, sin sombra, Lora 54/1.08, kicker --vivo) y logo
   de esquina como imagen sola mientras hay rótulo; sin rótulo, la capa del logo de F4:37. */
async function casoDisenoRotulo() {
  console.log('Diseño · Rótulos: esquinas, sombra, Lora, logo de esquina y kicker');
  const ESTADO = { tipo: 'dominical', rotulo: 'persona', celebrante: 'P. Juan Pérez', mostrarLogo: true, mostrarEnVivo: true, mostrarBarra: true };
  const clasesEsquinas = (p) => p.evaluate(() => [...document.getElementById('escenario').classList].filter((x) => /^esquinas-/.test(x)).join(' '));
  const radios = (p) => p.evaluate(() => ['rotulo', 'logo', 'barra'].map((id) => getComputedStyle(document.getElementById(id)).borderRadius).join(' / '));
  const conRotulos = (slug, rotulos) => { const c = configDiseno(slug); c.rotulos = Object.assign({}, c.rotulos, rotulos); return c; };
  // San José (F6:24)
  {
    const { ctx, p } = await abrirDiseno(SJ, 'rotulos.html', ESTADO);
    await p.waitForSelector('#rotulo.en');
    const r = await estilosDe(p, '#rotulo', ['borderRadius', 'boxShadow']);
    igual(r.borderRadius + ' / ' + r.boxShadow, '24px / none', 'San José, rótulo: esquinas suaves de 24px y sin sombra');
    igual(await clasesEsquinas(p), '', 'San José, rótulo: suaves no pone clase de esquinas');
    igual((await estilosDe(p, '#rotulo .lado', ['backgroundImage'])).backgroundImage, 'linear-gradient(160deg, rgb(138, 28, 43), rgb(75, 15, 24))', 'San José, rótulo: el lado es el degradado rey→oscuro');
    const cuerpo = await estilosDe(p, '#rotulo .cuerpo', ['borderTopColor', 'borderTopWidth']);
    igual(cuerpo.borderTopColor + ' ' + cuerpo.borderTopWidth, 'rgb(217, 164, 65) 8px', 'San José, rótulo: línea de 8px del acento');
    igual((await estilosDe(p, '#r-k', ['color'])).color, 'rgb(192, 72, 90)', 'San José, rótulo: el kicker es --vivo');
    const t = await estilosDe(p, '#r-t', ['fontFamily', 'fontSize', 'lineHeight', 'color']);
    revisar(/^"?Lora"?/.test(t.fontFamily), 'San José, rótulo: el nombre en Lora (' + t.fontFamily + ')');
    igual(t.fontSize + ' / ' + t.lineHeight, '54px / 58.32px', 'San José, rótulo: Lora 54/1.08');
    igual(t.color, 'rgb(75, 15, 24)', 'San José, rótulo: el nombre es el oscuro');
    igual((await estilosDe(p, '#r-s', ['color'])).color, 'rgb(138, 28, 43)', 'San José, rótulo: la línea de abajo es el principal');
    for (const sel of ['#envivo', '#logo', '#barra']) igual((await estilosDe(p, sel, ['boxShadow'])).boxShadow, 'none', 'San José: ' + sel + ' sin sombra');
    revisar(await p.evaluate(() => document.getElementById('logo').classList.contains('oculto')), 'San José, con rótulo: la capa del logo se aparta');
    const le = await p.evaluate(() => {
      const e = document.getElementById('logo-esquina');
      if (!e) return null;
      const cs = getComputedStyle(e);
      return { oculto: e.classList.contains('oculto'), tag: e.tagName, padre: e.parentElement.id, x: e.offsetLeft, y: e.offsetTop, h: e.offsetHeight, opacidad: cs.opacity, fondo: cs.backgroundColor, src: e.getAttribute('src') };
    });
    revisar(!!le, 'San José, con rótulo: existe #logo-esquina');
    if (le) {
      revisar(!le.oculto, 'San José, con rótulo: el logo de esquina se ve');
      igual(le.tag + ' en #' + le.padre, 'IMG en #escenario', 'San José: el logo de esquina es una imagen suelta en el escenario');
      igual([le.x, le.y, le.h].join(' '), '60 44 64', 'San José: el logo de esquina en 60,44, de 64 de alto');
      igual(le.opacidad, '0.9', 'San José: el logo de esquina con opacidad .9');
      igual(le.fondo, 'rgba(0, 0, 0, 0)', 'San José: el logo de esquina sin caja');
      igual(le.src, 'medios/logo-blanco.svg', 'San José: el logo de esquina es el blanco');
    }
    await captura(p, `diseno_${SJ}_rotulo`);
    // Sin rótulo: la capa del logo de F4:37
    await p.evaluate(() => pintar(Object.assign({}, estado, { rotulo: 'ninguno' })));
    await p.waitForTimeout(300);
    const capa = await p.evaluate(() => {
      const e = document.getElementById('logo');
      const r = document.createRange(); r.selectNodeContents(document.getElementById('logo-txt'));
      return { oculto: e.classList.contains('oculto'), x: e.offsetLeft, y: e.offsetTop, fondo: getComputedStyle(e).backgroundColor, sombra: getComputedStyle(e).boxShadow,
        lineas: new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size,
        esquina: document.getElementById('logo-esquina') ? document.getElementById('logo-esquina').classList.contains('oculto') : null };
    });
    revisar(!capa.oculto, 'San José, sin rótulo: la capa del logo vuelve');
    igual([capa.x, capa.y].join(' '), '44 36', 'San José, sin rótulo: la capa en 44,36');
    igual(capa.fondo + ' / ' + capa.sombra, 'rgb(138, 28, 43) / none', 'San José, sin rótulo: la capa es del principal y sin sombra');
    igual(capa.lineas, 2, 'San José, sin rótulo: el texto de la capa va en dos líneas');
    igual(capa.esquina, true, 'San José, sin rótulo: el logo de esquina se aparta');
    await captura(p, `diseno_${SJ}_capa`);
    await ctx.close();
  }
  // logoEsquina:false con rótulo: ni capa ni logo de esquina
  {
    const { ctx, p } = await abrirDiseno(SJ, 'rotulos.html', ESTADO, { cfg: conRotulos(SJ, { logoEsquina: false }) });
    await p.waitForSelector('#rotulo.en');
    igual(await p.evaluate(() => ['logo', 'logo-esquina'].map((id) => { const e = document.getElementById(id); return e ? e.classList.contains('oculto') : null; }).join(' ')), 'true true', 'logoEsquina false: la capa y el logo de esquina se apartan');
    await ctx.close();
  }
  // Esquinas (R3): rectas, redondeadas (config vieja = suaves) y redondas (valor provisional)
  for (const [q, esperado, clase] of [['rectas', '0px / 0px / 0px', 'esquinas-rectas'], ['redondeadas', '24px / 18px / 16px', ''], ['suaves', '24px / 18px / 16px', ''], ['redondas', '48px / 36px / 32px', 'esquinas-redondas']]) {
    const { ctx, p } = await abrirDiseno(SJ, 'rotulos.html', ESTADO, { cfg: conRotulos(SJ, { esquinas: q }) });
    await p.waitForSelector('#rotulo.en');
    igual(await radios(p), esperado, 'esquinas ' + q + ': rótulo / logo / barra');
    igual(await clasesEsquinas(p), clase, 'esquinas ' + q + ': clase del escenario');
    await ctx.close();
  }
  // Ciudad Arce: lo mismo con su paleta
  {
    const { ctx, p } = await abrirDiseno(CA, 'rotulos.html', ESTADO);
    await p.waitForSelector('#rotulo.en');
    igual((await estilosDe(p, '#r-k', ['color'])).color, 'rgb(49, 118, 195)', 'Ciudad Arce, rótulo: el kicker es --vivo');
    igual((await estilosDe(p, '#rotulo .lado', ['backgroundImage'])).backgroundImage, 'linear-gradient(160deg, rgb(17, 85, 164), rgb(12, 53, 98))', 'Ciudad Arce, rótulo: el lado es el degradado rey→oscuro');
    await captura(p, `diseno_${CA}_rotulo`);
    await ctx.close();
  }
}

/* C5, B3 y A3 en produccion.html: el Claro de F4:35 (papel, halo --vivo, logo blanco en un círculo del principal a
   la izquierda del texto, grupo centrado) y el Azul con los tintes de la paleta. */
async function casoDisenoProduccion() {
  console.log('Diseño · Producción claro y azul');
  const centro = (p) => p.evaluate(() => { const r = document.querySelector('#claro .fila').getBoundingClientRect(); return r.left + r.width / 2; });
  // San José, claro (F4:35)
  {
    const { ctx, p } = await abrirDiseno(SJ, 'produccion.html?estilo=claro', null);
    igual((await estilosDe(p, '#claro', ['backgroundColor'])).backgroundColor, 'rgb(250, 246, 243)', 'San José, claro: el papel del artboard');
    const halo = await estilosDe(p, '#claro .halo', ['backgroundImage', 'width']);
    igual(halo.backgroundImage, 'radial-gradient(circle, rgba(192, 72, 90, 0.14) 0%, rgba(192, 72, 90, 0) 60%)', 'San José, claro: el halo es --vivo');
    igual(halo.width, '1500px', 'San José, claro: el halo mide 1500');
    const ceja = await estilosDe(p, '#claro .ceja', ['color', 'fontSize', 'letterSpacing']);
    igual([ceja.color, ceja.fontSize, ceja.letterSpacing].join(' '), 'rgb(58, 42, 44) 40px 10px', 'San José, claro: la ceja es --tinta, 40/10');
    const caja = await estilosDe(p, '#logo-claro-caja', ['width', 'height', 'borderRadius', 'backgroundColor']);
    igual(caja && [caja.width, caja.height, caja.borderRadius, caja.backgroundColor].join(' '), '300px 300px 50% rgb(138, 28, 43)', 'San José, claro: el logo va en un círculo de 300 del principal');
    revisar(await imagenVisible(p, '#logo-claro'), 'San José, claro: el logo se ve');
    igual(await p.evaluate(() => document.getElementById('logo-claro').offsetWidth), 200, 'San José, claro: el logo mide 200 de ancho');
    igual(await p.getAttribute('#logo-claro', 'src'), 'medios/logo-blanco.svg', 'San José, claro: el logo es el blanco');
    revisar(await p.evaluate(() => { const c = document.getElementById('logo-claro-caja'); return !!c && c.getBoundingClientRect().right <= document.querySelector('#claro .nombres').getBoundingClientRect().left; }), 'San José, claro: el círculo queda a la izquierda del texto');
    igual((await estilosDe(p, '#claro .fila', ['columnGap'])).columnGap, '48px', 'San José, claro: separación de 48');
    const grande = await estilosDe(p, '#claro .grande', ['color', 'fontSize']);
    igual(grande.color + ' ' + grande.fontSize, 'rgb(138, 28, 43) 118px', 'San José, claro: el nombre grande es el principal, 118');
    igual((await estilosDe(p, '#claro .sub', ['color'])).color, 'rgb(192, 72, 90)', 'San José, claro: el sub es --vivo');
    igual((await estilosDe(p, '#pie', ['color'])).color, 'rgb(90, 74, 76)', 'San José, claro: el pie es --gris');
    const c = await centro(p);
    revisar(Math.abs(c - 960) <= 1, 'San José, claro: el grupo queda centrado (' + c + ')');
    await captura(p, `diseno_${SJ}_produccion_claro`);
    await ctx.close();
  }
  // Sin marca: sin círculo y el texto sigue centrado
  {
    const cfg = configDiseno(SJ);
    cfg.pantallas = { produccion: { modo: 'personalizada', ocultar: ['marca'] } };
    const { ctx, p } = await abrirDiseno(SJ, 'produccion.html?estilo=claro', null, { cfg });
    revisar(!(await visibleEl(p, '#logo-claro-caja')), 'claro sin marca: el círculo no se ve');
    const c = await centro(p);
    revisar(Math.abs(c - 960) <= 1, 'claro sin marca: el texto queda centrado (' + c + ')');
    await ctx.close();
  }
  // Ciudad Arce, claro
  {
    const { ctx, p } = await abrirDiseno(CA, 'produccion.html?estilo=claro', null);
    igual((await estilosDe(p, '#claro', ['backgroundColor'])).backgroundColor, 'rgb(243, 242, 251)', 'Ciudad Arce, claro: el papel de su paleta');
    igual((await estilosDe(p, '#logo-claro-caja', ['backgroundColor'])).backgroundColor, 'rgb(17, 85, 164)', 'Ciudad Arce, claro: el círculo es su principal');
    igual((await estilosDe(p, '#claro .sub', ['color'])).color, 'rgb(49, 118, 195)', 'Ciudad Arce, claro: el sub es su --vivo');
    await captura(p, `diseno_${CA}_produccion_claro`);
    await ctx.close();
  }
  // Azul: el degradado termina en --vivo; la raya es --tenue; nada de #bfe0ff
  for (const [slug, vivo] of [[CA, 'rgb(49, 118, 195)'], [SJ, 'rgb(192, 72, 90)']]) {
    const n = slug === SJ ? 'San José' : 'Ciudad Arce';
    const { ctx, p } = await abrirDiseno(slug, 'produccion.html?estilo=azul', null);
    const fondo = (await estilosDe(p, '#azul', ['backgroundImage'])).backgroundImage;
    revisar(fondo.endsWith(vivo + ' 100%)'), n + ', azul: el degradado termina en --vivo (' + fondo + ')');
    if (slug === CA) {
      igual((await estilosDe(p, '#azul .raya', ['backgroundColor'])).backgroundColor, 'rgb(211, 227, 245)', n + ', azul: la raya es --tenue');
      const celestes = await p.evaluate(() => [...document.querySelectorAll('#escenario *')].filter((e) => {
        const cs = getComputedStyle(e);
        return [cs.color, cs.backgroundColor, cs.backgroundImage, cs.borderTopColor].some((v) => v.includes('rgb(191, 224, 255)'));
      }).map((e) => e.id || e.className));
      igual(celestes.join(', '), '', n + ', azul: ningún elemento con #bfe0ff');
    }
    await captura(p, `diseno_${slug}_produccion_azul`);
    await ctx.close();
  }
}

const rutaLineaBase = path.join(__dirname, 'linea-base.json');
const nombreCaso = (c) => c.slug + '/' + c.pagina + c.query + ' ' + JSON.stringify(c.estado) + (c.rotulos ? ' rotulos ' + JSON.stringify(c.rotulos) : '');

/* Con --grabar-linea-base escribe linea-base.json; con --grabar-linea-base=<ruta>, escribe en esa ruta y no toca
   linea-base.json (para comparar con diferencias-linea-base.js antes de grabar). Sin la marca compara caso por caso. */
async function casoLineaBase() {
  const marca = process.argv.find((a) => a === '--grabar-linea-base' || a.startsWith('--grabar-linea-base='));
  const grabar = !!marca;
  const destino = marca && marca.includes('=') ? path.resolve(marca.slice(marca.indexOf('=') + 1)) : rutaLineaBase;
  console.log('Línea base de compatibilidad' + (grabar ? ' (grabando en ' + destino + ')' : ''));
  const guardada = grabar ? null : JSON.parse(fs.readFileSync(rutaLineaBase, 'utf8'));
  const nuevo = {};
  for (const c of CASOS_BASE) {
    const nombre = nombreCaso(c);
    const ctx = await nuevoContexto();
    if (c.rotulos) {
      const cfg = JSON.parse(JSON.stringify(CONFIG[c.slug]));
      cfg.rotulos = Object.assign({}, cfg.rotulos, c.rotulos);
      await ctx.route(rutaConfig, servirConfig(cfg));
    }
    const p = await abrir(ctx, '/' + c.slug + '/' + c.pagina + c.query, 1920, 1080, async (pg) => {
      await pg.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
      await pg.addInitScript(([k, v]) => localStorage.setItem(k, v), ['pev_' + c.slug + '_estado_v1', JSON.stringify(c.estado)]);
    });
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1800);
    const h = await huellaBase(p);
    await ctx.close();
    if (grabar) { nuevo[nombre] = h; continue; }
    let primero = null;
    try { assert.deepStrictEqual(h, guardada[nombre]); } catch (e) {
      const esp = guardada[nombre] || {};
      for (const grupo of Object.keys(h)) {
        try { assert.deepStrictEqual(h[grupo], esp[grupo]); } catch (e2) {
          const a = h[grupo] || {}; const b = esp[grupo] || {};
          const k = Array.isArray(a) ? null : [...new Set([...Object.keys(a), ...Object.keys(b)])].find((x) => JSON.stringify(a[x]) !== JSON.stringify(b[x]));
          primero = grupo + (k ? '.' + k + ' era ' + JSON.stringify(a[k]) + ', se esperaba ' + JSON.stringify(b[k]) : ' era ' + JSON.stringify(a) + ', se esperaba ' + JSON.stringify(b));
          break;
        }
      }
      primero = primero || 'distinto';
    }
    revisar(primero === null, nombre + (primero ? ': ' + primero : ''));
  }
  if (grabar) {
    fs.writeFileSync(destino, JSON.stringify(nuevo, null, 2) + '\n');
    console.log('  grabados ' + Object.keys(nuevo).length + ' casos en ' + destino);
  } else {
    igual(Object.keys(guardada).length, CASOS_BASE.length, 'la línea base tiene todos los casos');
  }
}

/* 3b: «Faltan N datos» del panel cuenta lo mismo que SEMANA.contarFaltas (vicaria/semana.js), tipo por tipo. */
async function casoFaltasIguales() {
  console.log('3b · El panel y contarFaltas cuentan lo mismo');
  const vigilia = JSON.parse(JSON.stringify(CONFIG[CA]));
  vigilia.tipos = Object.assign({}, vigilia.tipos, {
    propios: [{ clave: 'vigilia', nombre: 'Vigilia', rotulos: ['persona', 'lectura1', 'persona'], opcionales: ['persona-2'] }]
  });
  for (const [nombre, config] of [['la configuración real', null], ['con el propio vigilia y sus opcionales', vigilia]]) {
    const ctx = await nuevoContexto();
    if (config) await ctx.route(`**/${CA}/config.json`, (r) => servirConfig(config)(r));
    const panel = await abrir(ctx, `/${CA}/panel.html`, 360, 1250);
    await panel.waitForSelector('[data-tipo="dominical"]', { state: 'attached' });
    if (config) await panel.waitForSelector('[data-tipo="vigilia"]', { state: 'attached', timeout: 5000 }).catch(() => {});
    await panel.addScriptTag({ path: path.join(RAIZ, 'semana.js') });
    const claves = await panel.evaluate(() => ordenTipos());
    if (config) revisar(claves.includes('vigilia'), 'el panel ofrece el propio vigilia');
    for (const clave of claves) {
      await elegirTipo(panel, clave);
      await panel.waitForTimeout(100);
      const titulo = (await panel.textContent('#revision .tit')) || '';
      const m = /(\d+) datos?/.exec(titulo);
      const delPanel = /Todo listo/.test(titulo) ? 0 : m ? Number(m[1]) : -1;
      const delNucleo = await panel.evaluate((k) => SEMANA.contarFaltas(
        SEMANA.tipoDeClave(SEMANA.tiposDisponibles(SEMANA.tiposParaCampos(TIPOS, ORDEN_TIPOS), PARROQUIA.tipos), k), {}), clave);
      igual(delPanel, delNucleo, nombre + ': ' + clave + ' cuenta ' + delNucleo);
    }
    await ctx.close();
  }
}

/* ---------- Misas listas: siempre a la vista en Preparar, y sincronizadas con la nube ----------
   La nube se simula con context.route() sobre *.supabase.co: ninguna prueba habla con Supabase de verdad. */
const PAR_PRUEBA = '11111111-1111-4111-8111-111111111111';
const CLAVE_CA = (n) => 'pev_' + CA + '_' + n;

const visibleEn = (p, sel) => p.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  for (let n = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return el.getBoundingClientRect().width > 0;
}, sel);

const guardadaPrueba = (id, nombre, usadaEn, extra) => Object.assign({ id, nombre, tipo: 'horasanta', guardadaEn: usadaEn, usadaEn, actualizadoEn: usadaEn, datos: { tipo: 'horasanta', celebrante: 'Pbro. ' + nombre } }, extra);
const filaPrueba = (id, nombre, ms) => ({ id, parroquia_id: PAR_PRUEBA, nombre, tipo: 'dominical', datos: { tipo: 'dominical' }, guardada_en: new Date(ms).toISOString(), usada_en: new Date(ms).toISOString(), actualizado_en: new Date(ms).toISOString(), actualizado_desde: 'app', borrada_en: null });

/* Siembra localStorage una sola vez por pestaña (addInitScript corre también al recargar). */
function sembrarPanel(p, valores) {
  return p.addInitScript((v) => {
    if (sessionStorage.getItem('__sembrado')) return;
    sessionStorage.setItem('__sembrado', '1');
    for (const [k, x] of Object.entries(v)) localStorage.setItem(k, typeof x === 'string' ? x : JSON.stringify(x));
  }, valores);
}
const sesionPrueba = () => ({ [CLAVE_CA('sesion_nube_v1')]: { access: 'acc-prueba', refresh: 'ref-prueba', vence: Date.now() + 3600000 } });
const yaMigrado = () => ({ [CLAVE_CA('guardadas_migradas_v1')]: { cuando: 1, cantidad: 0 } });

/* Nube falsa para un contexto: contesta Auth y PostgREST como Supabase (con CORS) y anota lo que recibe. */
async function nubeDePrueba(ctx, filas = [], opciones = {}) {
  const n = { filas: filas.map((f) => Object.assign({}, f)), subidas: [], usos: [], pedidos: [] };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  await ctx.route((u) => /\.supabase\.co$/.test(u.hostname), async (route) => {
    const q = route.request();
    const u = new URL(q.url());
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    n.pedidos.push(q.method() + ' ' + u.pathname);
    const json = (status, cuerpo) => route.fulfill({ status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors), body: cuerpo === undefined ? '' : JSON.stringify(cuerpo) });
    if (u.pathname === '/auth/v1/token') {
      const b = q.postDataJSON();
      if (opciones.demoraToken) await new Promise((r) => setTimeout(r, opciones.demoraToken));
      if (opciones.estadoToken) return json(opciones.estadoToken, {});
      if (b.password !== 'clave-buena') return json(400, { error_code: 'invalid_credentials' });
      return json(200, { access_token: 'acc-prueba', refresh_token: 'ref-prueba', expires_in: 3600, user: { email: b.email } });
    }
    if (u.pathname === '/rest/v1/parroquias') return json(200, [{ id: PAR_PRUEBA }]);
    if (u.pathname === '/rest/v1/guardadas' && q.method() === 'GET') return json(200, n.filas);
    if (u.pathname === '/rest/v1/guardadas' && q.method() === 'POST') {
      const fila = q.postDataJSON()[0];
      n.subidas.push(fila);
      if (opciones.demoraSubida) await new Promise((r) => setTimeout(r, opciones.demoraSubida));
      if (opciones.estadoSubida) return json(opciones.estadoSubida, { code: 'x' });
      const i = n.filas.findIndex((x) => x.id === fila.id);
      if (i >= 0) n.filas[i] = fila; else n.filas.push(fila);
      return json(201);
    }
    if (u.pathname === '/rest/v1/rpc/usar_guardada') { n.usos.push(q.postDataJSON()); return json(204); }
    return json(404, {});
  });
  return n;
}

async function abrirPanelListas(ctx, valores, { ancho = 420, alto = 900, app = false } = {}) {
  const p = await abrir(ctx, `/${CA}/panel.html${app ? '?modo=app' : ''}`, ancho, alto, (pg) => sembrarPanel(pg, valores));
  await p.waitForSelector('[data-tipo="dominical"]', { state: 'attached' });
  return p;
}
const nombresListas = (p) => p.$$eval('#listas .rapida .nom', (els) => els.map((e) => e.textContent));
async function esperarTexto(p, sel, texto, ms = 6000) {
  try { await p.waitForFunction(([s, t]) => ((document.querySelector(s) || {}).textContent || '').trim() === t, [sel, texto], { timeout: ms }); } catch (e) {}
  return ((await p.textContent(sel)) || '').trim();
}

/* Alto de cada control visible de `sel`: todos deben medir 44 px o más. */
async function revisar44(p, sel, prefijo) {
  for (const b of await p.locator(sel).all()) {
    const caja = await b.boundingBox();
    if (caja) revisar(caja.height >= 44, (prefijo || '') + 'control de 44 px o más: ' + ((await b.getAttribute('aria-label')) || (await b.textContent()).trim()) + ' (' + caja.height + ')');
  }
}
const TXT_VACIA = 'Todavía no hay misas listas. Cuando termines de preparar una, apretá «Guardar esta transmisión…» y después «Guardar»; va a quedar acá.';

async function casoMisasListas() {
  console.log('Misas listas en Preparar');

  console.log(' · Preparar muestra Misas listas sin apretar Cambiar');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx);
    const p = await abrirPanelListas(ctx, { [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000), guardadaPrueba('bbbb2', 'Domingo 30', 3000)] });
    igual(await visibleEn(p, '#preparar-datos #sec-listas'), true, 'la sección está en la vista de datos de Preparar');
    igual(await visibleEn(p, '#elegir'), false, 'sin apretar Cambiar');
    igual(((await p.textContent('#sec-listas h3')) || '').trim(), 'Misas listas', 'el título dice «Misas listas»');
    igual((await nombresListas(p)).join('|'), 'Domingo 30|Hora Santa jueves', 'muestra las guardadas, la más usada primero');
    igual(await p.evaluate(() => !!document.getElementById('sec-rapidas')), false, 'Elegir ya no repite la lista rápida');
    igual(await p.evaluate(() => { const r = document.getElementById('revision'); const l = document.getElementById('sec-listas'); return !!l && !!(r.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); }), true, 'va debajo de la revisión');
    for (const b of await p.locator('#listas button').all()) {
      const caja = await b.boundingBox();
      revisar(caja.height >= 44, 'botón de la lista de 44 px o más: ' + (await b.getAttribute('aria-label')) + ' (' + caja.height + ')');
    }
    await revisar44(p, '#entrar, #ver-todas', 'PC: ');
    igual(((await p.textContent('#tab-guardadas')) || '').trim(), 'Misas listas', 'la pestaña se llama «Misas listas»');
    igual(((await p.textContent('#titulo-guardadas')) || '').trim(), 'Misas listas', 'y su título también');
    revisar(((await p.textContent('#listas .rapida .meta')) || '').startsWith('Guardada '), 'una misa que nunca se cargó dice «Guardada …» (' + (await p.textContent('#listas .rapida .meta')) + ')');
    igual(await p.getAttribute('#estado-sync', 'role').catch(() => null), 'status', 'la línea de estado tiene role="status"');
    igual(nube.pedidos.length, 0, 'sin sesión no se pide nada a la nube');
    await ctx.close();
  }

  console.log(' · muestra 5 y Ver todas las misas listas abre la pestaña');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx);
    const siete = [1, 2, 3, 4, 5, 6, 7].map((i) => guardadaPrueba('misa' + i, 'Misa ' + i, i * 1000));
    const p = await abrirPanelListas(ctx, { [CLAVE_CA('guardadas_v1')]: siete });
    igual((await nombresListas(p)).join('|'), 'Misa 7|Misa 6|Misa 5|Misa 4|Misa 3', 'hasta 5, de la más usada a la menos usada');
    igual(((await p.textContent('#ver-todas')) || '').trim(), 'Ver todas las misas listas', 'el enlace dice «Ver todas las misas listas»');
    await p.click('#ver-todas', { timeout: 3000 }).catch(() => {});
    igual(await p.evaluate(() => document.getElementById('hoja-guardadas').classList.contains('activa')), true, '«Ver todas las misas listas» abre la pestaña');
    igual(await p.locator('#lista-guardadas .guardada').count(), 7, 'y ahí están las 7');
    await ctx.close();

    const ctx2 = await nuevoContexto();
    await nubeDePrueba(ctx2);
    const vacio = await abrirPanelListas(ctx2, {});
    igual(((await vacio.textContent('#listas-vacia').catch(() => '')) || '').trim(), TXT_VACIA, 'sin guardadas lo dice');
    igual(await visibleEn(vacio, '#listas-vacia'), true, 'y el mensaje se ve');
    igual(await vacio.evaluate(() => { const m = document.getElementById('listas-vacia'); return !!m && !m.closest('[role=list]'); }), true, 'el mensaje no va dentro de role="list"');
    igual(await vacio.evaluate(() => [...document.querySelectorAll('[role=list]')].filter((l) => l.getClientRects().length && !l.children.length).length), 0, 'no queda a la vista una lista vacía');
    await vacio.click('[data-hoja="guardadas"]');
    igual(((await vacio.textContent('#lista-guardadas')) || '').trim(), 'Todavía no hay misas listas. Escribí un nombre arriba y apretá Guardar.', 'la pestaña vacía lo dice de vos');
    await vacio.fill('#guardar-nombre', '');
    await vacio.click('#guardar-boton');
    igual(((await vacio.textContent('#estado-guardadas')) || '').trim(), 'Escribí un nombre para guardarla.', 'sin nombre lo pide de vos');
    await vacio.click('[data-hoja="preparar"]');
    igual(await visibleEn(vacio, '#preparar-datos #guardar-esta'), true, '«Guardar esta transmisión…» está a la vista en Preparar');
    await ctx2.close();
  }

  console.log(' · sin sesión muestra Entrá para ver también las del celular');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx);
    const p = await abrirPanelListas(ctx, {});
    igual(await esperarTexto(p, '#estado-sync', 'Entrá para ver también las del celular', 3000).catch(() => ''), 'Entrá para ver también las del celular', 'la línea de estado invita a entrar');
    igual(await visibleEn(p, '#entrar'), true, 'con el botón a la vista');
    igual(((await p.textContent('#entrar').catch(() => '')) || '').trim(), 'Entrar con mi cuenta', 'el botón dice «Entrar con mi cuenta»');
    igual(nube.pedidos.length, 0, 'y no se pidió nada a la nube');
    await ctx.close();
  }

  console.log(' · entrar sube las locales y muestra Se guardaron 2 misas de esta computadora en la nube');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx, [], { demoraToken: 600 });
    // guardadas de antes de la nube: sin pendientes ni actualizadoEn
    const viejas = [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000, { actualizadoEn: undefined }), guardadaPrueba('bbbb2', 'Domingo 30', 3000, { actualizadoEn: undefined })];
    const p = await abrirPanelListas(ctx, { [CLAVE_CA('guardadas_v1')]: viejas });
    await p.click('#entrar', { timeout: 3000 });
    igual(await p.evaluate(() => document.getElementById('dialogo-entrar').open), true, '«Entrar» abre el diálogo');
    igual(await p.getAttribute('#entrar-correo', 'autocomplete'), 'username', 'el correo lleva autocomplete="username"');
    igual(await p.getAttribute('#entrar-clave', 'type'), 'password', 'la contraseña va tapada');
    igual(await p.getAttribute('#entrar-clave', 'autocomplete'), 'current-password', 'la contraseña lleva autocomplete="current-password"');
    igual(((await p.textContent('#entrar-titulo')) || '').trim(), 'Entrar con la cuenta del editor web', 'el título del diálogo');
    igual(await p.evaluate(() => { const d = document.getElementById('dialogo-entrar'); const t = document.getElementById(d.getAttribute('aria-labelledby') || ''); const a = document.getElementById(d.getAttribute('aria-describedby') || ''); return [t && t.textContent.trim(), a && a.textContent.trim()].join(' | '); }),
      'Entrar con la cuenta del editor web | ¿Olvidaste la clave? Pedísela a quien administra el editor web.', 'el diálogo se nombra con el título y se describe con la ayuda (aria-describedby)');
    await revisar44(p, '#dialogo-entrar button', 'PC, diálogo de entrar: ');
    await p.fill('#entrar-correo', 'coordinador@ejemplo.org');
    await p.fill('#entrar-clave', 'mala');
    await p.click('#entrar-boton');
    igual(await esperarTexto(p, '#entrar-error', 'Correo o contraseña incorrectos'), 'Correo o contraseña incorrectos', 'con la contraseña mala lo dice');
    await p.fill('#entrar-clave', 'clave-buena');
    await p.click('#entrar-boton');
    igual(await esperarTexto(p, '#entrar-boton', 'Entrando…', 500), 'Entrando…', 'mientras entra, el botón dice «Entrando…»');
    igual(await esperarTexto(p, '#estado-sync', 'Se guardaron 2 misas de esta computadora en la nube'), 'Se guardaron 2 misas de esta computadora en la nube', 'al entrar sube las de esta computadora y lo dice');
    igual(((await p.textContent('#entrar-boton')) || '').trim(), 'Entrar', 'y el botón vuelve a decir «Entrar»');
    igual(await p.evaluate(() => document.getElementById('dialogo-entrar').open), false, 'el diálogo se cierra');
    igual(nube.subidas.map((f) => f.id).sort().join('|'), 'aaaa1|bbbb2', 'subieron las dos');
    igual(nube.subidas.every((f) => f.actualizado_desde === 'panel' && f.parroquia_id === PAR_PRUEBA), true, 'como «panel», a la parroquia');
    igual(await p.inputValue('#entrar-clave'), '', 'la contraseña no queda escrita');
    igual(await visibleEn(p, '#entrar'), false, 'con sesión ya no se ofrece «Entrar»');
    await p.click('[data-hoja="guardadas"]');
    igual(await visibleEn(p, '#salir'), true, '«Salir» está en la pestaña Misas listas');
    await p.click('#salir');
    igual(await esperarTexto(p, '#estado-sync', 'Entrá para ver también las del celular'), 'Entrá para ver también las del celular', 'al salir vuelve a invitar a entrar');
    igual(await p.evaluate((k) => localStorage.getItem(k), CLAVE_CA('sesion_nube_v1')), null, 'y la sesión se borró');
    igual((await nombresListas(p)).length, 2, 'las guardadas locales se quedan');
    await ctx.close();
  }

  console.log(' · una guardada que llega de la nube aparece en la lista');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx, [filaPrueba('cel01', 'Del celular', Date.now() - 60000)]);
    const p = await abrirPanelListas(ctx, Object.assign(sesionPrueba(), yaMigrado()));
    try { await p.waitForSelector('#listas .rapida', { timeout: 6000 }); } catch (e) {}
    igual((await nombresListas(p)).join('|'), 'Del celular', 'la del celular se ve en Preparar');
    igual(await esperarTexto(p, '#estado-sync', 'Sincronizado'), 'Sincronizado', 'la línea dice «Sincronizado»');
    revisar(nube.pedidos.includes('GET /rest/v1/guardadas'), 'se bajó la lista de la nube');
    await p.evaluate(() => { window.__cambiosSync = 0; new MutationObserver((m) => { window.__cambiosSync += m.length; }).observe(document.getElementById('estado-sync'), { childList: true, characterData: true, subtree: true }); });
    await p.evaluate(async () => { await sincronizarGuardadas(); await sincronizarGuardadas(); });
    await p.waitForTimeout(300);
    igual(await p.evaluate(() => window.__cambiosSync), 0, 'dos sincronizaciones más sin cambios no reescriben «Sincronizado» (no se vuelve a anunciar)');
    await ctx.close();
  }

  console.log(' · la sesión vencida que el servidor rechaza dice Se cerró tu sesión');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx);
    const vencida = { [CLAVE_CA('sesion_nube_v1')]: { access: 'acc-viejo', refresh: 'ref-viejo', vence: Date.now() - 1000 } };
    const p = await abrirPanelListas(ctx, Object.assign(vencida, yaMigrado()));
    igual(await esperarTexto(p, '#estado-sync', 'Se cerró tu sesión. Entrá de nuevo para ver las del celular.'), 'Se cerró tu sesión. Entrá de nuevo para ver las del celular.', 'lo dice en la línea de estado');
    igual(await visibleEn(p, '#entrar'), true, 'y ofrece «Entrar con mi cuenta»');
    await ctx.close();
  }

  console.log(' · Cargar con cambios pide confirmación en el diálogo del panel');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx);
    const p = await abrirPanelListas(ctx, { [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000), guardadaPrueba('bbbb2', 'Domingo 30', 3000)] });
    const nativas = [];
    p.on('dialog', (d) => { nativas.push(d.message()); d.dismiss(); });
    const estado = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CLAVE_CA('estado_v1'));
    const sel = (nombre) => `#listas button[aria-label="Cargar «${nombre}»"]`;
    const cargar = async (nombre) => { await p.click(sel(nombre), { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300); };
    const abierto = () => p.evaluate(() => document.getElementById('dialogo-confirmar') ? document.getElementById('dialogo-confirmar').open : false);
    const foco = () => p.evaluate(() => (document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.id)) || '');
    const celebranteGuia = async () => { const e = await estado(); return (e.rotulosTexto || {}).guia && e.rotulosTexto.guia.t; };
    await cargar('Domingo 30');
    // la primera vez no hay con qué comparar (concern 1 de la Tarea 5): puede preguntar
    if (await abierto()) { await p.click('#confirmar-si'); await p.waitForTimeout(300); }
    igual((await estado()).celebrante, 'Pbro. Domingo 30', 'Cargar carga la guardada');
    igual(await esperarTexto(p, '#estado-sync', 'Cargada: Domingo 30', 1000), 'Cargada: Domingo 30', 'y la línea de estado dice «Cargada: Domingo 30»');
    revisar(((await p.textContent(sel('Domingo 30') + ' >> xpath=..')) || '').includes('Usada hoy'), 'la cargada dice «Usada hoy»');
    await cargar('Hora Santa jueves');
    igual(await abierto(), false, 'recién cargada (sin cambios) carga directo, sin preguntar');
    igual((await estado()).celebrante, 'Pbro. Hora Santa jueves', 'y carga la otra');
    igual(await foco(), 'Cargar «Hora Santa jueves»', 'cargada directo, el foco queda en ese «Cargar»');
    await p.fill('#rot-guia-t', 'Juan cambiado');
    await p.waitForTimeout(500);
    await cargar('Domingo 30');
    igual(await abierto(), true, 'con cambios abre el diálogo del panel');
    igual(((await p.textContent('#confirmar-pregunta').catch(() => '')) || '').trim(), 'Lo que cambiaste y no guardaste se va a perder. ¿Cargar Domingo 30 de todas formas?', 'con el texto aprobado');
    igual(((await p.textContent('#confirmar-si').catch(() => '')) || '').trim() + ' / ' + ((await p.textContent('#confirmar-volver').catch(() => '')) || '').trim(), 'Cargar igual / Volver', 'y los botones «Cargar igual» y «Volver»');
    igual(await foco(), 'confirmar-volver', 'el foco entra al diálogo, en «Volver»');
    await revisar44(p, '#dialogo-confirmar button', 'PC, diálogo de cargar: ');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    igual(await abierto(), false, 'Esc cierra el diálogo');
    igual(await celebranteGuia(), 'Juan cambiado', 'Esc cuenta como «Volver»: no carga nada');
    igual(await foco(), 'Cargar «Domingo 30»', 'y el foco vuelve al botón que lo abrió');
    await cargar('Domingo 30');
    await p.click('#confirmar-volver', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(200);
    igual(await celebranteGuia(), 'Juan cambiado', '«Volver» no carga nada');
    igual(await foco(), 'Cargar «Domingo 30»', 'y devuelve el foco al botón');
    await cargar('Domingo 30');
    await p.click('#confirmar-si', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
    igual((await estado()).celebrante, 'Pbro. Domingo 30', '«Cargar igual» carga');
    igual(await esperarTexto(p, '#estado-sync', 'Cargada: Domingo 30', 1000), 'Cargada: Domingo 30', 'y dice «Cargada: Domingo 30»');
    igual(await foco(), 'Cargar «Domingo 30»', 'el foco vuelve al «Cargar» de esa misa');
    igual(nativas.length, 0, 'nunca aparece un confirm() del navegador');
    await ctx.close();
  }

  console.log(' · entrar: el servidor falla, el botón siempre se repone, el error vacío no deja hueco');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx, [], { estadoToken: 503 });
    const p = await abrirPanelListas(ctx, {});
    await p.click('#entrar', { timeout: 3000 });
    igual(await p.evaluate(() => { const e = document.getElementById('entrar-error'); return e.textContent === '' && e.getClientRects().length === 0; }), true, 'el error vacío no ocupa lugar');
    await p.fill('#entrar-correo', 'coordinador@ejemplo.org');
    await p.fill('#entrar-clave', 'clave-buena');
    await p.click('#entrar-boton');
    igual(await esperarTexto(p, '#entrar-error', 'No se pudo entrar. Probá de nuevo en un rato.'), 'No se pudo entrar. Probá de nuevo en un rato.', 'con un 503 lo dice (hay red)');
    igual(await p.evaluate(() => document.getElementById('entrar-error').getClientRects().length > 0), true, 'y el error se ve');
    // entrar que no termina: al cerrar y volver a abrir, el botón está repuesto
    await p.evaluate(() => { window.entrarGuardadas = () => new Promise(() => {}); });
    await p.fill('#entrar-clave', 'clave-buena');
    await p.click('#entrar-boton');
    igual(await esperarTexto(p, '#entrar-boton', 'Entrando…', 1000), 'Entrando…', 'mientras entra dice «Entrando…»');
    await p.click('#entrar-cancelar');
    await p.click('#entrar', { timeout: 3000 });
    igual(((await p.textContent('#entrar-boton')) || '').trim() + ' ' + (await p.isDisabled('#entrar-boton')), 'Entrar false', 'al volver a abrir, el botón dice «Entrar» y está habilitado');
    igual(await p.evaluate(() => document.getElementById('entrar-error').textContent), '', 'y sin el error anterior');
    // entrar que falla con una excepción: el botón se repone igual (finally)
    await p.evaluate(() => { window.entrarGuardadas = () => Promise.reject(new Error('roto a propósito')); });
    await p.fill('#entrar-clave', 'clave-buena');
    await p.click('#entrar-boton');
    await p.waitForTimeout(300);
    igual(((await p.textContent('#entrar-boton')) || '').trim() + ' ' + (await p.isDisabled('#entrar-boton')), 'Entrar false', 'si entrar se rompe, el botón vuelve a «Entrar» y se habilita');
    igual(((await p.textContent('#entrar-error')) || '').trim(), 'No se pudo entrar. Probá de nuevo en un rato.', 'y lo dice como un error del servidor');
    igual(errores.filter((e) => e.includes('roto a propósito')).length, 0, 'la excepción no queda sin atender en la página');
    await ctx.close();
  }

  console.log(' · Reemplazar y Borrar preguntan en el diálogo del panel');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx);
    const p = await abrirPanelListas(ctx, { [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000)] });
    const nativas = [];
    p.on('dialog', (d) => { nativas.push(d.message()); d.dismiss(); });
    const abierto = () => p.evaluate(() => document.getElementById('dialogo-confirmar').open);
    const foco = () => p.evaluate(() => (document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.id)) || '');
    const nombres = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]').map((g) => g.nombre), CLAVE_CA('guardadas_v1'));
    const textos = async () => ((await p.textContent('#confirmar-pregunta')) || '').trim() + ' | ' + ((await p.textContent('#confirmar-si')) || '').trim() + ' / ' + ((await p.textContent('#confirmar-volver')) || '').trim();
    await p.click('[data-hoja="guardadas"]');
    await p.fill('#guardar-nombre', 'hora santa jueves');
    await p.click('#guardar-boton');
    igual(await abierto(), true, 'un nombre que ya existe abre el diálogo del panel');
    igual(await textos(), 'Ya existe «hora santa jueves». ¿Reemplazarla? | Reemplazar / Volver', 'con la pregunta de siempre y «Reemplazar» / «Volver»');
    igual(await foco(), 'confirmar-volver', 'el foco entra en «Volver»');
    await revisar44(p, '#dialogo-confirmar button', 'PC, diálogo de reemplazar: ');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    igual(await abierto(), false, 'Esc lo cierra');
    igual((await nombres()).join('|'), 'Hora Santa jueves', 'Esc no reemplaza');
    igual(await foco(), 'guardar-boton', 'y el foco vuelve a «Guardar»');
    await p.click('#guardar-boton');
    await p.click('#confirmar-si');
    await p.waitForTimeout(200);
    igual((await nombres()).join('|'), 'hora santa jueves', '«Reemplazar» reemplaza');
    igual(await foco(), 'guardar-boton', 'y el foco vuelve a «Guardar»');
    const borrar = '#lista-guardadas button[aria-label="Borrar «hora santa jueves»"]';
    await p.click(borrar);
    igual(await abierto(), true, '«Borrar» abre el diálogo del panel');
    igual(await textos(), '¿Borrar «hora santa jueves»? | Borrar / Volver', 'con «Borrar» / «Volver»');
    igual(await foco(), 'confirmar-volver', 'el foco entra en «Volver»');
    await p.click('#confirmar-volver');
    await p.waitForTimeout(200);
    igual((await nombres()).length, 1, '«Volver» no borra');
    igual(await foco(), 'Borrar «hora santa jueves»', 'y el foco vuelve a ese «Borrar»');
    await p.click(borrar);
    await p.click('#confirmar-si');
    await p.waitForTimeout(200);
    igual((await nombres()).length, 0, '«Borrar» borra');
    igual(await foco(), 'titulo-guardadas', 'y el foco va al título de la lista');
    igual(nativas.length, 0, 'nunca aparece un confirm() del navegador');
    await ctx.close();
  }

  console.log(' · en modo app se ve la pestaña Misas listas y no el aviso de Entrar');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx);
    const valores = Object.assign({ [CLAVE_CA('panel_hoja')]: 'guardadas', [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000)] }, sesionPrueba());
    const app = await abrirPanelListas(ctx, valores, { ancho: 844, alto: 390, app: true });
    await app.waitForTimeout(800);
    for (const sel of ['#tab-guardadas', '#hoja-guardadas']) igual(await visibleEn(app, sel), true, 'modo-app: ' + sel + ' se ve');
    igual(await app.evaluate(() => document.getElementById('hoja-guardadas').classList.contains('activa')), true, 'modo-app: abre la hoja Misas listas recordada');
    igual(((await app.textContent('#tab-guardadas')) || '').trim(), 'Misas listas', 'modo-app: la pestaña se llama «Misas listas» (con el mismo id)');
    for (const sel of ['#entrar', '#salir', '#dialogo-entrar']) igual(await visibleEn(app, sel), false, 'modo-app: ' + sel + ' no se ve');
    revisar(!(await app.textContent('body')).includes('Entrá para ver'), 'modo-app: no invita a entrar');
    igual(nube.pedidos.length, 0, 'modo-app: el panel no habla con la nube (aunque haya una sesión guardada)');
    await app.click('[data-hoja="preparar"]');
    igual(await visibleEn(app, '#sec-listas'), true, 'modo-app: Misas listas se ve en Preparar');
    igual(await visibleEn(app, '#guardar-esta'), true, 'modo-app: #guardar-esta se ve');
    igual((await nombresListas(app)).join('|'), 'Hora Santa jueves', 'modo-app: con la guardada');
    for (const b of await app.locator('#listas button, #guardar-esta, [data-hoja]').all()) {
      const caja = await b.boundingBox();
      if (caja) revisar(caja.height >= 44, 'modo-app: botón de 44 px o más (' + ((await b.getAttribute('aria-label')) || (await b.textContent()).trim()) + ': ' + caja.height + ')');
    }
    const medidas = await app.evaluate(() => [...document.querySelectorAll('.pestanas [data-hoja]')].map((b) => b.getBoundingClientRect().width));
    revisar(medidas.length === 3 && Math.max(...medidas) - Math.min(...medidas) <= 1, 'modo-app: las tres pestañas miden lo mismo (' + medidas.join(', ') + ')');
    await ctx.close();

    const ctx2 = await nuevoContexto();
    await nubeDePrueba(ctx2);
    const pc = await abrirPanelListas(ctx2, {});
    igual(await visibleEn(pc, '#tab-guardadas'), true, 'en la PC la pestaña Misas listas se ve');
    await ctx2.close();
  }

  console.log(' · dos paneles abiertos suben el pendiente una sola vez');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx, [], { demoraSubida: 400 });
    const valores = Object.assign({
      [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000)],
      [CLAVE_CA('guardadas_pendientes_v1')]: [{ op: 'guardar', id: 'aaaa1', cuando: 2000 }]
    }, sesionPrueba(), yaMigrado());
    const [a, b] = await Promise.all([abrirPanelListas(ctx, valores), abrirPanelListas(ctx, valores)]);
    await a.waitForTimeout(8000);   // el que encuentra el candado vuelve a probar a los 5 s
    igual(nube.subidas.length, 1, 'el pendiente subió una sola vez');
    igual(await a.evaluate((k) => localStorage.getItem(k), CLAVE_CA('guardadas_pendientes_v1')), '[]', 'y la cola quedó vacía');
    igual(await esperarTexto(b, '#estado-sync', 'Sincronizado'), 'Sincronizado', 'el otro panel también queda «Sincronizado»');
    igual(await esperarTexto(a, '#estado-sync', 'Sincronizado'), 'Sincronizado', 'y el primero también');
    await ctx.close();
  }

  const TXT_RECH_1 = '1 misa no se pudo guardar en la nube. Sigue en esta computadora.';
  const TXT_RECH_2 = '2 misas no se pudieron guardar en la nube. Siguen en esta computadora.';
  const TXT_FILA_RECH = 'No se guardó en la nube';
  const metaDe = (p, sel, nombre) => p.evaluate(([s, n]) => {
    const f = [...document.querySelectorAll(s)].find((x) => x.querySelector('.nom') && x.querySelector('.nom').textContent === n);
    return f ? f.querySelector('.meta').textContent : null;
  }, [sel, nombre]);

  console.log(' · una misa que la nube rechazó se ve: en su fila y en la línea, en lugar de Sincronizado');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx, [filaPrueba('bbbb2', 'Domingo 30', Date.now() - 60000)]);
    const valores = Object.assign({
      [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000)],
      [CLAVE_CA('guardadas_pendientes_v1')]: [{ op: 'guardar', id: 'aaaa1', cuando: 2000, rechazado: true }]
    }, sesionPrueba(), yaMigrado());
    const p = await abrirPanelListas(ctx, valores);
    try { await p.waitForFunction(() => document.querySelectorAll('#listas .rapida').length === 2, null, { timeout: 6000 }); } catch (e) {}
    igual((await nombresListas(p)).length, 2, 'ya se sincronizó (llegó la de la nube)');
    igual(await esperarTexto(p, '#estado-sync', TXT_RECH_1), TXT_RECH_1, 'la línea lo dice en singular');
    igual(await p.evaluate(() => document.getElementById('estado-sync').classList.contains('aviso-sync')), true, 'como aviso');
    igual(await metaDe(p, '#listas .rapida', 'Hora Santa jueves'), TXT_FILA_RECH, 'la fila rechazada dice «No se guardó en la nube»');
    revisar(((await metaDe(p, '#listas .rapida', 'Domingo 30')) || '').startsWith('Guardada '), 'la otra sigue diciendo «Guardada …»');
    revisar(((await metaDe(p, '#lista-guardadas .guardada', 'Hora Santa jueves')) || '').endsWith(TXT_FILA_RECH), 'también en la pestaña Misas listas');
    await p.evaluate(() => { window.__cambiosSync = 0; new MutationObserver((m) => { window.__cambiosSync += m.length; }).observe(document.getElementById('estado-sync'), { childList: true, characterData: true, subtree: true }); });
    await p.evaluate(async () => { await sincronizarGuardadas(); await sincronizarGuardadas(); });
    await p.waitForTimeout(300);
    igual(await p.evaluate(() => window.__cambiosSync), 0, 'dos sincronizaciones más no reescriben el aviso');
    // otra más rechazada: el plural (la cola cambia sin que cambie la lista)
    await p.evaluate(([kl, kp]) => {
      const l = JSON.parse(localStorage.getItem(kl)); const g = Object.assign({}, l[0], { id: 'cccc3', nombre: 'Novena' });
      localStorage.setItem(kl, JSON.stringify(l.concat(g)));
      localStorage.setItem(kp, JSON.stringify(JSON.parse(localStorage.getItem(kp)).concat({ op: 'guardar', id: 'cccc3', cuando: 3000, rechazado: true })));
      return sincronizarGuardadas();
    }, [CLAVE_CA('guardadas_v1'), CLAVE_CA('guardadas_pendientes_v1')]);
    igual(await esperarTexto(p, '#estado-sync', TXT_RECH_2), TXT_RECH_2, 'con dos, en plural');
    await ctx.close();
  }

  console.log(' · en la app, lo rechazado que marca lo nativo también se ve');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx);
    const valores = {
      [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000)],
      [CLAVE_CA('guardadas_pendientes_v1')]: [{ op: 'guardar', id: 'aaaa1', cuando: 2000 }]
    };
    const app = await abrirPanelListas(ctx, valores, { ancho: 844, alto: 390, app: true });
    igual(((await app.textContent('#estado-sync')) || '').trim(), '', 'modo-app: sin rechazadas la línea no dice nada');
    // lo que hace scriptPonerGuardadas (app/src/guardadas/puente.ts): marca la cola y llama a pintarGuardadas
    await app.evaluate((kp) => { localStorage.setItem(kp, JSON.stringify([{ op: 'guardar', id: 'aaaa1', cuando: 2000, rechazado: true }])); window.pintarGuardadas(); }, CLAVE_CA('guardadas_pendientes_v1'));
    igual(await esperarTexto(app, '#estado-sync', TXT_RECH_1, 1000), TXT_RECH_1, 'modo-app: la línea lo dice');
    igual(await metaDe(app, '#listas .rapida', 'Hora Santa jueves'), TXT_FILA_RECH, 'modo-app: y la fila también');
    await ctx.close();
  }

  console.log(' · un 403 de la nube cierra la sesión y deja la cola (no rechaza)');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx, [], { estadoSubida: 403 });
    const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 2000 }];
    const p = await abrirPanelListas(ctx, Object.assign({ [CLAVE_CA('guardadas_v1')]: [guardadaPrueba('aaaa1', 'Hora Santa jueves', 2000)], [CLAVE_CA('guardadas_pendientes_v1')]: pend }, sesionPrueba(), yaMigrado()));
    igual(await esperarTexto(p, '#estado-sync', 'Se cerró tu sesión. Entrá de nuevo para ver las del celular.'), 'Se cerró tu sesión. Entrá de nuevo para ver las del celular.', 'dice que se cerró la sesión');
    igual(await p.evaluate((k) => localStorage.getItem(k), CLAVE_CA('guardadas_pendientes_v1')), JSON.stringify(pend), 'la cola queda igual, sin rechazado');
    revisar(((await metaDe(p, '#listas .rapida', 'Hora Santa jueves')) || '').startsWith('Guardada '), 'y la fila no dice «No se guardó»');
    await ctx.close();
  }

  console.log(' · Cancelar mientras entra: la sesión que llega después no queda');
  {
    const ctx = await nuevoContexto();
    const nube = await nubeDePrueba(ctx, [], { demoraToken: 800 });
    const p = await abrirPanelListas(ctx, {});
    await p.click('#entrar', { timeout: 3000 });
    await p.fill('#entrar-correo', 'coordinador@ejemplo.org');
    await p.fill('#entrar-clave', 'clave-buena');
    await p.click('#entrar-boton');
    await p.click('#entrar-cancelar');
    await p.waitForTimeout(1500);
    igual(await p.evaluate((k) => localStorage.getItem(k), CLAVE_CA('sesion_nube_v1')), null, 'no queda la sesión');
    igual(await visibleEn(p, '#entrar'), true, '«Entrar con mi cuenta» sigue a la vista');
    igual(await p.evaluate(() => document.getElementById('dialogo-entrar').open), false, 'el diálogo sigue cerrado');
    igual(((await p.textContent('#estado-sync')) || '').trim(), 'Entrá para ver también las del celular', 'y la línea sigue invitando a entrar');
    revisar(!nube.pedidos.includes('GET /rest/v1/guardadas'), 'no sincronizó');
    await ctx.close();
  }

  console.log(' · Salir deja el foco en el título de Misas listas');
  {
    const ctx = await nuevoContexto();
    await nubeDePrueba(ctx);
    const p = await abrirPanelListas(ctx, Object.assign(sesionPrueba(), yaMigrado()));
    await p.click('[data-hoja="guardadas"]');
    await p.click('#salir');
    igual(await p.evaluate(() => document.activeElement && document.activeElement.id), 'titulo-guardadas', 'el foco va a #titulo-guardadas');
    await ctx.close();
  }
}

/* Los tres diseños nuevos (Tarjeta, Minimal, Etiqueta): colores, contraste, entrada y salida, cambio en vivo y nombre largo. */
async function casoRotulosDisenos() {
  console.log('Rótulos · diseños Tarjeta, Minimal y Etiqueta');
  fs.mkdirSync(path.join(CAPTURAS, 'disenos'), { recursive: true });
  const ACENTO = 'rgb(217, 164, 65)', BLANCO = 'rgb(255, 255, 255)';
  const abrirCon = async (rotulos, estado) => {
    const ctx = await nuevoContexto();
    await ctx.route(rutaConfig, servirConfig(conBloques((c) => { c.colores.acento = '#d9a441'; c.rotulos = rotulos; })));
    const r = await abrir(ctx, `/${CA}/rotulos.html`, 1920, 1080, estadoCA(Object.assign({ tipo: 'semana', rotulo: 'persona', celebrante: 'Pbro. José Martínez', mostrarEnVivo: true, mostrarLogo: true }, estado)));
    await r.waitForSelector('#rotulo.en');
    await r.waitForTimeout(1600);
    return { ctx, r };
  };
  const css = (r) => r.evaluate(() => {
    const cs = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo || null);
    return {
      oscuro: getComputedStyle(document.documentElement).getPropertyValue('--oscuro').trim(),
      ladoDisplay: cs('#rotulo .lado').display, radio: cs('#rotulo').borderRadius,
      fondo: cs('#rotulo .cuerpo').backgroundColor, lineaIzq: cs('#rotulo .cuerpo').borderLeftColor,
      kFondo: cs('#r-k').backgroundColor, kColor: cs('#r-k').color, tColor: cs('#r-t').color, punto: cs('#r-s', '::before').backgroundColor,
      clases: [...document.getElementById('escenario').classList].filter((x) => /^diseno-/.test(x)).join(' ')
    };
  });
  const rgb = (hex) => 'rgb(' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';

  // Tarjeta
  let { ctx, r } = await abrirCon({ diseno: 'tarjeta' });
  let m = await css(r);
  const OSCURO = rgb(m.oscuro);
  igual(m.clases, 'diseno-tarjeta', 'tarjeta: clase en el escenario');
  igual(m.ladoDisplay, 'none', 'tarjeta: sin franja ni logo');
  igual(m.fondo, BLANCO, 'tarjeta: la tarjeta es blanca');
  igual(m.kFondo, ACENTO, 'tarjeta: la píldora de la ceja es la línea de acento');
  igual(m.kColor, OSCURO, 'tarjeta: sobre un acento claro, el texto de la píldora va oscuro');
  igual(m.punto, rgb('#1155a4'), 'tarjeta: sin colorLado, el punto del subtítulo es el color principal');
  await captura(r, 'disenos/tarjeta_izquierda');
  await ctx.close();
  ({ ctx, r } = await abrirCon({ diseno: 'tarjeta', colorLado: 'blanco', colorLinea: 'oscuro' }));
  m = await css(r);
  igual(m.punto, OSCURO, 'tarjeta: con un fondo claro, el punto es oscuro (no blanco sobre blanco)');
  igual(m.kColor, BLANCO, 'tarjeta: sobre una línea oscura, el texto de la píldora va blanco');
  await ctx.close();

  // Review final 2: la primera vez que aparece una tipografía nueva, la fuente todavía no cargó y ajustarTexto mide con la
  // de reserva. Al cargar, el nombre se vuelve a medir: queda del mismo tamaño que al volver a pintar, y no se corta.
  ({ ctx, r } = await abrirCon({ tipografia: 'cinzel' }, { celebrante: 'Que te alaben, Señor, todos los pueblos, que todos los pueblos te alaben' }));
  const medida = await r.evaluate(async () => {
    const t = document.getElementById('r-t');
    const antes = { tam: t.style.fontSize, corta: t.scrollWidth > t.clientWidth + 1 };
    pintar(leerEstado());
    return { antes, despues: t.style.fontSize };
  });
  igual(medida.antes.tam, medida.despues, 'cinzel: con la fuente ya cargada, el nombre se midió de nuevo');
  revisar(!medida.antes.corta, 'cinzel: el nombre largo no se corta la primera vez');
  await ctx.close();

  // Minimal
  ({ ctx, r } = await abrirCon({ diseno: 'minimal', esquinas: 'redondas' }));
  m = await css(r);
  igual(m.clases, 'diseno-minimal', 'minimal: clase en el escenario');
  igual(m.ladoDisplay, 'none', 'minimal: sin franja ni logo');
  igual(m.fondo, 'rgba(0, 0, 0, 0)', 'minimal: sin caja');
  igual(m.tColor, BLANCO, 'minimal: el nombre va en blanco');
  igual(m.lineaIzq, ACENTO, 'minimal: la línea vertical es la línea de acento');
  igual(m.radio, '0px', 'minimal: las esquinas no aplican (aunque pida redondas)');
  await captura(r, 'disenos/minimal_izquierda');
  await ctx.close();

  // Etiqueta
  ({ ctx, r } = await abrirCon({ diseno: 'etiqueta' }));
  m = await css(r);
  igual(m.clases, 'diseno-etiqueta', 'etiqueta: clase en el escenario');
  igual(m.ladoDisplay, 'none', 'etiqueta: sin franja ni logo');
  igual(m.fondo, OSCURO, 'etiqueta: sin colorLado, la caja es del color oscuro');
  igual(m.kFondo, ACENTO, 'etiqueta: la pestaña es la línea de acento');
  igual(m.kColor, OSCURO, 'etiqueta: sobre un acento claro, el texto de la pestaña va oscuro');
  igual(m.tColor, BLANCO, 'etiqueta: el nombre va en blanco sobre la caja oscura');
  const cajaYPestana = await r.evaluate(() => { const a = document.getElementById('rotulo').getBoundingClientRect(); const k = document.getElementById('r-k').getBoundingClientRect(); return k.top >= a.top - 1 && k.bottom <= document.querySelector('#rotulo .cuerpo').getBoundingClientRect().top + 1; });
  revisar(cajaYPestana, 'etiqueta: la pestaña va encima de la caja y dentro del rótulo');
  await captura(r, 'disenos/etiqueta_izquierda');
  // Review final 3: «primero entra la pestaña y después se despliega la caja». A los 150 ms (la caja empieza a los
  // 220 ms) la pestaña ya se ve: el clip-path de la caja no la tapa (clip-path también corta el hit-test).
  const pestanaPrimero = await r.evaluate(() => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = 150; }
    const k = document.getElementById('r-k').getBoundingClientRect();
    const el = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
    return !!(el && el.closest('#r-k'));
  });
  revisar(pestanaPrimero, 'etiqueta: a los 150 ms la pestaña ya se ve, antes que la caja');
  await ctx.close();
  ({ ctx, r } = await abrirCon({ diseno: 'etiqueta', colorLado: 'blanco', colorLinea: 'principal' }));
  m = await css(r);
  igual(m.tColor, OSCURO, 'etiqueta: con un fondo claro, el nombre va oscuro');
  igual(m.kColor, BLANCO, 'etiqueta: sobre una línea oscura, el texto de la pestaña va blanco');
  await ctx.close();
  ({ ctx, r } = await abrirCon({ diseno: 'etiqueta', colorLado: '#7a3b12' }));
  igual((await css(r)).fondo, 'rgb(122, 59, 18)', 'etiqueta: la caja usa el «Fondo del rótulo»');
  await ctx.close();

  // Entrada y salida de cada diseño; cambiar de diseño con el rótulo en pantalla
  for (const diseno of ['tarjeta', 'minimal', 'etiqueta']) {
    ({ ctx, r } = await abrirCon({ diseno }));
    await r.evaluate(() => pintar(Object.assign({}, estado, { rotulo: 'ninguno' })));
    revisar(await r.evaluate(() => document.getElementById('rotulo').classList.contains('sale')), diseno + ': al sacar el rótulo, sale');
    await r.waitForTimeout(500);
    const resto = await r.evaluate(() => ['en', 'sale'].filter((c) => document.getElementById('rotulo').classList.contains(c)).join(' '));
    igual(resto, '', diseno + ': después de salir no queda ni .en ni .sale');
    await ctx.close();
  }
  ({ ctx, r } = await abrirCon({}));
  await r.evaluate(() => { PARROQUIA = Object.assign({}, PARROQUIA, { rotulos: { diseno: 'etiqueta' } }); aplicarParroquia(PARROQUIA); });
  await r.waitForTimeout(200);
  igual(await r.evaluate(() => ['en', 'sale'].filter((c) => document.getElementById('rotulo').classList.contains(c)).join(' ')), 'en', 'cambiar de diseño con el rótulo en pantalla: sigue en pantalla, sin salir');
  igual((await css(r)).clases, 'diseno-etiqueta', 'cambiar de diseño con el rótulo en pantalla: toma el diseño nuevo');
  const otro = await r.evaluate(() => rotulosDe(estado).map((x) => x.id).find((id) => id !== 'persona'));
  await r.evaluate((id) => pintar(Object.assign({}, estado, { rotulo: id })), otro);
  await r.waitForTimeout(1500);
  igual(await r.evaluate(() => [...document.getElementById('rotulo').classList].filter((c) => c === 'en' || c === 'sale').join(' ')), 'en', 'después, cambiar a otro rótulo (' + otro + ') sale y entra el nuevo');
  await ctx.close();

  // Nombre largo con Cinzel en los 4 diseños × los 4 lugares
  for (const diseno of ['clasico', 'tarjeta', 'minimal', 'etiqueta']) {
    for (const posicion of ['izquierda', 'centro', 'derecha', 'arriba-derecha']) {
      ({ ctx, r } = await abrirCon({ diseno, posicion, tipografia: 'cinzel' }, { celebrante: 'Excmo. Mons. José Luis Escobar Alas' }));
      await r.evaluate(() => document.fonts.ready);
      const g = await r.evaluate(() => {
        const visible = (e) => { for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden' || n.classList.contains('oculto')) return false; } return true; };
        const b = document.getElementById('rotulo').getBoundingClientRect();
        const t = document.getElementById('r-t');
        const choca = (id) => { const e = document.getElementById(id); if (!visible(e)) return false; const o = e.getBoundingClientRect(); return o.width > 0 && !(o.right <= b.left || o.left >= b.right || o.bottom <= b.top || o.top >= b.bottom); };
        return { dentro: b.left >= 0 && b.top >= 0 && b.right <= 1920 && b.bottom <= 1080, cortado: t.scrollWidth > t.clientWidth, logo: choca('logo-esquina'), envivo: choca('envivo') };
      });
      const n = diseno + ' ' + posicion + ' (Cinzel, nombre largo)';
      revisar(g.dentro, n + ': entra en 1920×1080');
      revisar(!g.cortado, n + ': el nombre no se corta');
      revisar(!g.logo && !g.envivo, n + ': no pisa el logo de la esquina ni EN VIVO');
      if (diseno !== 'clasico') await captura(r, 'disenos/' + diseno + '_' + posicion);
      await ctx.close();
    }
  }
}

/* El rótulo Clásico (sin rotulos.diseno) tiene que verse igual al píxel que antes de los diseños de rótulo.
   Con --grabar-clasico escribe las capturas de referencia en clasico-referencia/ (se graban una vez, sobre el código
   sin cambios); sin la marca compara byte a byte y, si difiere, deja la captura nueva en capturas/vicaria/clasico-diferente/. */
async function casoClasicoIgual() {
  const grabar = process.argv.includes('--grabar-clasico');
  console.log('Rótulo Clásico igual al de antes' + (grabar ? ' (grabando)' : ''));
  const carpeta = path.join(__dirname, 'clasico-referencia');
  const diferentes = path.join(CAPTURAS, 'clasico-diferente');
  fs.mkdirSync(grabar ? carpeta : diferentes, { recursive: true });
  for (const slug of [CA, SJ]) {
    for (const posicion of ['izquierda', 'centro']) {
      const nombre = slug + '_' + posicion + '.png';
      const cfg = JSON.parse(JSON.stringify(CONFIG[slug]));
      cfg.rotulos = Object.assign({}, cfg.rotulos, { posicion });
      const ctx = await nuevoContexto();
      await ctx.route(rutaConfig, servirConfig(cfg));
      const p = await abrir(ctx, `/${slug}/rotulos.html`, 1920, 1080, async (pg) => {
        await pg.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
        await pg.addInitScript(([k, v]) => localStorage.setItem(k, v),
          [`pev_${slug}_estado_v1`, JSON.stringify({ tipo: 'dominical', rotulo: 'persona', celebrante: 'Pbro. José Martínez' })]);
      });
      await p.waitForSelector('#rotulo.en');
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(1500);
      const png = await p.screenshot({ animations: 'disabled' });
      await ctx.close();
      if (grabar) { fs.writeFileSync(path.join(carpeta, nombre), png); console.log('  grabada ' + nombre); continue; }
      const ref = path.join(carpeta, nombre);
      const igualA = fs.existsSync(ref) && Buffer.compare(fs.readFileSync(ref), png) === 0;
      if (!igualA) fs.writeFileSync(path.join(diferentes, nombre), png);
      revisar(igualA, 'Clásico ' + slug + ' ' + posicion + ': igual a la referencia' + (igualA ? '' : ' (nueva en capturas/vicaria/clasico-diferente/' + nombre + ')'));
    }
  }
}

/* Compara dos PNG del mismo tamaño en una página: cuántos píxeles difieren poco (> 8 en algún canal) y mucho (> 32). */
async function difPixeles(a, b) {
  const pg = await browser.newPage();
  const r = await pg.evaluate(async ([x, y]) => {
    const leer = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
      g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const p = await leer(x), q = await leer(y);
    if (p.length !== q.length) return { leves: Infinity, fuertes: Infinity };
    let leves = 0, fuertes = 0;
    for (let i = 0; i < p.length; i += 4) {
      const m = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2]), Math.abs(p[i + 3] - q[i + 3]));
      if (m > 32) fuertes++; else if (m > 8) leves++;
    }
    return { leves, fuertes };
  }, [a.toString('base64'), b.toString('base64')]);
  await pg.close();
  return r;
}

/* Las pantallas sin estiloPantallas, tamanos ni encuadre tienen que verse igual al píxel que antes de esta obra.
   Con --grabar-pantallas escribe las capturas de referencia en pantallas-referencia/ (una vez, sobre el código sin
   cambios); sin la marca compara byte a byte y, si difiere, deja la nueva en capturas/vicaria/pantallas-diferente/. */
async function casoPantallasIgual() {
  const grabar = process.argv.includes('--grabar-pantallas');
  console.log('Pantallas iguales a las de antes' + (grabar ? ' (grabando)' : ''));
  const carpeta = path.join(__dirname, 'pantallas-referencia');
  const diferentes = path.join(CAPTURAS, 'pantallas-diferente');
  fs.mkdirSync(grabar ? carpeta : diferentes, { recursive: true });
  for (const slug of [CA, SJ]) {
    for (const tipo of ['inicio', 'portada', 'gracias', 'avisos', 'horarios']) {
      const nombre = slug + '_' + tipo + '.png';
      const ctx = await nuevoContexto();
      const p = await abrir(ctx, `/${slug}/pantalla.html?tipo=${tipo}`, 1920, 1080, async (pg) => {
        await pg.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
        await pg.addInitScript(([k, v]) => localStorage.setItem(k, v),
          [`pev_${slug}_estado_v1`, JSON.stringify({ tipo: 'dominical' })]);
        // Las chispas usan Math.random: con una semilla fija salen siempre en el mismo lugar.
        await pg.addInitScript(() => { let s = 7; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; });
      });
      await p.waitForLoadState('networkidle');
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(1800);
      const png = await p.screenshot({ animations: 'disabled' });
      await ctx.close();
      if (grabar) { fs.writeFileSync(path.join(carpeta, nombre), png); console.log('  grabada ' + nombre); continue; }
      const ref = path.join(carpeta, nombre);
      // Byte a byte no sirve acá: el borde suavizado de los rayos y del arco cambia unos pocos píxeles (≤ 12/255)
      // entre corridas. Se acepta ese ruido; un cambio real (letra, tamaño, posición) mueve miles de píxeles.
      const d = fs.existsSync(ref) ? await difPixeles(fs.readFileSync(ref), png) : null;
      const igualA = !!d && d.fuertes === 0 && d.leves <= 200;
      if (!igualA) fs.writeFileSync(path.join(diferentes, nombre), png);
      revisar(igualA, 'Pantalla ' + slug + ' ' + tipo + ': igual a la referencia' + (igualA ? '' : ' (' + (d ? d.fuertes + ' píxeles muy distintos, ' + d.leves + ' leves' : 'sin referencia') + '; nueva en capturas/vicaria/pantallas-diferente/' + nombre + ')'));
    }
  }
}

/* Estilo de todas las pantallas (estiloPantallas), tamaño de los textos (tamanos) y su techo. */
async function casoEstiloPantallas() {
  console.log('Pantallas · letras, logo y tamaños');
  fs.mkdirSync(path.join(CAPTURAS, 'estilo-pantallas'), { recursive: true });
  const abrirCon = async (cambios, tipo, estado) => {
    const ctx = await nuevoContexto();
    await ctx.route(rutaConfig, servirConfig(conBloques(cambios)));
    const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=${tipo}`, 1920, 1080, estadoCA(Object.assign({ tipo: 'dominical' }, estado || {})));
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(1200);
    return { ctx, p };
  };
  const familia = (p, sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).fontFamily, sel);
  const alto = (p, sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().height / (document.getElementById('escenario').getBoundingClientRect().height / 1080), sel);

  // Letras
  let { ctx, p } = await abrirCon((c) => { c.estiloPantallas = { letraTitulo: 'cinzel', letraFrase: 'oswald' }; }, 'inicio');
  revisar((await familia(p, '#i-titulo')).startsWith('Cinzel'), 'letraTitulo cinzel: el título de Inicio va en Cinzel (' + await familia(p, '#i-titulo') + ')');
  revisar((await familia(p, '#i-cursiva')).startsWith('Oswald'), 'letraFrase oswald: la frase va en Oswald');
  revisar((await familia(p, '#i-ceja')).startsWith('Mont'), 'la ceja sigue en Montserrat');
  revisar((await familia(p, '#i-pildora')).startsWith('Mont'), 'la píldora sigue en Montserrat');
  revisar((await familia(p, '#t-marca')).startsWith('Mont'), 'la marca sigue en Montserrat');
  igual(await p.evaluate(() => getComputedStyle(document.getElementById('i-titulo').parentNode).textTransform), 'uppercase', 'el título sigue en mayúsculas');
  await captura(p, 'estilo-pantallas/cinzel_oswald_inicio');
  await ctx.close();
  for (const tipo of ['avisos', 'horarios']) {
    ({ ctx, p } = await abrirCon((c) => { c.estiloPantallas = { letraTitulo: 'cinzel' }; }, tipo));
    const sel = tipo === 'avisos' ? '#a-titulo' : '#h-titulo';
    revisar((await familia(p, sel)).startsWith('Cinzel'), tipo + ': el título de la tarjeta va en Cinzel');
    await ctx.close();
  }

  // Logo
  ({ ctx, p } = await abrirCon(() => {}, 'inicio'));
  const normal = await alto(p, '#marca-logo');
  await ctx.close();
  ({ ctx, p } = await abrirCon((c) => { c.estiloPantallas = { logo: 'grande' }; }, 'inicio'));
  const grande = await alto(p, '#marca-logo');
  await captura(p, 'estilo-pantallas/logo_grande');
  await ctx.close();
  ({ ctx, p } = await abrirCon((c) => { c.estiloPantallas = { logo: 'chico' }; }, 'inicio'));
  const chico = await alto(p, '#marca-logo');
  await ctx.close();
  revisar(Math.abs(normal - 70) < 1, 'logo normal: 70 px (' + normal.toFixed(1) + ')');
  revisar(grande > 70 && chico < 70, 'logo grande más alto y chico más bajo (' + chico.toFixed(1) + ' / ' + grande.toFixed(1) + ')');
  ({ ctx, p } = await abrirCon((c) => { c.estiloPantallas = { logo: 'grande' }; }, 'avisos'));
  const circulo = await p.evaluate(() => { const e = document.querySelector('#a-logo img') || document.getElementById('a-logo'); return e.getBoundingClientRect().height; });
  await ctx.close();
  ({ ctx, p } = await abrirCon(() => {}, 'avisos'));
  const circuloAntes = await p.evaluate(() => { const e = document.querySelector('#a-logo img') || document.getElementById('a-logo'); return e.getBoundingClientRect().height; });
  await ctx.close();
  revisar(Math.abs(circulo - circuloAntes) < 0.5, 'avisos: el logo del círculo no cambia con logo grande');

  // Tamaños de los textos (tamanos) y su techo
  const tam = (p, sel) => p.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), sel);
  const cabe = (p, vistaSel) => p.evaluate((s) => {
    const v = document.querySelector(s);
    const anchos = [...v.querySelectorAll('h1, .cursiva')].filter((e) => e.offsetParent !== null).every((e) => e.scrollWidth <= e.clientWidth + 1);
    return anchos && !seSale(v, parseFloat(getComputedStyle(v).paddingBottom) || 0);
  }, vistaSel);
  const pant = (vista, extra) => (c) => { c.pantallas = Object.assign({}, c.pantallas, { [vista]: Object.assign({ modo: 'personalizada' }, extra) }); };
  ({ ctx, p } = await abrirCon(pant('inicio', { tamanos: { titulo: 'grande', frase: 'chico' } }), 'inicio', { textos: { inicio_titulo: 'MISA', inicio_cursiva: 'Hoy' } }));
  const tg = await tam(p, '#i-titulo'); const fc = await tam(p, '#i-cursiva');
  revisar(Math.abs(tg - 104 * 1.15) <= 1, 'inicio título grande: 115 % de 104 (' + tg.toFixed(1) + ')');
  revisar(Math.abs(fc - 54 * 0.85) <= 1, 'inicio frase chica: 85 % de 54 (' + fc.toFixed(1) + ')');
  await ctx.close();
  ({ ctx, p } = await abrirCon(pant('inicio', { tamanos: { titulo: 'chico' } }), 'inicio', { textos: { inicio_titulo: 'MISA' } }));
  revisar(Math.abs(await tam(p, '#i-titulo') - 104 * 0.85) <= 1, 'inicio título chico: 85 % de 104');
  await ctx.close();
  const LARGO = 'PEREGRINACIÓN SOLEMNE CON LA IMAGEN DE NUESTRA SEÑORA DEL CARMEN POR TODA LA COLONIA';
  ({ ctx, p } = await abrirCon(pant('inicio', { tamanos: { titulo: 'grande', frase: 'grande' } }), 'inicio', { textos: { inicio_titulo: LARGO } }));
  const tl = await tam(p, '#i-titulo');
  revisar(await cabe(p, '#v-inicio'), 'inicio grande con título largo: no se sale del cuadro');
  revisar(tl <= 104 * 1.15 + 0.5, 'inicio grande con título largo: no pasa de grande (' + tl.toFixed(1) + ')');
  await captura(p, 'estilo-pantallas/inicio_grande_largo');
  await ctx.close();

  // Review Focus 1: Gracias con 6 horarios y redes, «Grande» no quita horarios que con «Normal» se ven
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const conExtras = (tamanos) => (c) => {
    c.horarios = DIAS.map((d, i) => ({ dia: d, horas: [{ hora: (6 + i) + ':00 a. m.', nota: 'Misa con niños' }, { hora: (5 + i) + ':00 p. m.' }] }));
    c.redes = [{ red: 'facebook', url: 'https://www.facebook.com/x', texto: '/Parroquia' }, { red: 'youtube', url: 'https://www.youtube.com/@x', texto: '@Parroquia' }, { red: 'whatsapp', url: 'https://wa.me/50300000000', texto: '0000-0000' }];
    pant('gracias', Object.assign({ mostrar: ['horarios', 'redes'] }, tamanos ? { tamanos } : {}))(c);
  };
  const filas = (p) => p.evaluate(() => ({ h: document.querySelectorAll('#v-gracias .extra .hora').length, r: document.querySelectorAll('#v-gracias .extra .red').length }));
  ({ ctx, p } = await abrirCon(conExtras(null), 'gracias'));
  const fNormal = await filas(p);
  await ctx.close();
  ({ ctx, p } = await abrirCon(conExtras({ titulo: 'grande', frase: 'grande' }), 'gracias'));
  const fGrande = await filas(p);
  revisar(fGrande.h === fNormal.h && fGrande.r === fNormal.r, 'gracias con 6 horarios: «Grande» muestra los mismos horarios y redes que «Normal» (' + JSON.stringify(fGrande) + ' / ' + JSON.stringify(fNormal) + ')');
  revisar(await cabe(p, '#v-gracias'), 'gracias grande con horarios: no se sale');
  await captura(p, 'estilo-pantallas/gracias_grande_horarios');
  await ctx.close();

  // Avisos: el título de la tarjeta crece y las filas siguen dentro
  ({ ctx, p } = await abrirCon(pant('avisos', { tamanos: { titulo: 'grande' } }), 'avisos'));
  revisar(Math.abs(await tam(p, '#a-titulo') - 84 * 1.15) <= 1, 'avisos título grande: 115 % de 84');
  revisar(await cabe(p, '#v-avisos'), 'avisos grande: las filas siguen dentro de la tarjeta');
  await ctx.close();

  // Horarios (sin página en el editor; el campo se acepta en config.json)
  ({ ctx, p } = await abrirCon(pant('horarios', { tamanos: { titulo: 'grande' } }), 'horarios'));
  revisar(Math.abs(await tam(p, '#h-titulo') - 64 * 1.15) <= 1, 'horarios título grande: 115 % de 64 (' + (await tam(p, '#h-titulo')).toFixed(1) + ')');
  await ctx.close();

  // Review Focus 3: Cinzel la primera vez (contexto nuevo), título largo: se vuelve a medir al cargar la fuente
  ({ ctx, p } = await abrirCon((c) => { c.estiloPantallas = { letraTitulo: 'cinzel' }; }, 'inicio', { textos: { inicio_titulo: 'EXTRAORDINARIAMENTE BIENAVENTURADOS LOS CONGREGADOS AQUÍ' } }));
  revisar(await cabe(p, '#v-inicio'), 'Cinzel la primera vez, título de 56 caracteres: no se sale ni se corta');
  await captura(p, 'estilo-pantallas/cinzel_largo');
  await ctx.close();
}

/* Encuadre de las fotos (pantallas.<vista>.encuadre): solo con la misma foto que se ve. */
async function casoEncuadre() {
  console.log('Pantallas · mover y acercar las fotos');
  fs.mkdirSync(path.join(CAPTURAS, 'encuadre'), { recursive: true });
  const GAL = [{ id: 'taller', src: 'medios/fachada.jpg', alt: 'El taller' }, { id: 'rota', src: 'medios/no-existe.jpg', alt: 'Rota' }];
  const abrirCon = async (inicio, estado) => {
    const ctx = await nuevoContexto();
    await ctx.route(rutaConfig, servirConfig(conBloques((c) => { c.galeria = GAL; c.pantallas = { inicio: Object.assign({ modo: 'personalizada' }, inicio) }; })));
    const p = await abrir(ctx, `/${CA}/pantalla.html?tipo=inicio`, 1920, 1080, estadoCA(Object.assign({ tipo: 'dominical' }, estado || {})));
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1600);
    return { ctx, p };
  };
  const mide = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); const cs = getComputedStyle(e); const k = document.getElementById('escenario').getBoundingClientRect().width / 1920;
    const b = e.getBoundingClientRect();
    return { pos: cs.objectPosition, caja: cs.objectViewBox || 'none', w: Math.round(b.width / k), h: Math.round(b.height / k), visible: !e.hidden };
  }, sel);
  const ENC = { de: 'patrono', x: 30, y: 70, zoom: 150 };

  let { ctx, p } = await abrirCon({ imagen: 'patrono' });
  const sin = await mide(p, '#virgen');
  await ctx.close();
  ({ ctx, p } = await abrirCon({ imagen: 'patrono', encuadre: { imagen: ENC } }));
  let m = await mide(p, '#virgen');
  igual(m.pos, '30% 70%', 'arco: la foto se mueve a 30 % 70 %');
  revisar(m.caja !== 'none', 'arco: con zoom 150 la foto se acerca (object-view-box ' + m.caja + ')');
  revisar(m.w === sin.w && m.h === sin.h, 'arco: el marco mide lo mismo (' + m.w + '×' + m.h + ' / ' + sin.w + '×' + sin.h + ')');
  await captura(p, 'encuadre/arco_30_70_150');
  await ctx.close();
  igual(sin.pos, '50% 20%', 'arco sin encuadre: el de siempre');

  // Review Focus 2: la foto que se ve no es la del encuadre
  ({ ctx, p } = await abrirCon({ imagen: 'patrono', encuadre: { imagen: ENC } }, { imagen: 'fachada' }));
  m = await mide(p, '#virgen');
  igual(m.pos, '50% 20%', 'el panel eligió otra imagen: va con el encuadre de siempre');
  igual(m.caja, 'none', 'el panel eligió otra imagen: sin acercar');
  await ctx.close();
  ({ ctx, p } = await abrirCon({ imagen: 'galeria:rota', encuadre: { imagen: { de: 'galeria:rota', x: 10, y: 10, zoom: 200 } } }));
  await p.waitForTimeout(600);
  m = await mide(p, '#virgen');
  igual(m.pos, '50% 20%', 'la foto no cargó y cayó a la fachada: encuadre de siempre');
  igual(m.caja, 'none', 'la foto no cargó: sin acercar');
  await ctx.close();
  ({ ctx, p } = await abrirCon({ imagen: 'galeria:taller', encuadre: { imagen: { de: 'galeria:taller', x: 10, y: 10, zoom: 120 } } }));
  igual((await mide(p, '#virgen')).pos, '10% 10%', 'foto de la galería encuadrada');
  await p.evaluate(() => { PARROQUIA = Object.assign({}, PARROQUIA, { galeria: [] }); aplicarParroquia(PARROQUIA); });
  await p.waitForTimeout(400);
  m = await mide(p, '#virgen');
  igual(m.pos, '50% 20%', 'la foto ya no está en la galería: encuadre de siempre');
  await ctx.close();
  ({ ctx, p } = await abrirCon({ imagen: 'logo', encuadre: { imagen: { de: 'logo', x: 0, y: 0, zoom: 200 } } }));
  m = await mide(p, '#virgen');
  igual(m.caja, 'none', 'con el logo en el arco no se acerca nada');
  revisar(m.pos !== '0% 0%', 'con el logo en el arco no se mueve');
  await ctx.close();

  // Fondo de foto
  ({ ctx, p } = await abrirCon({ fondo: { tipo: 'imagen', imagen: 'taller' }, encuadre: { fondo: { de: 'galeria:taller', x: 10, y: 90, zoom: 130 } } }));
  m = await mide(p, '#fondo-img');
  igual(m.pos, '10% 90%', 'fondo: la foto se mueve');
  revisar(m.caja !== 'none', 'fondo: se acerca');
  revisar(m.w === 1920 && m.h === 1080, 'fondo: sigue cubriendo 1920×1080 (' + m.w + '×' + m.h + ')');
  await captura(p, 'encuadre/fondo');
  await ctx.close();
}

/* Lugares nuevos del rótulo (abajo a la derecha, arriba a la derecha) y la cajita «EN VIVO», que comparte la esquina de arriba. */
async function casoRotulosLugares() {
  console.log('Rótulos · lugares nuevos y EN VIVO');
  fs.mkdirSync(path.join(CAPTURAS, 'lugares'), { recursive: true });
  const abrirCon = async (rotulos, estado) => {
    const ctx = await nuevoContexto();
    await ctx.route(rutaConfig, servirConfig(conBloques((c) => { c.rotulos = rotulos; })));
    const r = await abrir(ctx, `/${CA}/rotulos.html`, 1920, 1080, estadoCA(Object.assign({ tipo: 'semana', rotulo: 'persona', celebrante: 'Pbro. José Martínez', mostrarEnVivo: true }, estado)));
    await r.waitForSelector('#rotulo.en');
    await r.waitForTimeout(1500);
    return { ctx, r };
  };
  const caja = (r) => r.evaluate(() => { const b = document.getElementById('rotulo').getBoundingClientRect(); return { top: b.top, right: b.right, bottom: b.bottom, left: b.left }; });
  const envivoOculto = (r) => r.evaluate(() => document.getElementById('envivo').classList.contains('oculto'));
  const cerca = (a, b) => Math.abs(a - b) <= 2;
  const sinRotulo = async (r) => { await r.evaluate(() => pintar(Object.assign({}, estado, { rotulo: 'ninguno' }))); };

  // Abajo a la derecha
  let { ctx, r } = await abrirCon({ posicion: 'derecha' });
  let b = await caja(r);
  revisar(cerca(b.right, 1860) && cerca(b.bottom, 1010), 'derecha: borde derecho en 1860 y de abajo en 1010 (' + b.right.toFixed(1) + ', ' + b.bottom.toFixed(1) + ')');
  revisar(!(await envivoOculto(r)), 'derecha: EN VIVO sigue visible');
  igual(await r.evaluate(() => document.getElementById('escenario').classList.contains('pos-derecha')), true, 'derecha: clase pos-derecha');
  await captura(r, 'lugares/derecha');
  await sinRotulo(r);
  await r.waitForTimeout(100);
  igual(await r.evaluate(() => getComputedStyle(document.getElementById('rotulo')).animationName), 'rotuloSaleDerecha', 'derecha: sale hacia la derecha');
  await ctx.close();

  // Arriba a la derecha: EN VIVO se esconde con el rótulo y vuelve cuando sale
  ({ ctx, r } = await abrirCon({ posicion: 'arriba-derecha' }));
  b = await caja(r);
  revisar(cerca(b.top, 44) && cerca(b.right, 1860), 'arriba-derecha: borde de arriba en 44 y derecho en 1860 (' + b.top.toFixed(1) + ', ' + b.right.toFixed(1) + ')');
  revisar(await envivoOculto(r), 'arriba-derecha: con rótulo, EN VIVO se esconde');
  await captura(r, 'lugares/arriba-derecha');
  await sinRotulo(r);
  await r.waitForTimeout(100);
  igual(await r.evaluate(() => getComputedStyle(document.getElementById('rotulo')).animationName), 'rotuloSaleDerecha', 'arriba-derecha: sale hacia la derecha');
  await r.waitForTimeout(600);
  revisar(!(await envivoOculto(r)), 'arriba-derecha: sin rótulo, EN VIVO vuelve');
  await ctx.close();

  // Con el rótulo en pantalla, la parroquia pasa a arriba-derecha: EN VIVO se esconde enseguida
  ({ ctx, r } = await abrirCon({ posicion: 'izquierda' }));
  revisar(!(await envivoOculto(r)), 'izquierda: EN VIVO visible con rótulo');
  await r.evaluate(() => { PARROQUIA = Object.assign({}, PARROQUIA, { rotulos: { posicion: 'arriba-derecha' } }); aplicarParroquia(PARROQUIA); });
  revisar(await envivoOculto(r), 'al pasar a arriba-derecha con el rótulo en pantalla, EN VIVO se esconde enseguida');
  b = await caja(r);
  revisar(cerca(b.top, 44), 'y el rótulo queda arriba (' + b.top.toFixed(1) + ')');
  await ctx.close();

  // Con mostrarEnVivo apagado, al salir el rótulo EN VIVO no aparece
  ({ ctx, r } = await abrirCon({ posicion: 'arriba-derecha' }, { mostrarEnVivo: false }));
  await sinRotulo(r);
  await r.waitForTimeout(700);
  revisar(await envivoOculto(r), 'sin mostrarEnVivo: al salir el rótulo, EN VIVO sigue oculto');
  await ctx.close();

  // Izquierda sale como siempre
  ({ ctx, r } = await abrirCon({ posicion: 'izquierda' }));
  await sinRotulo(r);
  await r.waitForTimeout(100);
  igual(await r.evaluate(() => getComputedStyle(document.getElementById('rotulo')).animationName), 'rotuloSale', 'izquierda: sale como siempre');
  await ctx.close();
}

/* Las seis tipografías nuevas del nombre del rótulo: se aplican con la clase tipo-<clave> y la fuente propia carga. */
async function casoTipografiasNuevas() {
  console.log('Rótulos · seis tipografías nuevas');
  const FAMILIAS = { cinzel: 'Cinzel', playfair: 'Playfair', 'eb-garamond': 'EBGaramond', merriweather: 'Merriweather', nunito: 'Nunito', oswald: 'Oswald' };
  fs.mkdirSync(path.join(CAPTURAS, 'tipografias'), { recursive: true });
  const ctx = await nuevoContexto();
  await ctx.route(rutaConfig, servirConfig(conBloques(() => {})));
  const r = await abrir(ctx, `/${CA}/rotulos.html`, 1920, 1080, estadoCA({ tipo: 'semana', rotulo: 'persona', celebrante: 'Pbro. José Martínez', mostrarEnVivo: true }));
  await r.waitForSelector('#rotulo.en');
  await r.waitForTimeout(1800);   // que termine la entrada (y el brillo) antes de la primera captura
  for (const [clave, familia] of Object.entries(FAMILIAS)) {
    await r.evaluate((t) => { PARROQUIA = Object.assign({}, PARROQUIA, { rotulos: { tipografia: t } }); aplicarParroquia(PARROQUIA); }, clave);
    const m = await r.evaluate(async (fam) => {
      await document.fonts.ready;
      const t = document.getElementById('r-t');
      await document.fonts.load(getComputedStyle(t).fontWeight + ' 52px ' + fam);
      return {
        familia: getComputedStyle(t).fontFamily,
        cargada: [...document.fonts].some((f) => f.family.replace(/["']/g, '') === fam && f.status === 'loaded'),
        clases: [...document.getElementById('escenario').classList].filter((x) => /^tipo-/.test(x)).join(' '),
        cortado: t.scrollWidth > t.clientWidth
      };
    }, familia);
    revisar(new RegExp('^"?' + familia + '"?').test(m.familia), clave + ': la font-family del nombre empieza con ' + familia + ' (' + m.familia + ')');
    revisar(m.cargada, clave + ': la fuente ' + familia + ' está cargada');
    igual(m.clases, 'tipo-' + clave, clave + ': clase en el escenario');
    revisar(!m.cortado, clave + ': el nombre no se corta');
    await r.waitForTimeout(300);
    await captura(r, 'tipografias/' + clave);
  }
  await ctx.close();
}

/* ---------- Programa ---------- */

/* La transición con la identidad de la parroquia (pantallas más opciones, Tarea 9): transicion.html dibuja en un
   canvas con los colores, el logo y el nombre de config.json. Guarda cuadros de Ciudad Arce en
   pruebas/vicaria/transicion-referencia/ para compararlos a ojo con el .webm de hoy (la comparación es del revisor). */
async function casoTransicion() {
  console.log('Transición · dibujada con la identidad');
  const REF = path.join(__dirname, 'transicion-referencia');
  fs.mkdirSync(REF, { recursive: true });
  const abrirT = async (slug, cfg, consulta, antes) => {
    const ctx = await nuevoContexto();
    await ctx.route(`**/${slug}/config.json`, servirConfig(cfg));
    if (antes) await antes(ctx);
    const p = await abrir(ctx, `/${slug}/transicion.html${consulta || ''}`);
    await p.evaluate(() => window.transicion.listo);
    return { ctx, p };
  };
  const alfa = (p, t, x, y) => p.evaluate(([t, x, y]) => {
    window.transicion.cuadro(t);
    return document.getElementById('lienzo').getContext('2d').getImageData(x, y, 1, 1).data[3];
  }, [t, x, y]);
  const pixel = (p, t, x, y) => p.evaluate(([t, x, y]) => {
    window.transicion.cuadro(t);
    return Array.from(document.getElementById('lienzo').getContext('2d').getImageData(x, y, 1, 1).data);
  }, [t, x, y]);
  const guardar = async (p, t, nombre) => {
    const url = await p.evaluate((t) => { window.transicion.cuadro(t); return document.getElementById('lienzo').toDataURL('image/png'); }, t);
    fs.writeFileSync(path.join(REF, nombre + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dentro = (lineas) => Array.isArray(lineas) && lineas.length > 0 && lineas.every((l) => l.x >= 0 && l.x + l.ancho <= 1920);

  // reproducir() antes de estar lista: el logo tarda en llegar
  let ctx = await nuevoContexto();
  await ctx.route(`**/${CA}/config.json`, servirConfig(CONFIG[CA]));
  await ctx.route('**/medios/logo-blanco.png', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
  let p = await abrir(ctx, `/${CA}/transicion.html`);
  await p.waitForFunction(() => typeof window.reproducir === 'function');
  igual(await p.evaluate(() => window.reproducir()), false, 'reproducir() antes de estar lista devuelve false');
  await p.evaluate(() => window.transicion.listo);
  igual(await p.evaluate(() => window.reproducir()), true, 'y después, true');
  await ctx.close();

  // Ciudad Arce, solo el logo
  ({ ctx, p } = await abrirT(CA, CONFIG[CA]));
  igual(await alfa(p, 0.05, 20, 20), 0, 'a 0,05 s la esquina es transparente');
  igual(await alfa(p, 1.0, 960, 540), 255, 'a 1,0 s el centro está tapado');
  const vacio = await p.evaluate(() => {
    window.transicion.cuadro(2.0);
    const d = document.getElementById('lienzo').getContext('2d').getImageData(0, 0, 1920, 1080).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  });
  revisar(vacio, 'a 2,0 s todo el canvas es transparente');
  revisar(/logo-blanco\.png$/.test(await p.evaluate(() => window.transicion.datos.logo && window.transicion.datos.logo.src)), 'usa el logo blanco');
  for (const t of [0.5, 1.0, 1.5]) await guardar(p, t, `ciudad-arce_logo_${t.toFixed(1)}`);
  await ctx.close();

  // Ciudad Arce, con la imagen del patrono
  ({ ctx, p } = await abrirT(CA, CONFIG[CA], '?version=patrono'));
  igual(await p.evaluate(() => window.transicion.datos.version), 'patrono', 'Ciudad Arce tiene la versión del patrono');
  revisar(/patrono\.png$/.test(await p.evaluate(() => window.transicion.datos.patrono && window.transicion.datos.patrono.src)), 'con la imagen del patrono');
  igual(await alfa(p, 1.0, 960, 540), 255, 'patrono: a 1,0 s el centro está tapado');
  for (const t of [0.5, 1.0, 1.5]) await guardar(p, t, `ciudad-arce_patrono_${t.toFixed(1)}`);
  await ctx.close();

  // San José: sus colores; sin imagen del patrono, la versión del patrono cae a la del logo
  ({ ctx, p } = await abrirT(SJ, CONFIG[SJ], '?version=patrono'));
  igual(await p.evaluate(() => window.transicion.datos.version), 'logo', 'San José sin imagen del patrono dibuja la del logo');
  const px = await pixel(p, 1.0, 5, 5);
  const os = rgb(CONFIG[SJ].colores.oscuro);
  revisar(px[3] === 255 && px.slice(0, 3).every((v, i) => Math.abs(v - os[i]) <= 25), 'a 1,0 s la franja oscura es del oscuro de San José (' + px.join(',') + ')');
  await guardar(p, 1.0, 'san-jose_logo_1.0');
  await ctx.close();

  // logos.blanco es obligatorio en config.json: «sin logo blanco» es que no carga. Entonces usa el de color; sin ninguno, el nombre solo
  ({ ctx, p } = await abrirT(CA, CONFIG[CA], '', (c) => c.route('**/medios/logo-blanco.png', (r) => r.abort())));
  revisar(/logo-color\.png$/.test(await p.evaluate(() => window.transicion.datos.logo && window.transicion.datos.logo.src)), 'si el logo blanco no carga, usa el de color');
  await ctx.close();
  ({ ctx, p } = await abrirT(CA, CONFIG[CA], '', (c) => c.route(/medios\/logo-(blanco|color)\.png$/, (r) => r.abort())));
  igual(await p.evaluate(() => window.transicion.datos.logo), null, 'sin logos, no hay logo');
  const sinLogo = await p.evaluate(() => window.transicion.cuadro(1.0));
  revisar(dentro(sinLogo.lineas) && sinLogo.lineas[0].texto === CONFIG_NOMBRE_CA, 'y se ve el nombre (' + JSON.stringify(sinLogo.lineas) + ')');
  await ctx.close();

  // Un nombre de 70 letras queda dentro de los 1920 px, en las dos versiones
  const nombre70 = 'Parroquia Nuestra Señora de la Asunción y San Juan Bautista del Llanos';
  for (const version of ['logo', 'patrono']) {
    ({ ctx, p } = await abrirT(CA, conBloques((c) => { c.nombre = nombre70; }), '?version=' + version));
    const m = await p.evaluate(() => window.transicion.cuadro(1.0));
    revisar(nombre70.length === 70 && dentro(m.lineas), `${version}: un nombre de 70 letras queda dentro (${m.lineas.map((l) => Math.round(l.x) + '+' + Math.round(l.ancho)).join(' / ')})`);
    revisar(m.lineas.map((l) => l.texto).join(' ') === nombre70.toUpperCase(), `${version}: y no se corta`);
    if (version === 'patrono') await guardar(p, 1.0, 'nombre-largo_patrono_1.0');
    else await guardar(p, 1.0, 'nombre-largo_logo_1.0');
    await ctx.close();
  }
}

(async () => {
  const servidor = crearServidor();
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = 'http://' + HOST + ':' + servidor.address().port;
  browser = await chromium.launch();
  // --solo=casoX corre solo ese caso (para trabajar en él); la corrida completa es sin la marca
  const solo = (process.argv.find((a) => a.startsWith('--solo=')) || '').slice(7);
  if (solo) {
    const casos = { casoClasicoIgual, casoPantallasIgual, casoEstiloPantallas, casoEncuadre, casoRotulosDisenos, casoRotulosLugares, casoTipografiasNuevas, casoRevisionFinal, casoPantallasRediseno, casoLineaBase, casoDisenoDatos, casoDisenoFondo, casoDisenoColores, casoDisenoRotulo, casoDisenoProduccion, casoFaltasIguales, casoMisasListas, casoTransicion };
    try { await casos[solo](); } catch (e) { console.log('  ✘ la prueba se interrumpió: ' + (e && e.stack || e)); fallos++; }
    await browser.close(); servidor.close();
    console.log('\n(solo ' + solo + ') ' + (fallos + errores.length ? (fallos + errores.length) + ' fallo(s): ' + errores.join(' / ') : 'bien'));
    process.exit(fallos + errores.length ? 1 : 0);
  }
  try {
    await casoCarga();
    await casoNoSeCruzan();
    await casoSinLema();
    await casoSinRedConCopia();
    await casoPrimeraVezSinRed();
    await casoConfigDanada();
    await casoDireccionesRaras();
    await casoActualizaEnVivo();
    await casoImagenRota();
    await casoRecursosComunes();
    await casoCapturasYMedidas();
    await casoComoViene();
    await casoPersonalizada();
    await casoEstiloRotulos();
    await casoPortadaCaeAInicio();
    await casoHorarios();
    await casoAvisosFijos();
    await casoTiposPropios();
    await casoPanelNeutroConservaPropio();
    await casoPlaceholdersTextos();
    await casoSanJoseCompleto();
    await casoVistaPrevia();
    await casoPantallasRediseno();
    await casoRotulosRediseno();
    await casoPanelRediseno();
    await casoVistaPreviaEstado();
    await casoRevisionFinal();
    await casoDisenoDatos();
    await casoDisenoFondo();
    await casoDisenoColores();
    await casoDisenoRotulo();
    await casoDisenoProduccion();
    await casoLineaBase();
    await casoClasicoIgual();
    await casoPantallasIgual();
    await casoEstiloPantallas();
    await casoEncuadre();
    await casoTipografiasNuevas();
    await casoRotulosLugares();
    await casoRotulosDisenos();
    await casoFaltasIguales();
    await casoMisasListas();
    await casoTransicion();
    if (!process.argv.includes('--sin-comparacion')) await comparacion();
  } catch (e) {
    console.log('  ✘ la prueba se interrumpió: ' + (e && e.stack || e));
    fallos++;
  }
  console.log('\nErrores de JavaScript en las páginas: ' + errores.length);
  for (const e of errores) console.log('  ✘ ' + e);
  fallos += errores.length;
  await browser.close();
  servidor.close();
  console.log(fallos ? '\n' + fallos + ' fallo(s)' : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})();
