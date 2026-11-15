// Pruebas de navegador del marco del editor (plan 3, Tarea 8): encabezado con el chip del borrador,
// menú con estados, páginas provisionales, parroquia ajena y celular. Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import {
  BASE,
  camposSinEtiqueta,
  CONFIG_BASE,
  entrar,
  fallar,
  igual,
  limpiar,
  prepararParroquia,
  revisar,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

const SECCIONES = [
  'Resumen',
  'Identidad',
  'Patrono y fiesta',
  'Pantallas',
  'Rótulos y estilo',
  'Tipos de transmisión',
  'Galería',
  'Horarios y redes',
  'Avisos fijos',
  'Transmisiones de la semana',
  'App y transmisión',
  'Publicar',
];
const chip = (pagina) => pagina.locator('.pv-chip-borrador').innerText();

const navegador = await chromium.launch();
try {
  console.log('Entrar y ver el marco');
  const minimo = { nombre: 'Parroquia mínima', lugar: 'Lugar' };
  const P = await prepararParroquia({ config: minimo });
  const contexto = await navegador.newContext({ viewport: VIEWPORT });
  const pagina = await contexto.newPage();
  const erroresJs = [];
  pagina.on('pageerror', (e) => erroresJs.push(e.message));
  await entrar(pagina, P.correo);
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}`);
  revisar(await pagina.getByText('Editor · Parroquia mínima').isVisible(), 'el encabezado dice «Editor · <nombre>»');
  revisar(await pagina.getByText('María López · Coordinador').isVisible(), 'el encabezado dice «María López · Coordinador»');
  igual(await chip(pagina), 'Borrador · sin publicar todavía', 'sin versiones, el chip dice «Borrador · sin publicar todavía»');

  console.log('Menú');
  const menu = pagina.locator('nav[aria-label="Secciones del editor"]');
  const enlaces = menu.getByRole('link');
  igual(await enlaces.count(), 12, 'el menú tiene 12 enlaces');
  const textos = await enlaces.evaluateAll((l) => l.map((a) => a.childNodes[0]?.textContent?.trim()));
  igual(JSON.stringify(textos), JSON.stringify(SECCIONES), 'los enlaces están en el orden del diseño');
  igual(await menu.getByRole('link', { name: /^Resumen/ }).getAttribute('aria-current'), 'page', '«Resumen» es la página actual');
  const estados = await enlaces.evaluateAll((l) => l.map((a) => a.querySelector('.pv-solo-lectores')?.textContent ?? null));
  revisar(estados.slice(0, 9).every((e) => ['Listo', 'Revisar', 'Falta algo', 'Opcional'].includes(e)), 'cada ítem salvo Semana, App y Publicar tiene su estado para lectores');
  igual(estados[9], null, '«Transmisiones de la semana» no tiene punto');
  igual(estados[10], null, '«App y transmisión» no tiene punto');
  igual(estados[11], null, '«Publicar» no tiene punto');
  igual(estados[1], 'Falta algo', 'con el borrador mínimo, «Identidad» dice «Falta algo»');
  igual(estados[8], 'Opcional', '«Avisos fijos» dice «Opcional»');
  revisar(
    await menu.getByText('Todo se guarda solo como borrador. En OBS no cambia nada hasta que publiques. App y transmisión se guarda al instante y no necesita Publicar.').isVisible(),
    'la nota del pie está en el menú',
  );
  await menu.getByRole('link', { name: /^Galería/ }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/galeria`);
  igual(await menu.getByRole('link', { name: /^Galería/ }).getAttribute('aria-current'), 'page', '«Galería» pasa a ser la actual');

  console.log('Pantallas (plan 4: ya no es provisional)');
  await pagina.goto(`${BASE}/editor/p/${P.slug}/pantallas`);
  revisar(await pagina.getByRole('heading', { level: 1, name: 'Pantallas de OBS' }).isVisible(), '«Pantallas» tiene su página');
  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo tiene etiqueta');

  console.log('Chip con versiones');
  const V3igual = await prepararParroquia({ config: CONFIG_BASE, versiones: [{ numero: 3, config: CONFIG_BASE }] });
  const p2 = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(p2, V3igual.correo);
  await p2.goto(`${BASE}/editor/p/${V3igual.slug}`);
  igual(await chip(p2), 'Al día con la versión 3', 'con la versión 3 igual al borrador: «Al día con la versión 3»');
  const V3distinta = await prepararParroquia({
    config: { ...CONFIG_BASE, avisos: [{ texto: 'Colecta' }] },
    versiones: [{ numero: 3, config: { ...CONFIG_BASE, lugar: 'Otro lugar' } }],
  });
  const p3 = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(p3, V3distinta.correo);
  await p3.goto(`${BASE}/editor/p/${V3distinta.slug}`);
  igual(await chip(p3), 'Borrador · 2 cambios sin publicar', 'con lugar y avisos distintos: «Borrador · 2 cambios sin publicar»');

  console.log('Parroquia ajena');
  await pagina.goto(`${BASE}/editor/p/${V3igual.slug}`);
  revisar(await pagina.getByText('No encontramos esa parroquia').isVisible(), 'una parroquia de otro coordinador muestra «No encontramos esa parroquia»');

  console.log('Celular');
  await pagina.setViewportSize({ width: 700, height: 900 });
  await pagina.goto(`${BASE}/editor/p/${P.slug}`);
  revisar(await pagina.getByText(/El editor está pensado para una computadora/).isVisible(), 'a 700 px se ve la caja de información');

  igual(erroresJs.length, 0, 'sin errores de JavaScript' + (erroresJs.length ? ': ' + erroresJs.join(' | ') : ''));
} catch (e) {
  console.error(e);
  fallar();
} finally {
  await navegador.close();
  await limpiar();
}
process.exit(terminar('el marco del editor'));
