// Pruebas de navegador del editor de identidad (Playwright), contra `next dev` + Supabase local.
// Se corren con `npm run test:navegador` (herramientas/navegador.mjs levanta todo y pasa BASE_URL y las llaves).
// Slugs y correos con sufijo aleatorio: la base local se comparte entre corridas.
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.BASE_URL;
const URL_SUPABASE = process.env.SUPABASE_URL;
const servicio = createClient(URL_SUPABASE, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sufijo = () => Math.random().toString(36).slice(2, 10);
const CLAVE = 'clave-de-prueba-123';

let fallos = 0;
const revisar = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FALLA ') + msg);
  if (!cond) fallos++;
};
const igual = (real, esperado, msg) =>
  revisar(real === esperado, msg + (real === esperado ? '' : ` (era ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`));

async function preparar() {
  const slug = `nav-${sufijo()}`;
  const { data: p, error } = await servicio.from('parroquias').insert({ slug, nombre: `Parroquia ${slug}` }).select('id').single();
  if (error) throw error;
  const avisos = [{ texto: 'Misa especial', desde: '2026-12-01', hasta: '2026-12-02' }];
  const pantallas = { inicio: {} };
  const { error: errorBorrador } = await servicio.from('borradores').insert({
    parroquia_id: p.id,
    config: { nombre: `Parroquia ${slug}`, lugar: 'Lugar inicial', avisos, pantallas },
  });
  if (errorBorrador) throw errorBorrador;
  const correo = `nav-${sufijo()}@prueba.test`;
  const { data: u, error: errorUsuario } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (errorUsuario) throw errorUsuario;
  const { error: errorMiembro } = await servicio.from('miembros').insert({ parroquia_id: p.id, usuario_id: u.user.id });
  if (errorMiembro) throw errorMiembro;
  return { id: p.id, slug, correo, avisos, pantallas };
}

const leerConfig = async (id) => (await servicio.from('borradores').select('config').eq('parroquia_id', id).single()).data.config;

async function entrar(pagina, correo) {
  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.getByLabel('Correo').fill(correo);
  await pagina.getByLabel('Contraseña').fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar' }).click();
}

const navegador = await chromium.launch();
try {
  const P = await preparar();
  const contexto = await navegador.newContext({ viewport: { width: 1000, height: 1400 } });
  const pagina = await contexto.newPage();
  const erroresJs = [];
  pagina.on('pageerror', (e) => erroresJs.push(e.message));
  // Desde antes de la primera navegación, para ver también los pedidos de la carga inicial de los iframes.
  const pedidosConfig = [];
  pagina.on('request', (q) => {
    // Solo los de los iframes de la vista previa: la propia página sí pide /<slug>/config.json (estado de «Publicar»).
    if (q.frame() !== pagina.mainFrame() && /\/config\.json(\?|$)/.test(q.url())) pedidosConfig.push(q.url());
  });

  console.log('Entrar y llegar al formulario');
  await entrar(pagina, P.correo);
  // Con una sola parroquia, /editor redirige a ella
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}`);
  await pagina.getByRole('heading', { name: /Identidad de/ }).waitFor();
  igual(await pagina.getByLabel('Lugar').inputValue(), 'Lugar inicial', 'el formulario trae el lugar del borrador');
  revisar(await pagina.getByRole('heading', { name: 'Para poder publicar falta:' }).isVisible(), 'muestra «Para poder publicar falta:»');
  revisar((await pagina.locator('.falta li').count()) > 0, 'la lista de lo que falta tiene elementos');

  console.log('Accesibilidad básica');
  const sinEtiqueta = await pagina.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((e) => e.type !== 'hidden' && !e.labels?.length && !e.getAttribute('aria-label'))
      .map((e) => e.id || e.name),
  );
  igual(sinEtiqueta.length, 0, 'todo campo tiene su label' + (sinEtiqueta.length ? ': ' + sinEtiqueta.join(', ') : ''));

  console.log('Vista previa con las pantallas reales');
  const marcoInicio = pagina.locator('iframe[title="Vista previa: inicio"]');
  const marcoPortada = pagina.locator('iframe[title="Vista previa: portada"]');
  await marcoInicio.waitFor();
  await marcoPortada.waitFor();
  igual(await marcoInicio.getAttribute('width'), '480', 'la vista previa de inicio mide 480 de ancho');
  igual(await marcoInicio.getAttribute('height'), '270', 'la vista previa de inicio mide 270 de alto');
  revisar((await marcoInicio.getAttribute('src')).endsWith(`/${P.slug}/pantalla.html?tipo=inicio&vista-previa=1`), 'el iframe de inicio carga la pantalla real con ?vista-previa=1');
  revisar((await marcoPortada.getAttribute('src')).endsWith(`/${P.slug}/pantalla.html?tipo=portada&vista-previa=1`), 'el iframe de portada carga la pantalla real con ?vista-previa=1');
  const textoDe = (titulo) => pagina.frameLocator(`iframe[title="${titulo}"]`).locator('body').innerText();
  await pagina.waitForFunction(
    (n) => document.querySelector('iframe[title="Vista previa: inicio"]')?.contentDocument?.body?.innerText.includes(n),
    `Parroquia ${P.slug}`,
  );
  revisar((await textoDe('Vista previa: inicio')).includes(`Parroquia ${P.slug}`), 'al cargar, la vista previa ya muestra el nombre del borrador');
  const nombreNuevo = `Parroquia Nueva ${sufijo()}`;
  await pagina.getByLabel('Nombre de la parroquia', { exact: true }).fill(nombreNuevo);
  await pagina.waitForFunction(
    (n) => document.querySelector('iframe[title="Vista previa: inicio"]')?.contentDocument?.body?.innerText.includes(n),
    nombreNuevo,
  );
  revisar((await textoDe('Vista previa: inicio')).includes(nombreNuevo), 'cambiar el nombre se ve en la vista previa');
  igual((await leerConfig(P.id)).nombre, `Parroquia ${P.slug}`, 'la vista previa no guardó nada en la base');
  igual(pedidosConfig.length, 0, 'la vista previa no pidió config.json' + (pedidosConfig.length ? ': ' + pedidosConfig.join(', ') : ''));
  const clavesPev = await pagina.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pev_')));
  revisar(clavesPev.every((k) => k.startsWith('pev_vistaprevia_')), 'solo hay claves pev_vistaprevia_ en localStorage' + (clavesPev.length ? ': ' + clavesPev.join(', ') : ''));
  revisar(clavesPev.length > 0 && !clavesPev.some((k) => k.startsWith(`pev_${P.slug}_`)), `no hay ninguna clave pev_${P.slug}_ (las del OBS real)`);
  await pagina.getByLabel('Nombre de la parroquia', { exact: true }).fill(`Parroquia ${P.slug}`);

  console.log('Contraste de los colores');
  await pagina.getByLabel('Color principal').fill('#3d9be0');
  revisar(/no se lee: elige uno más oscuro/.test(await pagina.locator('#color-principal-contraste').innerText()), 'un celeste claro dice «no se lee: elige uno más oscuro»');
  await pagina.getByLabel('Color principal').fill('#1155a4');
  revisar(/7\.3:1, se lee bien/.test(await pagina.locator('#color-principal-contraste').innerText()), 'el azul de la parroquia dice «7.3:1, se lee bien»');

  console.log('Guardar el borrador');
  await pagina.getByLabel('Lugar').fill('Ciudad Arce');
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  await pagina.getByText('Borrador guardado.').waitFor();
  const guardada = await leerConfig(P.id);
  igual(guardada.lugar, 'Ciudad Arce', 'el lugar quedó en la base');
  revisar(isDeepStrictEqual(guardada.avisos, P.avisos), 'los avisos de la 1b siguen igual');
  revisar(isDeepStrictEqual(guardada.pantallas, P.pantallas), 'las pantallas de la 1b siguen igual');
  igual(guardada.colores?.principal, '#1155a4', 'los colores quedaron guardados');

  console.log('Subir imágenes');
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#336699' } }).png().toBuffer();
  await pagina.locator('#logo-blanco-archivo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
  await pagina.locator('fieldset:has(#logo-blanco-archivo) .miniatura img').waitFor();
  await pagina.locator('#logo-blanco-alt').fill('Logo de prueba en blanco');
  revisar((await pagina.locator('fieldset:has(#logo-blanco-archivo) .miniatura img').getAttribute('src')).includes('/storage/v1/object/sign/borradores/'), 'la miniatura usa una URL firmada del bucket borradores');
  await pagina.waitForFunction(() => document.querySelector('iframe[title="Vista previa: inicio"]')?.contentDocument?.getElementById('marca-logo')?.src.includes('/storage/v1/object/sign/borradores/'));
  revisar(true, 'la vista previa recibe el logo recién subido con su URL firmada');
  await pagina.locator('#fachada-archivo').setInputFiles({ name: 'mala.png', mimeType: 'image/png', buffer: Buffer.from('esto no es una imagen') });
  await pagina.locator('#fachada-error').waitFor();
  revisar(/no es una imagen/.test(await pagina.locator('#fachada-error').innerText()), 'un archivo que no es imagen muestra el error junto al campo');
  revisar((await pagina.locator('#fachada-archivo').getAttribute('aria-describedby')).includes('fachada-error'), 'el error del archivo está ligado con aria-describedby');
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  await pagina.getByText('Borrador guardado.').waitFor();
  const conLogo = await leerConfig(P.id);
  revisar(/^medios\/logo-blanco-[0-9a-f]{8}\.png$/.test(conLogo.logos?.blanco?.src ?? ''), 'el src del logo quedó en el borrador');
  igual(conLogo.logos?.blanco?.alt, 'Logo de prueba en blanco', 'el alt del logo quedó en el borrador');
  igual(conLogo.fachada, undefined, 'la fachada con error no quedó guardada');

  console.log('Sesión vencida: el formulario conserva lo escrito');
  const cookies = await contexto.cookies();
  await contexto.clearCookies();
  await pagina.getByLabel('Lugar').fill('Escrito sin sesión');
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  const alerta = pagina.getByRole('alert').filter({ hasText: 'Tu sesión venció' });
  await alerta.waitFor();
  revisar(/Entra de nuevo en otra pestaña/.test(await alerta.innerText()), 'el mensaje dice que entres de nuevo en otra pestaña');
  igual(await pagina.getByLabel('Lugar').inputValue(), 'Escrito sin sesión', 'el campo conserva el texto');
  igual(pagina.url(), `${BASE}/editor/p/${P.slug}`, 'no se redirigió a otra página');
  igual(await pagina.evaluate(() => document.activeElement?.getAttribute('role')), 'alert', 'el resumen recibe el foco');
  igual((await leerConfig(P.id)).lugar, 'Ciudad Arce', 'la base no cambió');
  // Vuelve a entrar (cookies de otra pestaña) y guardar de nuevo funciona sin perder nada
  await contexto.addCookies(cookies);
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  await pagina.getByText('Borrador guardado.').waitFor();
  igual((await leerConfig(P.id)).lugar, 'Escrito sin sesión', 'tras entrar de nuevo, guardar conserva lo escrito');

  console.log('Conflicto: otra persona guardó antes');
  await servicio.from('borradores').update({ config: { ...(await leerConfig(P.id)), lugar: 'Cambio de otra persona' } }).eq('parroquia_id', P.id);
  await pagina.getByLabel('Lugar').fill('Mi cambio tardío');
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  await pagina.getByRole('alert').filter({ hasText: 'Otra persona guardó cambios' }).waitFor();
  igual(await pagina.getByLabel('Lugar').inputValue(), 'Mi cambio tardío', 'el 409 tampoco borra lo escrito');
  igual((await leerConfig(P.id)).lugar, 'Cambio de otra persona', 'el cambio tardío no pisó el de la otra persona');

  console.log('La API responde 401 en JSON, no redirige, sin sesión');
  const anonimo = await navegador.newContext();
  const put = await anonimo.request.put(`${BASE}/editor/api/${P.slug}/borrador`, {
    data: { cambios: { lugar: 'x' }, actualizadoEn: 'x' },
    maxRedirects: 0,
  });
  igual(put.status(), 401, 'PUT sin sesión da 401');
  revisar((put.headers()['content-type'] ?? '').includes('application/json'), 'la respuesta es JSON');
  const post = await anonimo.request.post(`${BASE}/editor/api/${P.slug}/imagen`, {
    multipart: { campo: 'fachada', archivo: { name: 'a.png', mimeType: 'image/png', buffer: png } },
    maxRedirects: 0,
  });
  igual(post.status(), 401, 'POST de imagen sin sesión da 401');
  const pagAnonima = await anonimo.request.get(`${BASE}/editor/p/${P.slug}`, { maxRedirects: 0 });
  revisar([302, 303, 307, 308].includes(pagAnonima.status()), 'la página sin sesión sí redirige a entrar');

  igual(erroresJs.length, 0, 'sin errores de JavaScript en la página' + (erroresJs.length ? ': ' + erroresJs.join(' | ') : ''));
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  await navegador.close();
}

console.log(fallos === 0 ? '\nPruebas de navegador del editor: todo bien.' : `\n${fallos} comprobaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
