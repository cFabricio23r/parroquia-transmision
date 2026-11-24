// Pruebas de navegador de Rótulos y estilo (plan 4, Tarea 6, F6). Contra `next dev` + Supabase local.
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
const marcada = (pagina) =>
  pagina.getByRole('group', { name: 'Tipografía', exact: true }).locator('label:has(input:checked)').innerText();
const NOTA_MINIMAL = 'El diseño Minimal no tiene caja';
const LOGO = 'Logo pequeño en la esquina mientras hay rótulo';
const CARGOS = 'Cargos sugeridos para «Persona»';
const estadoMenu = (pagina) =>
  pagina.getByRole('navigation', { name: 'Secciones del editor' }).getByRole('link', { name: /^Rótulos y estilo/ }).locator('.pv-solo-lectores').innerText();

try {
  console.log('F6 · Estado inicial');
  const P = await prepararParroquia({ config: CONFIG_BASE });
  const p = await nuevaPagina(P.correo);
  await p.goto(`${BASE}/editor/p/${P.slug}/rotulos`);
  igual(await p.locator('h1').innerText(), 'Rótulos y estilo', 'el título es «Rótulos y estilo»');
  revisar(
    await p.getByText('Cómo se ven los rótulos encima de la cámara: celebrante, lecturas, salmo, oración y los demás.').isVisible(),
    'el texto del artboard',
  );
  const botones = (grupo) => p.getByRole('group', { name: grupo, exact: true }).locator('button').allInnerTexts();
  igual(JSON.stringify(await botones('Diseño')), JSON.stringify(['Clásico', 'Tarjeta', 'Minimal', 'Etiqueta']), 'los botones de «Diseño»');
  igual(await apretado(p, 'Diseño'), 'Clásico', 'apretado «Clásico»');
  const radios = p.getByRole('group', { name: 'Tipografía', exact: true }).getByRole('radio');
  igual(await radios.count(), 9, 'hay 9 tipografías');
  igual(
    JSON.stringify(await p.getByRole('group', { name: 'Tipografía', exact: true }).locator('label').allInnerTexts()),
    JSON.stringify(['Montserrat (la de hoy)', 'Lora (clásica)', 'Source Sans (sencilla)', 'Cinzel (solemne)', 'Playfair Display (elegante)', 'EB Garamond (de libro)', 'Merriweather (firme)', 'Nunito (cercana)', 'Oswald (angosta)']),
    'las opciones de «Tipografía»',
  );
  igual(JSON.stringify(await botones('Esquinas')), JSON.stringify(['Rectas', 'Suaves', 'Redondas']), 'los botones de «Esquinas»');
  igual(
    JSON.stringify(await botones('Posición')),
    JSON.stringify(['Abajo a la izquierda', 'Abajo al centro', 'Abajo a la derecha', 'Arriba a la derecha']),
    'los botones de «Posición»',
  );
  igual(await marcada(p), 'Montserrat (la de hoy)', 'marcada «Montserrat (la de hoy)»');
  igual(await apretado(p, 'Esquinas'), 'Suaves', 'apretada «Suaves»');
  igual(await apretado(p, 'Posición'), 'Abajo a la izquierda', 'apretada «Abajo a la izquierda»');
  igual(await p.getByRole('switch', { name: LOGO }).getAttribute('aria-checked'), 'true', 'el logo en la esquina está encendido');
  revisar(await p.getByLabel('Fondo del rótulo').isVisible(), 'está «Fondo del rótulo»');
  revisar(await p.getByLabel('Línea de acento').isVisible(), 'está «Línea de acento»');
  revisar(await p.getByText('Aparecen como opciones en el panel; igual se puede escribir otro.').isVisible(), 'la ayuda de los cargos');
  igual((await camposSinEtiqueta(p)).length, 0, 'todo campo tiene etiqueta');

  console.log('F6 · Caja del acento');
  igual(
    await p.locator('.pv-nota-acento').innerText(),
    'El texto claro sobre #d9a441 tiene 2,2:1. Si usas el acento como fondo, el texto va oscuro; como línea, está bien.',
    'la caja del acento tiene el texto exacto',
  );

  console.log('F6 · Escritura en la base');
  await p.getByRole('radio', { name: 'Lora (clásica)' }).check();
  await p.getByLabel('Fondo del rótulo').selectOption({ label: '#4b0f18 (oscuro)' });
  await p.getByLabel('Línea de acento').selectOption({ label: '#d9a441 (acento)' });
  await p.getByRole('switch', { name: LOGO }).click();
  await p.getByLabel(CARGOS).fill('Párroco · Vicario · Diácono · Lector · Coro');
  await esperarGuardado(p);
  const esperado = { tipografia: 'lora', colorLado: 'oscuro', colorLinea: 'acento', logoEsquina: false, cargos: ['Párroco', 'Vicario', 'Diácono', 'Lector', 'Coro'] };
  const c1 = await esperarEnBase(P.id, (c) => iguales(c.rotulos, esperado));
  revisar(iguales(c1.rotulos, esperado), `la base tiene los rótulos (${JSON.stringify(c1.rotulos)})`);
  igual(await estadoMenu(p), 'Listo', 'con el fondo oscuro, «Rótulos y estilo» dice «Listo»');

  console.log('F6 · Vista previa');
  revisar((await p.locator('iframe.pv-previa-marco').getAttribute('src')).endsWith('rotulos.html?vista-previa=1'), 'la vista previa es rotulos.html');
  const conCelebrante = await p
    .frameLocator('iframe.pv-previa-marco')
    .locator('body')
    .getByText('P. Juan Pérez')
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true, () => false);
  revisar(conCelebrante, 'la vista previa muestra «P. Juan Pérez»');

  console.log('F6 · Logo de vuelta y muchos cargos');
  await p.getByRole('switch', { name: LOGO }).click();
  await esperarGuardado(p);
  const c2 = await esperarEnBase(P.id, (c) => c.rotulos && !('logoEsquina' in c.rotulos));
  revisar(c2.rotulos && !('logoEsquina' in c2.rotulos), 'encender el logo quita logoEsquina');
  await p.getByLabel(CARGOS).fill(Array.from({ length: 13 }, (_, i) => `Cargo ${i + 1}`).join(' · '));
  revisar(await p.getByText('Hasta 12 cargos.').isVisible(), '13 cargos muestran «Hasta 12 cargos.»');
  await p.waitForTimeout(1500);
  igual((await leerConfig(P.id)).rotulos.cargos.length, 5, 'y la base conserva los cinco de antes');

  console.log('F6 · Fondo blanco y un gris propio');
  await p.getByLabel(CARGOS).fill('Párroco');
  await p.getByLabel('Fondo del rótulo').selectOption({ label: '#ffffff (blanco)' });
  await esperarGuardado(p);
  igual(await p.getByRole('region', { name: 'Para revisar' }).count(), 0, 'con el fondo blanco no hay caja «Revisar»');
  const G = await prepararParroquia({ config: { ...CONFIG_BASE, rotulos: { colorLado: '#808080' } } });
  const pg = await nuevaPagina(G.correo);
  await pg.goto(`${BASE}/editor/p/${G.slug}/rotulos`);
  revisar(await pg.getByText('El color del rótulo tiene poco contraste').isVisible(), 'con #808080 aparece «El color del rótulo tiene poco contraste»');
  igual(await pg.getByLabel('Fondo del rótulo').locator('option:checked').innerText(), '#808080 (otro color)', 'el select muestra «#808080 (otro color)»');

  console.log('F6 · Acento borrado en Identidad');
  const A = await prepararParroquia({
    config: { ...CONFIG_BASE, colores: { principal: '#8a1c2b', oscuro: '#4b0f18' }, rotulos: { colorLado: 'acento' } },
  });
  const pa = await nuevaPagina(A.correo);
  await pa.goto(`${BASE}/editor/p/${A.slug}/rotulos`);
  revisar(await pa.getByText('Falta el color de acento en Identidad. Elige otro color.').isVisible(), 'el campo muestra que falta el acento');
  const puts = [];
  pa.on('response', (r) => r.request().method() === 'PUT' && r.url().includes('/borrador') && puts.push(r.status()));
  await pa.getByLabel('Fondo del rótulo').selectOption({ label: '#4b0f18 (oscuro)' });
  await esperarGuardado(pa);
  const c3 = await esperarEnBase(A.id, (c) => c.rotulos?.colorLado === 'oscuro');
  igual(c3.rotulos?.colorLado, 'oscuro', 'elegir el oscuro lo guarda');
  revisar(puts.length > 0 && puts.every((s) => s === 200), `el guardado dio 200 (${puts.join(', ')})`);

  console.log('Diseños · Elegir diseño, tipografía y posición');
  const D = await prepararParroquia({ config: CONFIG_BASE });
  const pd = await nuevaPagina(D.correo);
  await pd.goto(`${BASE}/editor/p/${D.slug}/rotulos`);
  await pd.getByRole('button', { name: 'Tarjeta', exact: true }).click();
  await esperarGuardado(pd);
  const d1 = await esperarEnBase(D.id, (c) => c.rotulos?.diseno === 'tarjeta');
  igual(d1.rotulos?.diseno, 'tarjeta', 'elegir «Tarjeta» guarda diseno: tarjeta');
  await pd.getByRole('radio', { name: 'Montserrat (la de hoy)' }).focus();
  await pd.keyboard.press('ArrowDown');
  await pd.keyboard.press('ArrowDown');
  await pd.keyboard.press('ArrowDown');
  igual(await marcada(pd), 'Cinzel (solemne)', 'con las flechas queda marcada «Cinzel (solemne)»');
  await esperarGuardado(pd);
  const d2 = await esperarEnBase(D.id, (c) => c.rotulos?.tipografia === 'cinzel');
  igual(d2.rotulos?.tipografia, 'cinzel', 'con el teclado se guarda tipografia: cinzel');
  await pd.getByRole('button', { name: 'Arriba a la derecha' }).click();
  await esperarGuardado(pd);
  const d3 = await esperarEnBase(D.id, (c) => c.rotulos?.posicion === 'arriba-derecha');
  igual(d3.rotulos?.posicion, 'arriba-derecha', '«Arriba a la derecha» guarda posicion');

  console.log('Diseños · Minimal deshabilita esquinas y fondo');
  await pd.getByRole('button', { name: 'Rectas' }).click();
  await pd.getByLabel('Fondo del rótulo').selectOption({ label: '#4b0f18 (oscuro)' });
  await esperarGuardado(pd);
  await esperarEnBase(D.id, (c) => c.rotulos?.esquinas === 'rectas' && c.rotulos?.colorLado === 'oscuro');
  await pd.getByRole('button', { name: 'Minimal', exact: true }).click();
  await esperarGuardado(pd);
  const d4 = await esperarEnBase(D.id, (c) => c.rotulos?.diseno === 'minimal');
  const esquinasBotones = pd.getByRole('group', { name: 'Esquinas', exact: true }).locator('button');
  revisar((await esquinasBotones.evaluateAll((bs) => bs.every((b) => b.disabled))), 'con Minimal, «Esquinas» está deshabilitado');
  revisar(await pd.getByLabel('Fondo del rótulo').isDisabled(), 'con Minimal, «Fondo del rótulo» está deshabilitado');
  revisar(await pd.getByText(NOTA_MINIMAL).first().isVisible(), `con Minimal se ve «${NOTA_MINIMAL}»`);
  revisar(d4.rotulos?.esquinas === 'rectas' && d4.rotulos?.colorLado === 'oscuro', 'Minimal no borra esquinas ni colorLado');
  igual((await camposSinEtiqueta(pd)).length, 0, 'con Minimal todo campo tiene etiqueta');
  await pd.getByRole('button', { name: 'Clásico', exact: true }).click();
  await esperarGuardado(pd);
  const d5 = await esperarEnBase(D.id, (c) => c.rotulos?.diseno === 'clasico');
  igual(await apretado(pd, 'Esquinas'), 'Rectas', 'de vuelta en Clásico, siguen «Rectas»');
  revisar(!(await pd.getByLabel('Fondo del rótulo').isDisabled()), 'de vuelta en Clásico, «Fondo del rótulo» se puede usar');
  revisar(d5.rotulos?.esquinas === 'rectas' && d5.rotulos?.colorLado === 'oscuro', 'y la base conserva esquinas y colorLado');

  console.log('F6 · Config viejo');
  const V = await prepararParroquia({ config: { ...CONFIG_BASE, rotulos: { esquinas: 'redondeadas' } } });
  const pv = await nuevaPagina(V.correo);
  const antes = await leerConfig(V.id);
  await pv.goto(`${BASE}/editor/p/${V.slug}/rotulos`);
  await pv.waitForTimeout(1500);
  revisar(iguales(await leerConfig(V.id), antes), 'abrir la página no cambió la base');
  igual(await apretado(pv, 'Esquinas'), 'Suaves', '«redondeadas» se pinta como «Suaves»');
} finally {
  await navegador.close();
  await limpiar();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('rotulos');
