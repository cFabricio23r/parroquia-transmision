// Pruebas de navegador de Tipos de transmisión (plan 4, Tareas 8 y 9): la tabla F7 y el
// formulario F8 (nuevo, propio y común). Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import {
  BASE,
  camposSinEtiqueta,
  CONFIG_BASE,
  entrar,
  esperarEnBase,
  esperarGuardado,
  igual,
  leerConfig,
  limpiar,
  prepararParroquia,
  revisar,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

const iguales = (a, b) => {
  const orden = (v) =>
    Array.isArray(v) ? v.map(orden) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, orden(v[k])])) : v;
  return JSON.stringify(orden(a)) === JSON.stringify(orden(b));
};
const TODAS = ['dominical', 'semana', 'horasanta', 'sector', 'patronalsector', 'procesion', 'otros', 'prenovena', 'novena', 'patronal', 'evento'];
const FILAS = [
  'Misa dominical',
  'Misa entre semana',
  'Misa de otro santo',
  'Hora Santa',
  'Misa en sector',
  'Patronal de sector',
  'Novena y fiesta patronal',
  'Procesión',
  'Evento especial',
];
const navegador = await chromium.launch();
const errores = [];
const nuevaPagina = async (correo) => {
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  pagina.on('pageerror', (e) => errores.push(String(e)));
  await entrar(pagina, correo);
  return pagina;
};
const interruptor = (pagina, nombre) => pagina.getByRole('switch', { name: `Mostrar ${nombre} en el panel`, exact: true });

try {
  console.log('F7 · Tipos de transmisión');
  const conTipos = { ...CONFIG_BASE, tipos: { apagados: ['procesion'], propios: [{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora' }] } };
  const P = await prepararParroquia({ config: conTipos });
  const p = await nuevaPagina(P.correo);
  await p.goto(`${BASE}/editor/p/${P.slug}/tipos`);
  igual(await p.locator('h1').innerText(), 'Tipos de transmisión', 'el título es «Tipos de transmisión»');
  revisar(await p.getByText('Los que aparecen en el panel al preparar una transmisión. Los apagados no se ven.').isVisible(), 'el texto del artboard');
  revisar(
    await p
      .getByText('Los comunes los mantiene la Pastoral de Comunicaciones para todas las parroquias. Si cambias sus textos o su imagen, el cambio es solo para tu parroquia.')
      .isVisible(),
    'la nota del artboard',
  );
  const filas = p.locator('[role="table"] [role="row"]').filter({ has: p.locator('[role="cell"]') });
  igual(await filas.count(), 10, 'hay 10 filas de datos');
  const nombres = await filas.locator('.pv-tipo-nombre').allInnerTexts();
  igual(JSON.stringify(nombres), JSON.stringify([...FILAS, 'Rosario de la aurora']), 'las 9 comunes en orden y el propio al final');
  const descripciones = await filas.locator('.pv-tipo-descripcion').allInnerTexts();
  igual(descripciones[0], 'Inicio y Gracias de domingo.', 'la descripción de la dominical');
  igual(descripciones[2], 'Elige la imagen del santo de la galería.', 'la de otro santo');
  igual(descripciones[3], 'Con la imagen de la custodia.', 'la de Hora Santa');
  igual(descripciones[6], 'Con la cuenta regresiva y el lema.', 'la de la novena');
  igual(descripciones[7], 'Con rótulo de lugar o estación.', 'la de la procesión');
  igual(descripciones[9], 'Creado por la parroquia.', 'la del propio');
  igual(await interruptor(p, 'Procesión').getAttribute('aria-checked'), 'false', '«Procesión» está apagada');
  igual(await filas.nth(9).locator('.pv-chip').innerText(), 'Propio', 'el propio dice «Propio»');
  igual(await filas.nth(0).locator('.pv-chip').innerText(), 'Común', 'un común dice «Común»');
  igual(await p.getByRole('link', { name: 'Textos e imagen de Hora Santa' }).getAttribute('href'), `/editor/p/${P.slug}/tipos/horasanta`, '«Textos e imagen» de Hora Santa');
  igual(
    await p.getByRole('link', { name: 'Textos e imagen de Novena y fiesta patronal' }).getAttribute('href'),
    `/editor/p/${P.slug}/tipos/novena`,
    '«Textos e imagen» de la novena',
  );
  igual(
    await p.getByRole('link', { name: 'Textos e imagen de Rosario de la aurora' }).getAttribute('href'),
    `/editor/p/${P.slug}/tipos/rosario-aurora`,
    '«Textos e imagen» del propio',
  );
  const propio = interruptor(p, 'Rosario de la aurora');
  igual(await propio.getAttribute('aria-disabled'), 'true', 'el interruptor del propio está deshabilitado');
  const descripcionPropio = await propio.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '');
  revisar(descripcionPropio.includes('Los tipos propios siempre están en el panel'), 'y explica por qué');
  igual(await p.getByRole('link', { name: '+ Nuevo tipo' }).getAttribute('href'), `/editor/p/${P.slug}/tipos/nuevo`, '«+ Nuevo tipo» lleva a uno nuevo');
  const estadoTipos = await p
    .getByRole('navigation', { name: 'Secciones del editor' })
    .getByRole('link', { name: /^Tipos de transmisión/ })
    .locator('.pv-solo-lectores')
    .innerText();
  igual(estadoTipos, 'Listo', '«Tipos de transmisión» dice «Listo»');
  await interruptor(p, 'Novena y fiesta patronal').click();
  await esperarGuardado(p);
  const c1 = await esperarEnBase(P.id, (c) => c.tipos?.apagados?.length === 4);
  igual(JSON.stringify(c1.tipos.apagados), JSON.stringify(['procesion', 'prenovena', 'novena', 'patronal']), 'apagar la novena apaga sus tres claves');
  await p.goto(`${BASE}/editor/p/${P.slug}`);
  revisar(await p.getByText('8 activos, 1 propio.').isVisible(), 'el Resumen dice «8 activos, 1 propio.» (7 filas encendidas más el propio)');

  console.log('F7 · El último tipo');
  const U = await prepararParroquia({ config: { ...CONFIG_BASE, tipos: { apagados: TODAS.filter((k) => k !== 'dominical') } } });
  const pu = await nuevaPagina(U.correo);
  const puts = [];
  pu.on('request', (r) => r.method() === 'PUT' && r.url().includes('/borrador') && puts.push(r.postData() ?? ''));
  await pu.goto(`${BASE}/editor/p/${U.slug}/tipos`);
  const dominical = interruptor(pu, 'Misa dominical');
  igual(await dominical.getAttribute('aria-disabled'), 'true', 'el interruptor de la dominical está deshabilitado');
  revisar(await pu.getByText('Tiene que quedar al menos un tipo en el panel.').isVisible(), 'se ve «Tiene que quedar al menos un tipo en el panel.»');
  const antesU = await leerConfig(U.id);
  await dominical.click({ force: true });
  await pu.waitForTimeout(1500);
  revisar(iguales(await leerConfig(U.id), antesU), 'hacer clic no cambió la base');
  revisar(puts.every((d) => !TODAS.every((k) => d.includes(`"${k}"`))), 'ningún PUT llevó los 11 apagados');

  console.log('F7 · Diez propios y config viejo');
  const diez = Array.from({ length: 10 }, (_, i) => ({ clave: `propio-${i + 1}`, nombre: `Propio ${i + 1}` }));
  const D = await prepararParroquia({ config: { ...CONFIG_BASE, tipos: { propios: diez, ajustes: { prenovena: { textoInicio: 'Viejo' } } } } });
  const pd = await nuevaPagina(D.correo);
  const antesD = await leerConfig(D.id);
  await pd.goto(`${BASE}/editor/p/${D.slug}/tipos`);
  igual(await pd.getByRole('button', { name: '+ Nuevo tipo' }).getAttribute('aria-disabled'), 'true', 'con 10 propios «+ Nuevo tipo» está deshabilitado');
  revisar(await pd.getByText('Hasta 10 tipos propios.').isVisible(), 'y dice «Hasta 10 tipos propios.»');
  await pd.waitForTimeout(1500);
  revisar(iguales(await leerConfig(D.id), antesD), 'abrir la tabla con ajustes en prenovena no cambió la base');
  igual((await camposSinEtiqueta(pd)).length, 0, 'todo campo tiene etiqueta');

  // F8 (Tarea 9)
} finally {
  await navegador.close();
  await limpiar();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('tipos');
