// Pruebas de navegador de «¿Dónde sale la misa?» y de la columna «Facebook» del admin (Tarea 5), contra
// `next dev` + Supabase local. Graph falso (FACEBOOK_GRAPH_FALSO=1, lo pone el runner): no sale a internet.
// Los tokens y los page_id de prueba son falsos y se notan; no tienen que aparecer en el HTML, la consola
// ni una respuesta. Slugs, correos y page_id con sufijo aleatorio; todo se borra al final.
import { createCipheriv, randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { BASE, VIEWPORT, camposSinEtiqueta, entrar, igual, limpiar, prepararParroquia, revisar, servicio, sufijo, terminar } from './lib/editor.mjs';
import { CLAVE } from './lib/editor.mjs';

const MARCA_TOKEN = 'TOKEN-FALSO-FB';
const llave = Buffer.from(process.env.FACEBOOK_CLAVE_CIFRADO ?? '', 'base64');
if (llave.length !== 32) throw new Error('Falta FACEBOOK_CLAVE_CIFRADO de prueba (lo pone el runner)');
// Mismo sobre que lib/facebook/cifrado.ts: v1.<iv>.<tag>.<datos>, todo en base64url.
function sellar(texto) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', llave, iv, { authTagLength: 16 });
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), datos.toString('base64url')].join('.');
}

const sfx = sufijo();
const ID = { arce: `pg-${sfx}-arce`, vicaria: `pg-${sfx}-vicaria`, falta: `pg-${sfx}-sector5-falta`, chica: `pg-${sfx}-chica`, otra: `pg-${sfx}-otra` };
const PAGINAS = [
  { id: ID.arce, nombre: 'Parroquia Ciudad Arce', seguidores: 2340 },
  { id: ID.vicaria, nombre: 'Vicaría Ciudad Arce', seguidores: 900 },
  { id: ID.falta, nombre: 'Sector 5', seguidores: 300 },
  { id: ID.chica, nombre: 'Sector 1', seguidores: 40 },
  { id: ID.otra, nombre: 'Página de la otra', seguidores: 1000 },
];

async function sembrarConexion(parroquiaId, estado = 'conectado', paginas = PAGINAS) {
  const { error } = await servicio
    .from('facebook_conexion')
    .insert({ parroquia_id: parroquiaId, nombre_facebook: 'Comunicaciones Ciudad Arce', token_usuario: sellar(`${MARCA_TOKEN}-USUARIO`), estado });
  if (error) throw error;
  if (!paginas.length) return;
  const { error: ep } = await servicio.from('facebook_paginas').insert(
    paginas.map((p) => ({ parroquia_id: parroquiaId, page_id: p.id, nombre: p.nombre, seguidores: p.seguidores, token: sellar(`${MARCA_TOKEN}-${p.id}`) })),
  );
  if (ep) throw ep;
}

const SOBRE = /v1\.[A-Za-z0-9_-]{16,}\./; // un token sellado (v1.<iv>.<tag>.<datos>)
const esperar = async (cond, timeout = 8000) => {
  const limite = Date.now() + timeout;
  for (;;) {
    const v = await cond();
    if (v || Date.now() > limite) return v;
    await new Promise((ok) => setTimeout(ok, 250));
  }
};
const alto = async (loc) => (await loc.boundingBox())?.height ?? 0;
const adminCreado = [];

const navegador = await chromium.launch();
try {
  // La parroquia P (conectada), la Q (principal de «Página de la otra»; también conectada y a reconectar)
  // y la R (sin conexión): para la columna del admin.
  const P = await prepararParroquia({ nombre: 'Ana Coordinadora' });
  const Q = await prepararParroquia({ nombre: null });
  const R = await prepararParroquia({ nombre: null });
  await sembrarConexion(P.id);
  await sembrarConexion(Q.id, 'reconectar', [{ id: ID.otra, nombre: 'Página de la otra', seguidores: 1000 }]);
  const { error: eq } = await servicio.from('facebook_parroquia').insert({ parroquia_id: Q.id, pagina_principal: ID.otra });
  if (eq) throw eq;

  const contexto = await navegador.newContext({ viewport: VIEWPORT });
  const pagina = await contexto.newPage();
  const consola = [];
  const respuestas = [];
  pagina.on('console', (m) => consola.push(m.text()));
  pagina.on('pageerror', (e) => revisar(false, `error de JavaScript: ${e.message}`));
  pagina.on('response', async (r) => {
    if (r.url().includes('/app/facebook/paginas')) respuestas.push(await r.text().catch(() => ''));
  });
  await entrar(pagina, P.correo);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/app-y-transmision/facebook`);

  console.log('Pantalla');
  const titulo = pagina.getByRole('heading', { level: 1 });
  igual(await titulo.innerText(), '¿Dónde sale la misa?', 'el título es «¿Dónde sale la misa?»');
  igual(await titulo.evaluate((e) => getComputedStyle(e).fontSize), '26px', 'el título mide 26 px');
  const menu = pagina.locator('nav[aria-label="Secciones del editor"]');
  igual(await menu.locator('a[aria-current="page"]').innerText(), 'App y transmisión', 'en el menú sigue marcada «App y transmisión»');
  igual(await pagina.locator('.pv-chip-borrador').count(), 0, 'no hay chip «Borrador · N cambios sin publicar»');
  revisar(await pagina.locator('[role="status"].pv-guardado').isVisible(), 'el encabezado sigue diciendo el estado del guardado');
  revisar((await pagina.getByText('con la cuenta').innerText()).includes('Comunicaciones Ciudad Arce · ve 5 páginas'), 'dice la cuenta y que ve 5 páginas');
  revisar(await pagina.getByText('Conectado', { exact: true }).isVisible(), 'el estado «Conectado» tiene texto');

  const principal = pagina.locator('#principal');
  const opcionOtra = principal.locator(`option[value="${ID.otra}"]`);
  igual(await opcionOtra.isDisabled(), true, '«Principal de otra parroquia» deshabilita esa opción');
  revisar((await opcionOtra.innerText()).includes('Principal de otra parroquia'), 'y la opción lo dice con texto');
  revisar((await principal.locator(`option[value="${ID.arce}"]`).innerText()).includes('2.340 seguidores'), 'la opción muestra «2.340 seguidores»');

  console.log('Elegir');
  await pagina.getByRole('button', { name: 'Guardar páginas' }).click();
  await pagina.getByText('Elige la página principal.').waitFor();
  revisar(true, 'sin principal, pide elegirla y no guarda');
  igual((await servicio.from('facebook_parroquia').select('parroquia_id').eq('parroquia_id', P.id)).data.length, 0, 'nada guardado todavía');

  await principal.selectOption(ID.chica);
  revisar(await pagina.getByText('Menos de 100 seguidores: Facebook no deja transmitir').isVisible(), 'una principal con menos de 100 seguidores muestra el chip ámbar');
  await principal.selectOption(ID.arce);
  igual(await pagina.getByText('Menos de 100 seguidores: Facebook no deja transmitir').count(), 0, 'con 2.340 seguidores el chip no sale');
  igual(await pagina.locator('.pv-fb-extras').getByText('Parroquia Ciudad Arce').count(), 0, 'la principal no se ofrece como extra');

  await pagina.getByLabel('Vicaría Ciudad Arce').check();
  await pagina.getByLabel('Marcada por defecto').first().check();
  await pagina.getByLabel('Sector 5').check();
  revisar(await pagina.getByText('No marcada: no se ofrece en la app').first().isVisible(), 'una extra sin marcar dice «No marcada: no se ofrece en la app»');
  await pagina.getByRole('button', { name: 'Guardar páginas' }).click();
  await pagina.getByText('Páginas guardadas.').waitFor({ timeout: 15_000 });

  const filaVicaria = pagina.locator('.pv-fb-fila').filter({ hasText: 'Vicaría Ciudad Arce' });
  const filaFalta = pagina.locator('.pv-fb-fila').filter({ hasText: 'Sector 5' });
  revisar(await filaVicaria.getByText('Listo para compartir').isVisible(), 'la extra con permiso queda «Listo para compartir»');
  revisar(await filaFalta.getByText('Falta permitir que comparta').isVisible(), 'la extra sin permiso queda «Falta permitir que comparta»');
  const como = filaFalta.getByRole('button', { name: 'Cómo hacerlo' });
  revisar(await como.isVisible(), 'y trae el enlace «Cómo hacerlo»');
  await como.click();
  const dialogo = pagina.getByRole('dialog', { name: 'Cómo permitir que la página comparta' });
  await dialogo.waitFor();
  const ancho = (await dialogo.boundingBox()).width;
  revisar(ancho > 0 && ancho <= 556, `el diálogo tiene ancho máximo (${Math.round(ancho)} px)`);
  await dialogo.getByRole('button', { name: 'Cerrar' }).click();
  await dialogo.waitFor({ state: 'hidden' });

  const base = await esperar(async () => {
    const f = (await servicio.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', P.id).maybeSingle()).data;
    return f;
  });
  igual(base?.pagina_principal, ID.arce, 'la base tiene la principal');
  const extras = (await servicio.from('facebook_parroquia_extra').select('page_id, por_defecto, crosspost').eq('parroquia_id', P.id)).data ?? [];
  igual(
    JSON.stringify(extras.map((e) => [e.page_id, e.por_defecto, e.crosspost]).sort()),
    JSON.stringify([[ID.vicaria, true, 'listo'], [ID.falta, false, 'falta']].sort()),
    'la base tiene las extras con su «por defecto» y su crosspost',
  );

  console.log('Recargar');
  await pagina.reload();
  igual(await pagina.locator('#principal').inputValue(), ID.arce, 'después de recargar sigue la principal');
  revisar(await pagina.locator('.pv-fb-fila').filter({ hasText: 'Sector 5' }).getByText('Falta permitir que comparta').isVisible(), 'y los chips');

  console.log('Error de principal ajena');
  const r = await pagina.evaluate(async (args) => {
    const res = await fetch(`/editor/api/${args.slug}/app/facebook/paginas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principal: args.otra, extras: [] }),
    });
    return { estado: res.status, cuerpo: await res.json() };
  }, { slug: P.slug, otra: ID.otra });
  igual(r.estado, 422, 'una principal que es de otra parroquia da 422');
  igual(r.cuerpo.error, 'Esa página ya es la principal de otra parroquia.', 'con el texto exacto');
  revisar(!JSON.stringify(r.cuerpo).includes(Q.slug), 'sin nombrar a la otra parroquia');
  igual(
    (await servicio.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', P.id).single()).data.pagina_principal,
    ID.arce,
    'y la principal de P no cambió',
  );

  console.log('Usabilidad');
  const marcas = pagina.locator('.pv-fb-marca');
  let chicos = 0;
  for (const m of await marcas.all()) if ((await alto(m)) < 44) chicos++;
  igual(chicos, 0, 'cada fila de página mide 44 px o más');
  igual((await alto(pagina.getByRole('button', { name: 'Guardar páginas' }))) >= 44, true, '«Guardar páginas» mide 44 px o más');
  igual((await alto(pagina.getByRole('link', { name: 'Cancelar' }))) >= 44, true, '«Cancelar» mide 44 px o más');
  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo tiene etiqueta');
  const html = await pagina.content();
  revisar(!html.includes(MARCA_TOKEN) && !SOBRE.test(html), 'el HTML no trae ningún token');
  revisar(!consola.some((t) => t.includes(MARCA_TOKEN)), 'la consola no trae ningún token');
  revisar(respuestas.length > 0 && !respuestas.some((t) => t.includes(MARCA_TOKEN) || SOBRE.test(t)), 'las respuestas no traen ningún token');

  console.log('Administrador');
  const correoAdmin = `nav-admin-${sufijo()}@prueba.test`;
  const { data: ua, error: eua } = await servicio.auth.admin.createUser({ email: correoAdmin, password: CLAVE, email_confirm: true });
  if (eua) throw eua;
  adminCreado.push(ua.user.id);
  const { error: ea } = await servicio.from('administradores').insert({ usuario_id: ua.user.id });
  if (ea) throw ea;
  const pa = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  pa.on('pageerror', (e) => revisar(false, `error de JavaScript (admin): ${e.message}`));
  await entrar(pa, correoAdmin);
  // El admin entra directo a Parroquias: se espera a que cargue antes de pedirla (si no, el goto la aborta).
  console.log('  (aterrizó en ' + new URL(pa.url()).pathname + ')');
  for (let intento = 0; ; intento++) {
    try {
      await pa.goto(`${BASE}/editor/admin`, { waitUntil: 'load', timeout: 60_000 });
      break;
    } catch (e) {
      if (intento >= 3 || !String(e).includes('ERR_ABORTED')) throw e;
      await pa.waitForTimeout(3000);
    }
  }
  const tabla = pa.getByRole('table', { name: 'Parroquias de la vicaría' });
  await tabla.waitFor();
  revisar(await tabla.getByRole('columnheader', { name: 'Facebook' }).isVisible(), 'la tabla tiene la columna «Facebook»');
  const fila = (parroquia) => tabla.getByRole('row').filter({ hasText: `Parroquia ${parroquia.slug}` });
  const celdaP = fila(P);
  revisar(await celdaP.getByText('Conectado', { exact: true }).isVisible(), 'P: «Conectado»');
  revisar(await celdaP.getByText('Parroquia Ciudad Arce + 2').isVisible(), 'P: la principal y «+ 2»');
  revisar(await fila(Q).getByText('Hay que volver a conectar').isVisible(), 'Q: «Hay que volver a conectar»');
  revisar(await fila(Q).getByText('Usa la clave de transmisión').isVisible(), 'Q: «Usa la clave de transmisión»');
  revisar(await fila(R).getByText('Sin conectar').isVisible(), 'R: «Sin conectar»');
  igual(await tabla.locator('[role="cell"] button, [role="cell"] input').filter({ hasText: /Facebook/ }).count(), 0, 'la columna es solo lectura (sin botones de Facebook)');
  const tarjeta = pa.getByRole('region', { name: 'Para que una parroquia pueda conectar su Facebook' });
  revisar(await tarjeta.isVisible(), 'está la tarjeta «Para que una parroquia pueda conectar su Facebook»');
  igual(await tarjeta.locator('ol > li').count(), 3, 'con los tres pasos');
  revisar((await tarjeta.locator('ol > li').first().innerText()).includes('«tester»'), 'el primero habla de «tester»');
  const htmlAdmin = await pa.content();
  revisar(!htmlAdmin.includes(MARCA_TOKEN) && !SOBRE.test(htmlAdmin) && !htmlAdmin.includes(sfx), 'el HTML del admin no trae tokens ni page_id');
  igual(await pa.locator('h1').evaluate((e) => getComputedStyle(e).fontSize), '24px', 'el título de Parroquias no cambió (pantalla vieja)');
} catch (e) {
  revisar(false, `excepción: ${e instanceof Error ? e.message : e}`);
} finally {
  await navegador.close();
  await limpiar();
  for (const id of adminCreado) await servicio.auth.admin.deleteUser(id);
}
terminar('Facebook');
