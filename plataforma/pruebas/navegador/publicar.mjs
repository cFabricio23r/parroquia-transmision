// Pruebas de navegador de «Publicar» y «Versiones» (Playwright), contra `next dev` + Supabase local.
// Se corren con `npm run test:navegador` (herramientas/navegador.mjs). Slugs y correos con sufijo aleatorio.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.BASE_URL;
const servicio = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
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

const { esquema, version, publicado, slug: _slug, ...BASE_CONFIG } = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
void esquema, void version, void publicado, void _slug;

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
  const correo = `pubnav-${sufijo()}@prueba.test`;
  const { data: u, error: eu } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (eu) throw eu;
  const { error: em } = await servicio.from('miembros').insert({ parroquia_id: p.id, usuario_id: u.user.id });
  if (em) throw em;
  return { id: p.id, slug, correo, config };
}
const leerBorrador = async (id) => (await servicio.from('borradores').select('config, actualizado_en').eq('parroquia_id', id).single()).data;
const numeros = async (id) => ((await servicio.from('versiones').select('numero').eq('parroquia_id', id).order('numero')).data ?? []).map((v) => v.numero);

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

const navegador = await chromium.launch();
let P;
try {
  P = await preparar();
  const contexto = await navegador.newContext({ viewport: { width: 1000, height: 1400 } });
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

  console.log('Entrar y abrir la página');
  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.getByLabel('Correo').fill(P.correo);
  await pagina.getByLabel('Contraseña').fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}`);
  await pagina.getByText('Todavía no publicaste').waitFor();
  revisar(true, 'sin versiones dice «Todavía no publicaste»');
  revisar(await pagina.getByText('Todavía no has publicado ninguna versión.').isVisible(), 'la lista de versiones está vacía');

  console.log('Con cambios sin guardar, «Publicar» queda bloqueado');
  const botonPublicar = pagina.getByRole('button', { name: 'Publicar', exact: true });
  igual(await botonPublicar.getAttribute('aria-disabled'), 'false', 'sin cambios, «Publicar» no está bloqueado');
  const lugarOriginal = await pagina.getByLabel('Lugar').inputValue();
  await pagina.getByLabel('Lugar').fill(lugarOriginal + ' (cambio)');
  const avisoSinGuardar = pagina.getByText('Tienes cambios sin guardar. Guarda antes de publicar');
  await avisoSinGuardar.waitFor();
  revisar(await avisoSinGuardar.isVisible(), 'aparece «Tienes cambios sin guardar. Guarda antes de publicar»');
  igual(await botonPublicar.getAttribute('aria-disabled'), 'true', '«Publicar» tiene aria-disabled="true"');
  const descrito = await botonPublicar.getAttribute('aria-describedby');
  revisar(!!descrito && (await pagina.locator(`#${descrito}`).innerText()).includes('Tienes cambios sin guardar'), 'el aviso está ligado al botón con aria-describedby');
  await botonPublicar.click({ force: true }); // aria-disabled no bloquea el clic real: lo frena la guarda del componente
  await pagina.waitForTimeout(500);
  igual(JSON.stringify(await numeros(P.id)), '[]', 'el clic con cambios sin guardar no publica nada');
  await pagina.getByLabel('Lugar').fill(lugarOriginal);
  await avisoSinGuardar.waitFor({ state: 'detached' });
  igual(await botonPublicar.getAttribute('aria-disabled'), 'false', 'volver a lo guardado desbloquea «Publicar»');
  await pagina.getByLabel('Lugar').fill(lugarOriginal + ' (cambio)');
  await avisoSinGuardar.waitFor();
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  await pagina.getByText('Borrador guardado.').waitFor();
  await avisoSinGuardar.waitFor({ state: 'detached' });
  igual(await botonPublicar.getAttribute('aria-disabled'), 'false', 'al guardar, «Publicar» se desbloquea');
  await pagina.getByLabel('Lugar').fill(lugarOriginal);
  await pagina.getByRole('button', { name: 'Guardar borrador' }).click();
  await avisoSinGuardar.waitFor({ state: 'detached' });
  await pagina.waitForFunction(() => document.querySelector('[role="status"].aviso')?.textContent === 'Borrador guardado.');
  const antes = await leerBorrador(P.id);

  console.log('Publicar');
  await pagina.getByRole('button', { name: 'Publicar', exact: true }).click();
  await pagina.getByRole('button', { name: 'Volver a esta versión: la 1' }).waitFor();
  igual(JSON.stringify(await numeros(P.id)), '[1]', 'quedó la versión 1');
  igual(await pagina.evaluate(() => document.activeElement?.textContent), 'Publicar', 'al terminar de publicar el foco sigue en «Publicar» (no cae al body)');
  await pagina.getByText('Publicaste la versión 1; las pantallas todavía no la tienen').waitFor();
  revisar(true, 'con las pantallas en 404 dice «las pantallas todavía no la tienen»');
  const fila1 = await pagina.getByRole('row').filter({ hasText: 'Volver a esta versión' }).first().innerText();
  revisar(/^1\s/.test(fila1) && /\d{4}/.test(fila1) && fila1.includes(P.correo), 'la fila muestra número, fecha y quién (el correo)');
  enPantallas = 1;
  await pagina.getByRole('button', { name: 'Comprobar de nuevo' }).click();
  await pagina.getByText('Publicado y en las pantallas (versión 1)').waitFor();
  revisar(true, 'con las pantallas en la 1 dice «Publicado y en las pantallas (versión 1)»');

  console.log('Segunda publicación y estado «todavía no llegó»');
  await pagina.getByRole('button', { name: 'Publicar', exact: true }).click();
  await pagina.getByText('Publicaste la versión 2; todavía no llegó a las pantallas (están en la 1)').waitFor();
  revisar(true, 'dice «todavía no llegó a las pantallas (están en la 1)»');
  revisar((await pagina.getByRole('status').filter({ hasText: 'Publicaste la versión 2' }).count()) === 1, 'el estado está en una región role="status"');

  console.log('Volver a esta versión: diálogo accesible');
  const botonFila1 = pagina.getByRole('button', { name: 'Volver a esta versión: la 1' });
  await botonFila1.click();
  const dialogo = pagina.getByRole('dialog', { name: 'Volver a la versión 1' });
  await dialogo.waitFor();
  revisar((await dialogo.innerText()).includes('Se publica de nuevo la versión 1 como versión nueva. Tu borrador no cambia'), 'el diálogo dice el texto del plan');
  igual(await pagina.evaluate(() => document.activeElement?.textContent), 'Cancelar', 'el foco entra al diálogo, en «Cancelar»');
  await pagina.keyboard.press('Escape');
  await dialogo.waitFor({ state: 'hidden' });
  igual(await pagina.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Volver a esta versión: la 1', 'Escape cierra y el foco vuelve al botón');
  igual(JSON.stringify(await numeros(P.id)), '[1,2]', 'cancelar no publica nada');

  console.log('Confirmar');
  await botonFila1.click();
  await dialogo.waitFor();
  await dialogo.getByRole('button', { name: 'Sí, volver a esta versión' }).click();
  await pagina.getByText('(copia de la versión 1)').waitFor();
  igual(JSON.stringify(await numeros(P.id)), '[1,2,3]', 'quedó la versión 3');
  igual(await pagina.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Volver a esta versión: la 1', 'al terminar de restaurar el foco está en el botón de la fila');
  const fila3 = await pagina.getByRole('row').filter({ hasText: '(copia de la versión 1)' }).innerText();
  revisar(/^3\s/.test(fila3), 'la fila de la 3 dice «(copia de la versión 1)»');
  const despues = await leerBorrador(P.id);
  revisar(isDeepStrictEqual(despues, antes), 'el borrador no cambió (ni su sello): no hay conflicto falso');
  const { data: cfg } = await servicio.storage.from('publicado').download(`${P.slug}/config.json`);
  igual(JSON.parse(await cfg.text()).version, 3, 'config.json publicado tiene version 3');

  console.log('Un borrador incompleto muestra los errores con foco');
  const { lugar, ...sinLugar } = P.config;
  void lugar;
  await servicio.from('borradores').update({ config: sinLugar }).eq('parroquia_id', P.id);
  await pagina.reload();
  await pagina.getByRole('button', { name: 'Publicar', exact: true }).click();
  const alerta = pagina.getByRole('alert').filter({ hasText: 'No se puede publicar todavía' });
  await alerta.waitFor();
  revisar(/lugar/i.test(await alerta.innerText()), 'el resumen dice qué falta');
  igual(await pagina.evaluate(() => document.activeElement?.getAttribute('role')), 'alert', 'el resumen recibe el foco');
  igual(JSON.stringify(await numeros(P.id)), '[1,2,3]', 'no se creó versión');

  igual(erroresJs.length, 0, 'sin errores de JavaScript en la página' + (erroresJs.length ? ': ' + erroresJs.join(' | ') : ''));
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  await navegador.close();
  if (P) {
    await borrarCarpeta('borradores', P.id);
    await borrarCarpeta('publicado', P.slug);
  }
}

console.log(fallos === 0 ? '\nPruebas de navegador de publicar: todo bien.' : `\n${fallos} comprobaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
