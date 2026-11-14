// Pruebas de navegador de la vista previa continua (plan 3, Tarea 9): un solo iframe para todo el
// editor, «Ver con el tipo», el borrador local por postMessage y las medidas del artboard.
// Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import {
  BASE,
  CONFIG_BASE,
  entrar,
  igual,
  leerConfig,
  limpiar,
  prepararParroquia,
  revisar,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

const cerca = (a, b) => Math.abs(a - b) <= 1;
// El título que muestra la pantalla para Hora Santa (`vicaria/tipos.js`, `horasanta.titulo`).
const TITULO_HORA_SANTA = 'HORA SANTA';

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia({ config: { ...CONFIG_BASE, avisos: [{ texto: 'Colecta para el techo' }] } });
  const contexto = await navegador.newContext({ viewport: VIEWPORT });
  const pagina = await contexto.newPage();
  const pedidosConfig = [];
  pagina.on('request', (r) => r.url().includes('config.json') && pedidosConfig.push(r.url()));
  await entrar(pagina, P.correo);

  console.log('Identidad');
  await pagina.goto(`${BASE}/editor/p/${P.slug}/identidad`);
  const marco = pagina.locator('iframe.pv-previa-marco');
  await marco.waitFor();
  igual(await marco.getAttribute('title'), 'Vista previa: inicio', 'el iframe se llama «Vista previa: inicio»');
  revisar((await marco.getAttribute('src')).endsWith(`/${P.slug}/pantalla.html?tipo=inicio&vista-previa=1`), 'el iframe muestra la pantalla de inicio');
  const caja = await marco.boundingBox();
  revisar(cerca(caja.width, 552) && cerca(caja.height, 310.5), `el iframe mide 552 × 310 (mide ${caja.width} × ${caja.height})`);
  const montado = await marco.getAttribute('data-montado');

  const tipo = pagina.getByLabel('Ver con el tipo');
  igual(await tipo.locator('option').first().innerText(), 'Misa dominical', '«Misa dominical» es el primer tipo');
  await tipo.selectOption({ label: 'Hora Santa' });
  const dentro = pagina.frameLocator('iframe.pv-previa-marco');
  await dentro.locator('body').getByText(TITULO_HORA_SANTA).first().waitFor({ timeout: 5000 });
  revisar(true, 'al elegir «Hora Santa» la pantalla muestra su título');

  const antes = await leerConfig(P.id);
  await pagina.getByLabel('Nombre completo').fill('Parroquia San José Obrero');
  await dentro.locator('body').getByText('Parroquia San José Obrero').first().waitFor({ timeout: 2000 }).catch(() => {});
  const visto = await dentro.locator('body').innerText();
  const enBase = await leerConfig(P.id);
  revisar(visto.includes('Parroquia San José Obrero') || visto.includes('San José Obrero'), 'lo escrito se ve en el iframe');
  igual(enBase.nombre, antes.nombre, 'y todavía no está en la base (la vista previa usa el borrador local)');

  console.log('Patrono, galería y vuelta');
  await pagina.getByRole('link', { name: /^Patrono y fiesta/ }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/patrono`);
  await pagina.waitForFunction(() => document.querySelector('iframe.pv-previa-marco')?.getAttribute('src')?.includes('tipo=portada'));
  igual(await marco.getAttribute('data-montado'), montado, 'es el mismo iframe (no se volvió a montar)');
  igual(await pagina.locator('#pv-previa-titulo').innerText(), 'Vista previa · Portada de la fiesta', 'el título es «Vista previa · Portada de la fiesta»');
  await pagina.getByRole('link', { name: /^Galería/ }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/galeria`);
  revisar(!(await pagina.locator('section.pv-previa').isVisible()), 'en Galería la vista previa está oculta');
  igual(await marco.getAttribute('data-montado'), montado, 'pero sigue montada');
  await pagina.getByRole('link', { name: /^Identidad/ }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/identidad`);
  igual(await tipo.locator('option:checked').innerText(), 'Hora Santa', 'al volver a Identidad sigue elegida «Hora Santa»');

  console.log('Avisos');
  await pagina.getByRole('link', { name: /^Avisos fijos/ }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/avisos`);
  await pagina.waitForFunction(() => document.querySelector('iframe.pv-previa-marco')?.getAttribute('src')?.includes('tipo=avisos'));
  const cajaAvisos = await marco.boundingBox();
  revisar(cerca(cajaAvisos.width, 560) && cerca(cajaAvisos.height, 315), `en Avisos mide 560 × 315 (mide ${cajaAvisos.width} × ${cajaAvisos.height})`);
  igual(await pagina.locator('#pv-previa-titulo').innerText(), 'Vista previa · Avisos', 'el título es «Vista previa · Avisos»');

  console.log('Ancho menor');
  await pagina.setViewportSize({ width: 1000, height: 900 });
  await pagina.goto(`${BASE}/editor/p/${P.slug}/identidad`);
  await marco.waitFor();
  const formulario = await pagina.locator('.pv-editor-form').boundingBox();
  const previa = await pagina.locator('section.pv-previa').boundingBox();
  revisar(previa.y >= formulario.y + formulario.height - 1, 'a 1000 px la vista previa queda debajo del formulario');

  console.log('Almacenamiento y red');
  const claves = await dentro.locator('body').evaluate(() => Object.keys(localStorage));
  revisar(claves.every((k) => k.startsWith('pev_vistaprevia_')), `el iframe solo usa claves pev_vistaprevia_ (${claves.join(', ')})`);
  igual(pedidosConfig.length, 0, 'ningún iframe pidió config.json');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('vista-previa');
