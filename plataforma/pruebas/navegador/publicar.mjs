// Pruebas de navegador de F12 · «Revisar y publicar» (plan 5, Tarea 13), contra `next dev` + Supabase
// local. Se corren con `npm run test:navegador` (herramientas/navegador.mjs). Slugs y correos con sufijo
// aleatorio; todo lo creado se borra al final.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { camposSinEtiqueta } from './lib/editor.mjs';

const BASE = process.env.BASE_URL;
const servicio = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sufijo = () => Math.random().toString(36).slice(2, 10);
const CLAVE = 'clave-de-prueba-123';
const MENSAJE_SIN_GUARDAR = 'Tienes cambios sin guardar. Guarda antes de publicar';
const MENSAJE_DESACTIVADA = 'Esta parroquia está desactivada. Reactívala en Administración para publicar.';
const NOTA_VERSIONES = '«Volver a esta» publica de nuevo esa versión como una nueva; no se borra ninguna.';

let fallos = 0;
const revisar = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FALLA ') + msg);
  if (!cond) fallos++;
};
const igual = (real, esperado, msg) =>
  revisar(real === esperado, msg + (real === esperado ? '' : ` (era ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`));
const estilo = (loc, prop) => loc.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

const { esquema, version, publicado, slug: _slug, ...BASE_CONFIG } = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
void esquema, void version, void publicado, void _slug;

const usuarios = [];
async function crearUsuario(prefijo) {
  const correo = `${prefijo}-${sufijo()}@prueba.test`;
  const { data: u, error } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error;
  usuarios.push(u.user.id);
  return { id: u.user.id, correo };
}

async function preparar() {
  const slug = `pubnav-${sufijo()}`;
  const { data: p, error } = await servicio.from('parroquias').insert({ slug, nombre: `Parroquia ${slug}` }).select('id').single();
  if (error) throw error;
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#336699' } }).png().toBuffer();
  const s = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  const n = { blanco: `logo-blanco-${s}.png`, color: `logo-color-${s}.png`, fachada: `fachada-${s}.png` };
  for (const f of Object.values(n)) {
    const { error: e } = await servicio.storage.from('borradores').upload(`${p.id}/${f}`, png, { contentType: 'image/png' });
    if (e) throw e;
  }
  const config = {
    ...BASE_CONFIG,
    logos: { blanco: { src: `medios/${n.blanco}`, alt: 'Logo en blanco' }, color: { src: `medios/${n.color}`, alt: 'Logo a color' } },
    fachada: { src: `medios/${n.fachada}`, alt: 'Fachada' },
    patrono: { ...BASE_CONFIG.patrono, imagen: { src: `medios/${n.fachada}`, alt: 'Imagen del patrono' } },
  };
  const { error: eb } = await servicio.from('borradores').insert({ parroquia_id: p.id, config });
  if (eb) throw eb;
  const u = await crearUsuario('pubnav');
  const { error: em } = await servicio.from('miembros').insert({ parroquia_id: p.id, usuario_id: u.id });
  if (em) throw em;
  return { id: p.id, slug, correo: u.correo, config, fachada: `medios/${n.fachada}` };
}
const leerBorrador = async (id) => (await servicio.from('borradores').select('config, actualizado_en').eq('parroquia_id', id).single()).data;
const numeros = async (id) => ((await servicio.from('versiones').select('numero').eq('parroquia_id', id).order('numero')).data ?? []).map((v) => v.numero);
const ponerConfig = async (id, config) => {
  const { error } = await servicio.from('borradores').update({ config }).eq('parroquia_id', id);
  if (error) throw error;
};

/** Borra todo lo que hay en `bucket` bajo `carpeta` (recorre subcarpetas): lo publicado que quede en la base local lo bajaría el build local. */
async function borrarCarpeta(bucket, carpeta) {
  const rutas = [];
  const recorrer = async (c) => {
    const { data } = await servicio.storage.from(bucket).list(c, { limit: 1000 });
    for (const e of data ?? []) {
      if (e.id === null) await recorrer(`${c}/${e.name}`);
      else rutas.push(`${c}/${e.name}`);
    }
  };
  await recorrer(carpeta);
  if (rutas.length) await servicio.storage.from(bucket).remove(rutas);
}

async function entrar(pagina, correo) {
  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.getByLabel('Correo').fill(correo);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForURL((u) => u.pathname.startsWith('/editor') && !u.pathname.startsWith('/editor/entrar'));
}
const esperarGuardado = (pagina) =>
  pagina.waitForFunction(() => document.querySelector('[role="status"].pv-guardado')?.textContent === 'Guardado', null, { timeout: 10_000 });

const navegador = await chromium.launch();
let P;
let adminId = null;
try {
  P = await preparar();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  await contexto.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const pagina = await contexto.newPage();
  const erroresJs = [];
  pagina.on('pageerror', (e) => erroresJs.push(e.message));
  // Lo que servirían las pantallas: lo decide cada paso con `enPantallas`. null = 404.
  let enPantallas = null;
  await pagina.route(`**/${P.slug}/config.json`, (ruta) =>
    enPantallas === null
      ? ruta.fulfill({ status: 404, body: 'no esta' })
      : ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: enPantallas }) }),
  );
  const URL_PUBLICAR = `${BASE}/editor/p/${P.slug}/publicar`;
  const boton = () => pagina.getByRole('button', { name: /^Publicar versión \d+$|^Publicando…$/ });
  const filaVersion = (n) => pagina.locator('.pv-publicar-version').filter({ has: pagina.locator('b', { hasText: new RegExp(`^v${n}$`) }) });
  const estado = pagina.locator('[role="status"].pv-publicar-estado');
  const irAPublicar = async () => {
    await pagina.locator('nav[aria-label="Secciones del editor"]').getByRole('link', { name: /^Publicar/ }).click();
    await pagina.waitForURL(URL_PUBLICAR);
  };

  console.log('Entrar');
  await entrar(pagina, P.correo);
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}`);

  console.log('El guardado automático deja el cambio en el borrador');
  await pagina.goto(`${BASE}/editor/p/${P.slug}/identidad`);
  const campoLugar = pagina.getByLabel('Lugar', { exact: true });
  const lugarOriginal = await campoLugar.inputValue();
  await campoLugar.fill(lugarOriginal + ' (cambio)');
  await esperarGuardado(pagina);
  igual((await leerBorrador(P.id)).config.lugar, lugarOriginal + ' (cambio)', 'el lugar nuevo quedó en el borrador sin botón de guardar');

  console.log('Con el guardado pendiente, el botón queda bloqueado');
  await pagina.route('**/editor/api/*/borrador', async (ruta) => {
    if (ruta.request().method() === 'PUT') await new Promise((ok) => setTimeout(ok, 3000));
    await ruta.continue();
  });
  await campoLugar.fill(lugarOriginal);
  await irAPublicar();
  igual(await boton().textContent(), 'Publicar versión 1', 'el botón dice «Publicar versión 1»');
  igual(await boton().getAttribute('aria-disabled'), 'true', 'aria-disabled="true" mientras se guarda');
  revisar(await pagina.getByText(MENSAJE_SIN_GUARDAR).isVisible(), 'se ve el MENSAJE_SIN_GUARDAR');
  await boton().click({ force: true }); // aria-disabled no frena el clic real: lo frena el componente
  await pagina.waitForTimeout(300);
  igual(JSON.stringify(await numeros(P.id)), '[]', 'el clic con el guardado pendiente no publica nada');
  await esperarGuardado(pagina);
  await pagina.unroute('**/editor/api/*/borrador');
  igual(await boton().getAttribute('aria-disabled'), 'false', 'al quedar «Guardado», el botón se desbloquea');

  console.log('Estructura');
  igual(await pagina.locator('main h1').textContent(), 'Revisar y publicar', 'h1 «Revisar y publicar»');
  igual(
    (await pagina.locator('main h2:visible').allTextContents()).join('|'),
    'Antes de publicar|Qué se publica|Links para OBS|Versiones publicadas',
    'los cuatro h2',
  );
  revisar(await pagina.locator('.pv-publicar-revision-fila', { hasText: 'Todo listo' }).isVisible(), 'la fila «Todo listo»');
  revisar(await pagina.getByText('Es la primera versión: se publica todo lo que configuraste.').isVisible(), '«Es la primera versión…»');
  revisar(await pagina.getByText('Todavía no has publicado ninguna versión.').isVisible(), 'sin versiones todavía');
  igual(await pagina.locator('.pv-publicar-izquierda').evaluate((e) => e.getBoundingClientRect().width), 640, 'columna izquierda de 640 px');

  console.log('Publicar');
  await boton().click();
  await estado.filter({ hasText: 'Publicaste la versión 1.' }).waitFor({ timeout: 15_000 });
  revisar(true, 'status «Publicaste la versión 1.»');
  igual(JSON.stringify(await numeros(P.id)), '[1]', 'quedó la versión 1');
  await filaVersion(1).waitFor();
  const texto1 = await filaVersion(1).locator('.pv-publicar-version-texto').textContent();
  revisar(new RegExp(`^${P.correo.replace(/[.]/g, '\\.')} · hoy \\d{2}:\\d{2}$`).test(texto1), `«v1» con «<correo> · hoy HH:MM» (${texto1})`);
  await estado.filter({ hasText: 'Las pantallas todavía no la tienen.' }).waitFor();
  revisar(true, 'con las pantallas en 404 lo dice');
  enPantallas = 1;
  await pagina.getByRole('button', { name: 'Comprobar de nuevo' }).click();
  await filaVersion(1).locator('.pv-chip', { hasText: 'En OBS ahora' }).waitFor();
  revisar(true, 'v1 lleva «En OBS ahora»');
  igual(await filaVersion(1).getByRole('button', { name: 'Volver a la versión 1' }).count(), 0, 'y no lleva «Volver a esta»');
  igual(await pagina.getByRole('button', { name: 'Comprobar de nuevo' }).count(), 0, 'ya llegó: no hay «Comprobar de nuevo»');

  console.log('Qué cambia');
  await pagina.goto(`${BASE}/editor/p/${P.slug}/identidad`);
  await pagina.getByLabel('Lugar', { exact: true }).fill(lugarOriginal + ' (otro)');
  await esperarGuardado(pagina);
  await irAPublicar();
  igual(await pagina.locator('#pv-publicar-cambia').textContent(), 'Qué cambia respecto a la versión 1', 'h2 «Qué cambia respecto a la versión 1»');
  igual((await pagina.locator('.pv-publicar-cambios li').allTextContents()).join('|'), 'Identidad: lugar', 'la frase de Identidad');
  igual(await pagina.locator('.pv-chip-borrador').textContent(), 'Borrador · 1 cambio sin publicar', 'chip «Borrador · 1 cambio sin publicar»');
  igual(await boton().textContent(), 'Publicar versión 2', '«Publicar versión 2»');
  await boton().click();
  await estado.filter({ hasText: 'Publicaste la versión 2.' }).waitFor({ timeout: 15_000 });
  revisar(true, 'publicó la 2');
  await pagina.getByText('No hay cambios respecto a la versión 2.').waitFor({ timeout: 15_000 });
  revisar(true, 'después: «No hay cambios respecto a la versión 2.»');

  console.log('Huecos en la numeración (Review Focus 5)');
  const { error: eu } = await servicio.from('parroquias').update({ ultima_version: 7 }).eq('id', P.id);
  if (eu) throw eu;
  await pagina.reload();
  igual(await boton().textContent(), 'Publicar versión 8', 'con ultima_version 7, «Publicar versión 8»');
  await boton().click();
  await estado.filter({ hasText: 'Publicaste la versión 8.' }).waitFor({ timeout: 15_000 });
  revisar(true, 'status «Publicaste la versión 8.»');
  igual(JSON.stringify(await numeros(P.id)), '[1,2,8]', 'quedaron 1, 2 y 8');

  console.log('Volver a esta');
  enPantallas = 8;
  await pagina.getByRole('button', { name: 'Comprobar de nuevo' }).click();
  await filaVersion(8).locator('.pv-chip', { hasText: 'En OBS ahora' }).waitFor();
  const volver1 = pagina.getByRole('button', { name: 'Volver a la versión 1' });
  igual(await estilo(volver1, 'text-decoration-line'), 'underline', '«Volver a esta» subrayado');
  await volver1.click();
  const dialogo = pagina.getByRole('dialog', { name: 'Volver a la versión 1' });
  await dialogo.waitFor();
  igual(
    await dialogo.locator('p').first().textContent(),
    'Se publica de nuevo la versión 1 como versión nueva. Tu borrador no cambia.',
    'el texto del diálogo',
  );
  igual(await pagina.evaluate(() => document.activeElement?.textContent), 'Cancelar', 'el foco entra en «Cancelar»');
  await pagina.keyboard.press('Escape');
  await dialogo.waitFor({ state: 'hidden' });
  igual(await pagina.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Volver a la versión 1', 'Escape cierra y el foco vuelve');
  igual(JSON.stringify(await numeros(P.id)), '[1,2,8]', 'cancelar no publica nada');
  const antesRestaurar = await leerBorrador(P.id);
  await volver1.click();
  await dialogo.waitFor();
  await dialogo.getByRole('button', { name: 'Sí, volver a esta' }).click();
  await pagina.locator('.pv-publicar-version-texto', { hasText: '· copia de la v1' }).waitFor({ timeout: 15_000 });
  revisar(true, 'aparece una versión nueva «· copia de la v1»');
  igual(JSON.stringify(await numeros(P.id)), '[1,2,8,9]', 'quedó la 9');
  revisar(isDeepStrictEqual(await leerBorrador(P.id), antesRestaurar), 'el borrador no cambió (ni su sello)');
  revisar(await pagina.getByText(NOTA_VERSIONES, { exact: true }).isVisible(), 'la nota de las versiones');

  console.log('Un 422 del servidor');
  await pagina.route('**/editor/api/*/publicar', (ruta) =>
    ruta.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ errores: ['Falta el lugar (lugar).'] }) }),
  );
  await boton().click();
  const alerta = pagina.getByRole('alert').filter({ hasText: 'No se puede publicar todavía.' });
  await alerta.waitFor();
  revisar((await alerta.textContent()).includes('Falta el lugar (lugar).'), 'la caja de error trae la lista');
  igual(await pagina.evaluate(() => document.activeElement?.getAttribute('role')), 'alert', 'la caja recibe el foco');
  await pagina.unroute('**/editor/api/*/publicar');

  console.log('Error que bloquea');
  const actual = (await leerBorrador(P.id)).config;
  await ponerConfig(P.id, { ...actual, galeria: [{ id: 'img-pubnav', src: P.fachada, alt: '', nombre: 'Fondo navideño', etiquetas: ['fondos'] }] });
  await pagina.reload();
  const filaRoja = pagina.locator('.pv-publicar-revision-fila', { hasText: 'Fondo navideño no tiene descripción' });
  await filaRoja.waitFor();
  igual(await filaRoja.locator('.pv-publicar-punto--rojo').count(), 1, 'fila roja «Fondo navideño no tiene descripción»');
  igual(await filaRoja.getByRole('link').textContent(), 'Corregir en Galería', 'con «Corregir en Galería»');
  igual(await filaRoja.getByRole('link').getAttribute('href'), `/editor/p/${P.slug}/galeria`, 'que lleva a /galeria');
  igual(await boton().getAttribute('aria-disabled'), 'true', 'el botón queda aria-disabled');
  revisar(await pagina.getByText('Corrige 1 problema para poder publicar.').isVisible(), '«Corrige 1 problema para poder publicar.»');
  await boton().click({ force: true });
  await pagina.waitForTimeout(400);
  igual(JSON.stringify(await numeros(P.id)), '[1,2,8,9]', 'un clic forzado no publica');

  console.log('Aviso que no bloquea');
  await ponerConfig(P.id, {
    ...actual,
    colores: { ...actual.colores, acento: '#808080' },
    rotulos: { colorLado: 'acento' },
    galeria: [{ id: 'img-pubnav', src: P.fachada, alt: 'Fondo con estrellas', nombre: 'Fondo navideño', etiquetas: ['fondos'] }],
  });
  await pagina.reload();
  const filaAmbar = pagina.locator('.pv-publicar-revision-fila', { hasText: 'El acento como fondo de rótulo tiene poco contraste' });
  await filaAmbar.waitFor();
  igual(await filaAmbar.locator('.pv-publicar-punto--ambar').count(), 1, 'fila ámbar del acento');
  igual(await filaAmbar.getByRole('link').textContent(), 'Ver Rótulos y estilo', 'con «Ver Rótulos y estilo»');
  igual(await boton().getAttribute('aria-disabled'), 'false', 'el aviso no bloquea el botón');

  console.log('Copiar');
  await pagina.locator('.pv-publicar-links .pv-resumen-link', { hasText: 'Panel' }).getByRole('button', { name: 'Copiar' }).click();
  igual(await pagina.evaluate(() => navigator.clipboard.readText()), `${BASE}/${P.slug}/panel.html`, '«Copiar» de «Panel» deja el link');
  igual(
    (await pagina.locator('.pv-publicar-links .pv-resumen-link-etiqueta').allTextContents()).join('|'),
    'Pantallas|Panel|Rótulos',
    'las etiquetas del artboard',
  );

  igual((await camposSinEtiqueta(pagina)).length, 0, 'sin campos sin etiqueta');
  igual(erroresJs.length, 0, 'sin errores de JavaScript en la página' + (erroresJs.length ? ': ' + erroresJs.join(' | ') : ''));

  console.log('Desactivada');
  const admin = await crearUsuario('pubnav-admin');
  adminId = admin.id;
  const { error: ea } = await servicio.from('administradores').insert({ usuario_id: admin.id });
  if (ea) throw ea;
  const { error: ed } = await servicio.from('parroquias').update({ desactivada_en: new Date().toISOString() }).eq('id', P.id);
  if (ed) throw ed;
  const ctxAdmin = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pa = await ctxAdmin.newPage();
  await entrar(pa, admin.correo);
  await pa.goto(URL_PUBLICAR);
  const botonAdmin = pa.getByRole('button', { name: /^Publicar versión \d+$/ });
  await botonAdmin.waitFor();
  igual(await botonAdmin.getAttribute('aria-disabled'), 'true', 'desactivada: el botón queda aria-disabled');
  revisar(await pa.getByText(MENSAJE_DESACTIVADA).isVisible(), 'con el texto de la Decisión 3');
  await ctxAdmin.close();
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  await navegador.close();
  if (P) {
    await borrarCarpeta('borradores', P.id);
    await borrarCarpeta('publicado', P.slug);
    await servicio.from('parroquias').delete().eq('id', P.id);
  }
  if (adminId) await servicio.from('administradores').delete().eq('usuario_id', adminId);
  for (const id of usuarios) await servicio.auth.admin.deleteUser(id);
}

console.log(fallos === 0 ? '\nPruebas de navegador de publicar: todo bien.' : `\n${fallos} comprobaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
