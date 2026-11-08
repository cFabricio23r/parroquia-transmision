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
const { crearServidor } = require('../../herramientas/servidor-vicaria');

const CAPTURAS = path.join(__dirname, '..', 'capturas', 'vicaria');
const RAIZ = path.join(__dirname, '..', '..', 'vicaria');
fs.mkdirSync(path.join(CAPTURAS, 'comparacion'), { recursive: true });
fs.mkdirSync(path.join(CAPTURAS, '1b'), { recursive: true });

const CA = 'ciudad-arce';
const SJ = 'san-jose-ejemplo';
const HOST = '127.0.0.1';   // el servidor escucha solo en IPv4: «localhost» pasaría primero por ::1
const configDe = (slug) => JSON.parse(fs.readFileSync(path.join(RAIZ, slug, 'config.json'), 'utf8'));
const CONFIG = { [CA]: configDe(CA), [SJ]: configDe(SJ) };

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
    igual((await texto(p, '#no-existe')).trim(), 'Esta parroquia no existe, revisa el link', ruta + ': «Esta parroquia no existe, revisa el link»');
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
    revisar(await visibleEl(p, '#chispas') && await visibleEl(p, '#marca') !== (vista === 'avisos'), `${vista}: chispas y marca como en la 1a`);
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
  igual(m.radio, '24px', 'sin bloque: vuelven las esquinas redondeadas');
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

/* ---------- Programa ---------- */

(async () => {
  const servidor = crearServidor();
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = 'http://' + HOST + ':' + servidor.address().port;
  browser = await chromium.launch();
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
