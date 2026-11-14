// Pruebas de navegador de las pantallas de OBS (plan 4, Tareas 3 y 4): la lista F4 con sus
// miniaturas y la edición de una pantalla F5. Contra `next dev` + Supabase local.
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
const NOMBRES = ['Inicio', 'Portada de la fiesta', 'Portada de evento', 'Avisos', 'Gracias', 'Producción', 'Capa EN VIVO'];
const VISTAS = ['inicio', 'portada', 'evento', 'avisos', 'gracias', 'produccion', 'envivo'];
const DESCRIPCIONES = [
  'Antes de empezar: «En breve comenzamos», con cuenta regresiva.',
  'Para la fiesta patronal y la novena.',
  'Para un evento especial con fecha y lugar.',
  'Avisos fijos, horarios y redes.',
  'Al terminar la transmisión.',
  'Cierre: «Una producción de…».',
  'Encima de la cámara: logo y barra.',
];

const navegador = await chromium.launch();
const errores = [];
const nuevaPagina = async (correo) => {
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  pagina.on('pageerror', (e) => errores.push(String(e)));
  await entrar(pagina, correo);
  return pagina;
};
const apretado = (pagina, grupo) =>
  pagina.getByRole('group', { name: grupo, exact: true }).locator('button[aria-pressed="true"]').innerText();
const interruptor = (pagina, nombre) => pagina.getByRole('switch', { name: nombre, exact: true });

try {
  console.log('F4 · Pantallas de OBS');
  const conPantallas = {
    ...CONFIG_BASE,
    pantallas: { inicio: { modo: 'personalizada', distribucion: 'derecha' }, portada: { modo: 'personalizada' }, horarios: { modo: 'personalizada' } },
  };
  const P = await prepararParroquia({ config: conPantallas });
  const pagina = await nuevaPagina(P.correo);
  const antes = await leerConfig(P.id);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/pantallas`);
  igual(await pagina.locator('h1').innerText(), 'Pantallas de OBS', 'el título es «Pantallas de OBS»');
  revisar(await pagina.getByText('Cada una viene lista con tu identidad. Personaliza solo las que quieras.').isVisible(), 'el texto del artboard');
  const tarjetas = pagina.locator('main article');
  igual(await tarjetas.count(), 7, 'hay 7 tarjetas');
  igual(JSON.stringify(await tarjetas.locator('h2').allInnerTexts()), JSON.stringify(NOMBRES), 'los nombres, en orden');
  const descripciones = await tarjetas.locator('.pv-pantalla-descripcion').allInnerTexts();
  igual(JSON.stringify(descripciones), JSON.stringify(DESCRIPCIONES), 'las descripciones exactas');
  const chips = await tarjetas.locator('.pv-chip').allInnerTexts();
  igual(
    JSON.stringify(chips),
    JSON.stringify(['Personalizada', 'Personalizada', 'Como viene', 'Como viene', 'Como viene', 'Como viene', 'Como viene']),
    '«Inicio» y «Portada de la fiesta» personalizadas, el resto como viene',
  );
  for (let i = 0; i < 7; i++) {
    const enlace = pagina.getByRole('link', { name: `Editar ${NOMBRES[i]}`, exact: true });
    igual(await enlace.getAttribute('href'), `/editor/p/${P.slug}/pantallas/${VISTAS[i]}`, `«Editar ${NOMBRES[i]}» lleva a su pantalla`);
  }
  const marcos = pagina.locator('main article iframe');
  igual(await marcos.count(), 7, 'hay 7 miniaturas');
  const atributos = await marcos.evaluateAll((l) => l.map((m) => [m.getAttribute('aria-hidden'), m.getAttribute('loading'), m.getAttribute('tabindex')].join('|')));
  revisar(atributos.every((a) => a === 'true|lazy|-1'), `las miniaturas son aria-hidden, lazy y sin foco (${atributos[0]})`);
  const caja = await marcos.first().boundingBox();
  revisar(Math.abs(caja.width - 274) <= 2, `la primera miniatura mide 274 de ancho (mide ${caja.width})`);
  const nombreVisto = await pagina
    .frameLocator('main article:first-child iframe')
    .locator('body')
    .getByText(/Parroquia San José/i)
    .first()
    .waitFor({ timeout: 15_000 })
    .then(() => true, () => false);
  revisar(nombreVisto, 'la miniatura de Inicio muestra el nombre del borrador');
  await pagina.waitForTimeout(1200);
  revisar(iguales(await leerConfig(P.id), antes), 'abrir la lista no cambió la base');
  await pagina.getByRole('link', { name: 'Editar Gracias', exact: true }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/pantallas/gracias`);
  igual(
    await pagina.getByRole('navigation', { name: 'Secciones del editor' }).getByRole('link', { name: /^Pantallas/ }).getAttribute('aria-current'),
    'page',
    'en Gracias, «Pantallas» sigue siendo la actual en el menú',
  );
  // F5 (Tarea 4)
} finally {
  await navegador.close();
  await limpiar();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('pantallas');
