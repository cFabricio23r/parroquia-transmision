// Pruebas de navegador de Tipos de transmisión (plan 4, Tareas 8 y 9): la tabla F7 y el
// formulario F8 (nuevo, propio y común). Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import sharp from 'sharp';
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
const PNG = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#8a1c2b' } }).png().toBuffer();
const guardadoDice = (p) => p.locator('[role="status"].pv-guardado').textContent();
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

  console.log('F8 · Nuevo tipo');
  const GAL = [{ id: 'img-virgen1', src: 'medios/img-virgen1.png', alt: 'Virgen del Rosario', etiquetas: ['santos'] }];
  const N = await prepararParroquia({ config: { ...CONFIG_BASE, galeria: GAL } });
  const pn = await nuevaPagina(N.correo);
  await pn.goto(`${BASE}/editor/p/${N.slug}/tipos/nuevo`);
  const migas = pn.getByRole('navigation', { name: 'Migas' });
  igual(await migas.getByRole('link').innerText(), 'Tipos de transmisión', 'la miga lleva a «Tipos de transmisión»');
  igual(await migas.locator('[aria-current="page"]').innerText(), 'Nuevo tipo', 'y termina en «Nuevo tipo»');
  igual(await pn.locator('h1').innerText(), 'Nuevo tipo', 'el título es «Nuevo tipo»');
  for (const e of ['Nombre', 'Nombre en el panel', 'Texto de arriba en Inicio', 'Texto de Gracias']) {
    revisar(await pn.getByLabel(e, { exact: true }).isVisible(), `está el campo «${e}»`);
  }
  revisar(await pn.getByText('Corto, para el botón.').isVisible(), '«Nombre en el panel» tiene su ayuda');
  const portada = pn.getByRole('group', { name: 'Portada' });
  igual(await portada.locator('[aria-pressed="true"]').innerText(), 'Sin portada', '«Sin portada» está apretada');
  igual(
    JSON.stringify(await pn.locator('.pv-casilla').allInnerTexts()),
    JSON.stringify(['Persona', 'Misterio del rosario', 'Lectura', 'Oración', 'Lugar o estación', 'Libre']),
    'las seis casillas del artboard',
  );
  const marcadas = await pn.locator('.pv-casilla input').evaluateAll((l) => l.map((c) => c.checked));
  igual(JSON.stringify(marcadas), JSON.stringify([true, false, false, false, false, false]), 'solo «Persona» está marcada');
  await pn.getByRole('button', { name: 'Guardar tipo' }).click();
  revisar(await pn.getByText('Escribe el nombre.').isVisible(), 'sin nombre dice «Escribe el nombre.»');
  await pn.getByLabel('Nombre', { exact: true }).fill('Rosario de la aurora');
  igual(await pn.locator('h1').innerText(), 'Rosario de la aurora', 'el título sigue al nombre');
  await pn.getByLabel('Nombre en el panel', { exact: true }).fill('Rosario');
  await pn.getByLabel('Texto de arriba en Inicio', { exact: true }).fill('En breve comenzamos');
  await pn.getByLabel('Texto de Gracias', { exact: true }).fill('Gracias por rezar con nosotros');
  await portada.getByRole('button', { name: 'Portada de la fiesta' }).click();
  for (const c of ['Misterio del rosario', 'Oración', 'Libre']) await pn.getByRole('checkbox', { name: c }).check();
  await pn.getByRole('group', { name: 'Imagen' }).getByRole('button', { name: 'Elegir de la galería' }).click();
  await pn.getByRole('dialog').getByRole('button', { name: /Virgen del Rosario/ }).click();
  revisar(await pn.getByText('La descripción es la de la imagen en la Galería.').isVisible(), 'con una imagen de la galería, el alt es el de la galería');
  igual(await pn.getByLabel('Descripción para lectores de pantalla (alt)').inputValue(), 'Virgen del Rosario', 'y muestra su alt');
  revisar(await pn.getByText('Vista previa · Inicio').first().isVisible(), 'la vista previa es «Vista previa · Inicio»');
  const enIframe = await pn
    .frameLocator('iframe.pv-previa-marco')
    .locator('body')
    .getByText(/En breve comenzamos/i)
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true, () => false);
  revisar(enIframe, 'la vista previa muestra «EN BREVE COMENZAMOS» antes de guardar');
  revisar(!(await leerConfig(N.id)).tipos, 'la base todavía no tiene el propio');
  await pn.getByRole('button', { name: 'Guardar tipo' }).click();
  await pn.waitForURL(`${BASE}/editor/p/${N.slug}/tipos`);
  revisar(await pn.locator('.pv-tipo-nombre', { hasText: 'Rosario de la aurora' }).isVisible(), 'la tabla tiene la fila «Rosario de la aurora»');
  const cn = await esperarEnBase(N.id, (c) => c.tipos?.propios?.length === 1);
  const esperadoN = {
    clave: 'rosario-de-la-aurora',
    nombre: 'Rosario de la aurora',
    nombrePanel: 'Rosario',
    textoInicio: 'En breve comenzamos',
    textoGracias: 'Gracias por rezar con nosotros',
    imagen: 'galeria:img-virgen1',
    portada: 'fiesta',
    rotulos: ['persona', 'rosario', 'oracion', 'libre'],
  };
  revisar(iguales(cn.tipos?.propios?.[0], esperadoN), `la base tiene el propio (${JSON.stringify(cn.tipos?.propios?.[0])})`);

  console.log('F8 · Sin guardar y Cancelar');
  const antesC = await leerConfig(N.id);
  await pn.goto(`${BASE}/editor/p/${N.slug}/tipos/nuevo`);
  await pn.getByLabel('Nombre', { exact: true }).fill('Vía crucis');
  await pn.getByRole('navigation', { name: 'Secciones del editor' }).getByRole('link', { name: /^Galería/ }).click();
  await pn.waitForURL(/\/galeria$/);
  igual(await guardadoDice(pn), 'Sin guardar', 'en otra sección el encabezado dice «Sin guardar»');
  await pn.goBack();
  await pn.waitForURL(/\/tipos\/nuevo$/);
  igual(await pn.getByLabel('Nombre', { exact: true }).inputValue(), 'Vía crucis', 'lo escrito sigue al volver');
  await pn.getByRole('button', { name: 'Cancelar' }).click();
  await pn.waitForURL(`${BASE}/editor/p/${N.slug}/tipos`);
  await pn.waitForTimeout(1200);
  revisar(iguales(await leerConfig(N.id), antesC), '«Cancelar» no cambió la base');
  revisar((await guardadoDice(pn)) !== 'Sin guardar', 'y el encabezado deja de decir «Sin guardar»');

  console.log('F8 · Cambiar');
  await pn.goto(`${BASE}/editor/p/${N.slug}/tipos/nuevo`);
  await pn.getByLabel('Nombre', { exact: true }).fill('Con foto');
  // Revisión: la imagen nueva llevaba el alt de la anterior o uno inventado. «Cambiar» abre «Subir
  // imagen» y la descripción la escribe la persona, como en la Galería.
  const subidasCambiar = [];
  pn.on('request', (r) => r.method() === 'POST' && r.url().includes('/imagen') && subidasCambiar.push(r.url()));
  await pn.getByRole('group', { name: 'Imagen' }).getByRole('button', { name: 'Cambiar' }).click();
  const dialogoCambiar = pn.getByRole('dialog', { name: 'Subir imagen' });
  await dialogoCambiar.waitFor();
  await dialogoCambiar.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await dialogoCambiar.getByRole('button', { name: 'Subir' }).click();
  revisar(await dialogoCambiar.getByText('Escribe la descripción.').isVisible(), 'sin descripción, «Subir» pide «Escribe la descripción.»');
  igual(subidasCambiar.length, 0, 'y no sube nada');
  igual(await dialogoCambiar.getByLabel('Etiqueta').inputValue(), 'santos', 'la etiqueta empieza en «Santos»');
  await dialogoCambiar.getByLabel('Descripción (alt)').fill('Foto de la procesión con la imagen de San José');
  await dialogoCambiar.getByRole('button', { name: 'Subir' }).click();
  await dialogoCambiar.waitFor({ state: 'hidden', timeout: 15_000 });
  const cg = await esperarEnBase(N.id, (c) => c.galeria?.length === 2, 15_000);
  igual(cg.galeria?.length, 2, '«Cambiar» agregó la imagen a la galería de la base');
  igual(cg.galeria?.[1]?.alt, 'Foto de la procesión con la imagen de San José', 'con la descripción escrita para ella');
  igual(
    await pn.getByLabel('Descripción para lectores de pantalla (alt)').inputValue(),
    'Foto de la procesión con la imagen de San José',
    'y el tipo queda con la imagen nueva',
  );
  await pn.getByRole('button', { name: 'Cancelar' }).click();
  await pn.waitForURL(`${BASE}/editor/p/${N.slug}/tipos`);
  await pn.waitForTimeout(1200);
  const cg2 = await leerConfig(N.id);
  igual(cg2.galeria?.length, 2, 'la imagen sigue en la galería aunque se canceló el tipo');
  igual(cg2.tipos?.propios?.length, 1, 'y el tipo cancelado no se guardó');

  console.log('F8 · Común');
  const C = await prepararParroquia();
  const pc = await nuevaPagina(C.correo);
  await pc.goto(`${BASE}/editor/p/${C.slug}/tipos/horasanta`);
  igual(await pc.locator('h1').innerText(), 'Hora Santa', 'el título es «Hora Santa»');
  igual(await pc.getByLabel('Nombre', { exact: true }).count(), 0, 'un común no tiene «Nombre»');
  igual(await pc.getByRole('group', { name: 'Portada' }).count(), 0, 'ni «Portada»');
  igual(
    JSON.stringify(await pc.locator('.pv-casilla').allInnerTexts()),
    JSON.stringify(['Guía', 'Exposición del Santísimo', 'Lectura', 'Oración', 'Bendición']),
    'las casillas de Hora Santa',
  );
  const marcadasC = await pc.locator('.pv-casilla input').evaluateAll((l) => l.map((c) => c.checked));
  igual(JSON.stringify(marcadasC), JSON.stringify([true, true, true, true, true]), 'todas marcadas');
  igual(await pc.getByRole('button', { name: 'Volver a como venía' }).count(), 0, 'sin ajuste no hay «Volver a como venía»');
  await pc.getByRole('checkbox', { name: 'Bendición' }).uncheck();
  await pc.getByRole('button', { name: 'Guardar tipo' }).click();
  await pc.waitForURL(`${BASE}/editor/p/${C.slug}/tipos`);
  const cc = await esperarEnBase(C.id, (c) => !!c.tipos?.ajustes?.horasanta);
  revisar(iguales(cc.tipos?.ajustes?.horasanta, { ocultarRotulos: ['bendicion'] }), `ajustes.horasanta es { ocultarRotulos:['bendicion'] } (${JSON.stringify(cc.tipos?.ajustes)})`);
  await pc.goto(`${BASE}/editor/p/${C.slug}/tipos/horasanta`);
  await pc.getByRole('button', { name: 'Volver a como venía' }).click();
  igual(
    await pc.getByRole('dialog').locator('.pv-dialogo-texto').innerText(),
    '«Hora Santa» vuelve a como lo mantiene la Pastoral. Tus cambios a este tipo se borran.',
    'el texto de «Volver a como venía» es el de la Decisión 4',
  );
  await pc.getByRole('dialog').getByRole('button', { name: 'Sí, volver' }).click();
  await esperarGuardado(pc);
  const cc2 = await esperarEnBase(C.id, (c) => !c.tipos?.ajustes?.horasanta);
  revisar(!cc2.tipos?.ajustes?.horasanta, '«Sí, volver» quitó ajustes.horasanta');

  console.log('F8 · Grupo');
  await pc.goto(`${BASE}/editor/p/${C.slug}/tipos/novena`);
  igual(await pc.locator('h1').innerText(), 'Novena y fiesta patronal', 'el título del grupo');
  await pc.getByLabel('Texto de Gracias', { exact: true }).fill('Gracias, San José');
  await pc.getByRole('button', { name: 'Guardar tipo' }).click();
  await pc.waitForURL(`${BASE}/editor/p/${C.slug}/tipos`);
  const cgr = await esperarEnBase(C.id, (c) => !!c.tipos?.ajustes?.patronal);
  const graciasDe = (k) => cgr.tipos?.ajustes?.[k]?.textoGracias;
  revisar(['prenovena', 'novena', 'patronal'].every((k) => graciasDe(k) === 'Gracias, San José'), 'el grupo escribe el mismo textoGracias en sus tres claves');

  console.log('F8 · Propio viejo');
  const V = await prepararParroquia({ config: { ...CONFIG_BASE, tipos: { propios: [{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora', titulo: 'MISA X', rotulos: ['evangelio', 'persona'] }] } } });
  const pv = await nuevaPagina(V.correo);
  await pv.goto(`${BASE}/editor/p/${V.slug}/tipos/rosario-aurora`);
  igual(await pv.locator('h1').innerText(), 'Rosario de la aurora', 'el título es el nombre guardado');
  await pv.getByLabel('Nombre en el panel', { exact: true }).fill('Aurora');
  // Revisión: «Guardar tipo» salía a la lista aunque el guardado fallara. Sin conexión, se queda.
  await pv.route('**/borrador', (r) => (r.request().method() === 'PUT' ? r.abort() : r.continue()));
  await pv.getByRole('button', { name: 'Guardar tipo' }).click();
  await pv.getByText('Sin conexión').first().waitFor({ timeout: 5000 });
  revisar(pv.url().endsWith('/tipos/rosario-aurora'), 'sin conexión, «Guardar tipo» no sale de la página');
  igual(await pv.getByLabel('Nombre en el panel', { exact: true }).inputValue(), 'Aurora', 'y lo escrito sigue ahí');
  igual((await leerConfig(V.id)).tipos?.propios?.[0]?.nombrePanel, undefined, 'la base no cambió');
  await pv.unroute('**/borrador');
  await pv.getByRole('button', { name: 'Guardar tipo' }).click();
  await pv.waitForURL(`${BASE}/editor/p/${V.slug}/tipos`);
  const cv = await esperarEnBase(V.id, (c) => c.tipos?.propios?.[0]?.nombrePanel === 'Aurora');
  igual(cv.tipos?.propios?.[0]?.titulo, 'MISA X', 'guardar conserva el titulo');
  igual(JSON.stringify(cv.tipos?.propios?.[0]?.rotulos), JSON.stringify(['evangelio', 'persona']), 'y conserva los rótulos sin tocarlos ni reordenarlos');
  await pv.goto(`${BASE}/editor/p/${V.slug}/tipos/rosario-aurora`);
  // Sin conexión, «Sí, borrar» tampoco sale: el tipo sigue y se dice por qué.
  await pv.route('**/borrador', (r) => (r.request().method() === 'PUT' ? r.abort() : r.continue()));
  await pv.getByRole('button', { name: 'Borrar tipo' }).click();
  await pv.getByRole('dialog').getByRole('button', { name: 'Sí, borrar' }).click();
  await pv.getByText('No se pudo borrar el tipo. Revisa tu conexión y vuelve a intentarlo.').waitFor({ timeout: 5000 });
  revisar(pv.url().endsWith('/tipos/rosario-aurora'), 'sin conexión, «Sí, borrar» no sale de la página');
  await pv.waitForTimeout(1500);
  revisar(!!(await leerConfig(V.id)).tipos?.propios?.length, 'y el tipo sigue en la base');
  await pv.unroute('**/borrador');
  await pv.waitForTimeout(1500);
  revisar(!!(await leerConfig(V.id)).tipos?.propios?.length, 'al volver la conexión, el borrado fallido no sale solo');
  await pv.getByRole('button', { name: 'Borrar tipo' }).click();
  igual(
    await pv.getByRole('dialog').locator('.pv-dialogo-texto').innerText(),
    '¿Borrar el tipo «Rosario de la aurora»? Deja de aparecer en el panel.',
    'el texto de «Borrar tipo» es el de la Decisión 15',
  );
  await pv.getByRole('dialog').getByRole('button', { name: 'Sí, borrar' }).click();
  await pv.waitForURL(`${BASE}/editor/p/${V.slug}/tipos`);
  const cv2 = await esperarEnBase(V.id, (c) => !c.tipos?.propios);
  revisar(!cv2.tipos?.propios, '«Sí, borrar» lo quitó de la base');

  console.log('F8 · Último tipo e inexistente');
  const L = await prepararParroquia({ config: { ...CONFIG_BASE, tipos: { apagados: TODAS, propios: [{ clave: 'unico', nombre: 'Único' }] } } });
  const pl = await nuevaPagina(L.correo);
  await pl.goto(`${BASE}/editor/p/${L.slug}/tipos/unico`);
  igual(await pl.getByRole('button', { name: 'Borrar tipo' }).getAttribute('aria-disabled'), 'true', 'con un solo tipo, «Borrar tipo» está deshabilitado');
  igual((await camposSinEtiqueta(pl)).length, 0, 'todo campo tiene etiqueta (propio)');
  await pl.goto(`${BASE}/editor/p/${L.slug}/tipos/no-existe`);
  igual(await pl.locator('h1').innerText(), 'Ese tipo no existe', '/tipos/no-existe dice «Ese tipo no existe»');
} finally {
  await navegador.close();
  await limpiar();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('tipos');
