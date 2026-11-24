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

  console.log('F5 · Editar una pantalla: etiquetas y estado inicial');
  const Q = await prepararParroquia({ config: CONFIG_BASE });
  const p1 = await nuevaPagina(Q.correo);
  await p1.goto(`${BASE}/editor/p/${Q.slug}/pantallas/inicio`);
  const migas = p1.getByRole('navigation', { name: 'Migas' });
  igual(await migas.getByRole('link', { name: 'Pantallas' }).getAttribute('href'), `/editor/p/${Q.slug}/pantallas`, 'la miga «Pantallas» lleva a la lista');
  igual(await migas.locator('[aria-current="page"]').innerText(), 'Inicio', 'la miga actual es «Inicio»');
  igual(await p1.locator('h1').innerText(), 'Pantalla de Inicio', 'el título es «Pantalla de Inicio»');
  const botones = async (grupo) => p1.getByRole('group', { name: grupo, exact: true }).locator('button').allInnerTexts();
  igual(JSON.stringify(await botones('Fondo')), JSON.stringify(['Colores de la parroquia', 'Foto de la galería', 'Color liso']), 'los botones de «Fondo»');
  igual(
    JSON.stringify(await botones('Imagen grande')),
    JSON.stringify(['La del tipo de transmisión', 'Siempre la misma', 'Sin imagen']),
    'los botones de «Imagen grande»',
  );
  igual(
    JSON.stringify(await botones('Distribución')),
    JSON.stringify(['Imagen a la derecha', 'Imagen a la izquierda', 'Centrado']),
    'los botones de «Distribución»',
  );
  igual(await apretado(p1, 'Fondo'), 'Colores de la parroquia', 'apretado «Colores de la parroquia»');
  igual(await apretado(p1, 'Imagen grande'), 'La del tipo de transmisión', 'apretado «La del tipo de transmisión»');
  igual(await apretado(p1, 'Distribución'), 'Imagen a la izquierda', 'apretado «Imagen a la izquierda»');
  igual(await interruptor(p1, 'Logo').getAttribute('aria-checked'), 'true', '«Logo» encendido');
  igual(await interruptor(p1, 'Cuenta regresiva').getAttribute('aria-checked'), 'true', '«Cuenta regresiva» encendido');
  igual(await interruptor(p1, 'Franja del lema').getAttribute('aria-checked'), 'true', '«Franja del lema» encendido');
  igual(await interruptor(p1, 'Redes sociales').getAttribute('aria-checked'), 'false', '«Redes sociales» apagado');
  revisar(
    await p1.getByText('Cada tipo de transmisión puede tener el suyo; este es el que se usa si no.').isVisible(),
    '«Texto de arriba» tiene su ayuda',
  );
  igual(await p1.getByRole('button', { name: 'Volver a como venía' }).count(), 0, 'sin personalizar no hay «Volver a como venía»');
  igual((await camposSinEtiqueta(p1)).length, 0, 'todo campo tiene etiqueta');

  console.log('F5 · Escritura en la base y vista previa');
  await p1.getByRole('button', { name: 'Imagen a la derecha' }).click();
  await interruptor(p1, 'Franja del lema').click();
  await interruptor(p1, 'Redes sociales').click();
  await p1.getByLabel('Texto de arriba').fill('En breve comenzamos');
  await esperarGuardado(p1);
  const esperado = { modo: 'personalizada', distribucion: 'derecha', ocultar: ['franja'], mostrar: ['redes'], textos: { inicio_titulo: 'En breve comenzamos' } };
  const c1 = await esperarEnBase(Q.id, (c) => iguales(c.pantallas?.inicio, esperado));
  revisar(iguales(c1.pantallas?.inicio, esperado), `la base tiene pantallas.inicio (${JSON.stringify(c1.pantallas?.inicio)})`);
  const visto = await p1
    .frameLocator('iframe.pv-previa-marco')
    .locator('body')
    .getByText(/En breve comenzamos/i)
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true, () => false);
  revisar(visto, 'la vista previa muestra «En breve comenzamos»');
  revisar(await p1.getByRole('button', { name: 'Volver a como venía' }).isVisible(), 'aparece «Volver a como venía»');

  console.log('F5 · Galería vacía');
  await p1.getByRole('button', { name: 'Foto de la galería' }).click();
  revisar(await p1.getByText('Todavía no hay fotos en la galería.').isVisible(), 'sin galería avisa «Todavía no hay fotos en la galería.»');
  revisar(await p1.getByRole('link', { name: 'Ir a Galería' }).isVisible(), 'con el enlace «Ir a Galería»');
  igual(await apretado(p1, 'Fondo'), 'Colores de la parroquia', '«Foto de la galería» no queda apretado');

  console.log('F5 · Volver a como venía');
  await p1.getByRole('button', { name: 'Volver a como venía' }).click();
  const dialogo = p1.getByRole('dialog', { name: 'Volver a como venía' });
  revisar(
    await dialogo.getByText('La pantalla de Inicio vuelve a verse como viene. Lo que cambiaste aquí se borra.').isVisible(),
    'el diálogo explica qué pasa',
  );
  await dialogo.getByRole('button', { name: 'Sí, volver' }).click();
  await esperarGuardado(p1);
  const c2 = await esperarEnBase(Q.id, (c) => !c.pantallas);
  igual(c2.pantallas, undefined, '«Sí, volver» quita pantallas.inicio (y el bloque, que quedó vacío)');

  console.log('F5 · Producción y Capa EN VIVO');
  await p1.goto(`${BASE}/editor/p/${Q.slug}/pantallas/produccion`);
  igual(await p1.getByRole('group', { name: 'Fondo', exact: true }).count(), 0, 'Producción no tiene «Fondo»');
  igual(await p1.getByRole('group', { name: 'Imagen grande', exact: true }).count(), 0, 'ni «Imagen grande»');
  igual(await p1.getByRole('group', { name: 'Distribución', exact: true }).count(), 0, 'ni «Distribución»');
  revisar(await interruptor(p1, 'Logo').isVisible(), 'tiene «Logo»');
  revisar(
    (await p1.getByLabel('Texto de arriba').isVisible()) && (await p1.getByLabel('Nombre del equipo').isVisible()),
    'tiene «Texto de arriba» y «Nombre del equipo»',
  );
  revisar((await p1.locator('iframe.pv-previa-marco').getAttribute('src')).includes('produccion.html'), 'la vista previa es produccion.html');
  await p1.getByLabel('Nombre del equipo').fill('Pastoral juvenil');
  const vistoProd = await p1
    .frameLocator('iframe.pv-previa-marco')
    .locator('body')
    .getByText(/Pastoral juvenil/i)
    .first()
    .waitFor({ timeout: 10_000 })
    .then(() => true, () => false);
  revisar(vistoProd, '«Pastoral juvenil» se ve en la vista previa');
  await esperarGuardado(p1);
  await p1.goto(`${BASE}/editor/p/${Q.slug}/pantallas/envivo`);
  await interruptor(p1, 'EN VIVO').click();
  await esperarGuardado(p1);
  const c3 = await esperarEnBase(Q.id, (c) => c.pantallas?.envivo?.ocultar?.includes('envivo'));
  igual(JSON.stringify(c3.pantallas?.envivo?.ocultar), JSON.stringify(['envivo']), 'apagar «EN VIVO» escribe ocultar: [envivo]');

  console.log('F5 · Vista inválida');
  await p1.goto(`${BASE}/editor/p/${Q.slug}/pantallas/horarios`);
  revisar(await p1.getByRole('heading', { name: 'Esa pantalla no existe' }).isVisible(), '/pantallas/horarios dice «Esa pantalla no existe»');

  console.log('F5 · «Siempre la misma», «Color liso» y el punto del menú');
  const R = await prepararParroquia({
    config: { ...CONFIG_BASE, galeria: [{ id: 'img-virgen', src: 'medios/virgen.png', alt: 'Virgen', nombre: 'Virgen del Rosario' }] },
  });
  const p2 = await nuevaPagina(R.correo);
  await p2.goto(`${BASE}/editor/p/${R.slug}/pantallas/inicio`);
  await p2.getByRole('button', { name: 'Siempre la misma' }).click();
  await esperarGuardado(p2);
  let c4 = await esperarEnBase(R.id, (c) => c.pantallas?.inicio?.imagen === 'fachada');
  igual(c4.pantallas?.inicio?.imagen, 'fachada', 'sin imagen del patrono, «Siempre la misma» escribe la fachada');
  await p2.getByLabel('¿Cuál imagen?').selectOption({ label: 'Virgen del Rosario' });
  await esperarGuardado(p2);
  c4 = await esperarEnBase(R.id, (c) => c.pantallas?.inicio?.imagen === 'galeria:img-virgen');
  igual(c4.pantallas?.inicio?.imagen, 'galeria:img-virgen', 'elegir «Virgen del Rosario» escribe galeria:<id>');
  await p2.getByLabel('¿Cuál imagen?').selectOption({ label: 'Imagen del patrono' });
  await p2
    .waitForFunction(
      () =>
        [...document.querySelectorAll('nav[aria-label="Secciones del editor"] a')]
          .find((a) => a.textContent.startsWith('Pantallas'))
          ?.textContent.includes('Revisar'),
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  igual(
    await p2.getByRole('navigation', { name: 'Secciones del editor' }).getByRole('link', { name: /^Pantallas/ }).locator('.pv-solo-lectores').innerText(),
    'Revisar',
    'con el patrono sin imagen, el punto de «Pantallas» dice «Revisar»',
  );
  const AVISO_PATRONO = 'La pantalla de Inicio usa la imagen del patrono, pero no hay una';
  revisar(await p2.getByRole('region', { name: 'Para revisar' }).getByText(AVISO_PATRONO).isVisible(), 'F5 explica el ámbar en su caja «Para revisar»');
  revisar(await p2.getByText('Súbela en Patrono y fiesta o elige otra imagen.').isVisible(), 'con qué hacer');
  await esperarGuardado(p2);
  await esperarEnBase(R.id, (c) => c.pantallas?.inicio?.imagen === 'patrono');
  await p2.goto(`${BASE}/editor/p/${R.slug}/pantallas`);
  revisar(await p2.getByRole('region', { name: 'Para revisar' }).getByText(AVISO_PATRONO).isVisible(), 'F4 muestra la misma caja');
  await p2.goto(`${BASE}/editor/p/${R.slug}/pantallas/inicio`);
  await p2.getByRole('button', { name: 'Color liso' }).click();
  await esperarGuardado(p2);
  c4 = await esperarEnBase(R.id, (c) => c.pantallas?.inicio?.fondo?.tipo === 'color');
  revisar(iguales(c4.pantallas?.inicio?.fondo, { tipo: 'color', color: '#4b0f18' }), `«Color liso» escribe el oscuro (${JSON.stringify(c4.pantallas?.inicio?.fondo)})`);
  await p2.getByLabel('Color del fondo').fill('#ffff00');
  revisar(await p2.getByText('El texto blanco no se lee sobre este color. Elige uno más oscuro.').isVisible(), 'un color claro muestra el error');
  await p2.waitForTimeout(1500);
  igual((await leerConfig(R.id)).pantallas?.inicio?.fondo?.color, '#4b0f18', 'y la base sigue con el oscuro');
  igual((await camposSinEtiqueta(p2)).length, 0, 'todo campo tiene etiqueta (con los selects a la vista)');

  console.log('F5 · Config viejo');
  const viejo = { modo: 'personalizada', ocultar: ['chispas'], imagen: 'santo' };
  const V = await prepararParroquia({ config: { ...CONFIG_BASE, pantallas: { gracias: viejo } } });
  const p3 = await nuevaPagina(V.correo);
  const antesV = await leerConfig(V.id);
  await p3.goto(`${BASE}/editor/p/${V.slug}/pantallas/gracias`);
  await p3.waitForTimeout(1500);
  revisar(iguales(await leerConfig(V.id), antesV), 'abrir la pantalla no cambió la base');
  igual(
    await p3.getByLabel('¿Cuál imagen?').locator('option:checked').innerText(),
    'La del santo del día (se elige en el panel)',
    'el select muestra la del santo',
  );
  await interruptor(p3, 'Horarios').click();
  await esperarGuardado(p3);
  const c5 = await esperarEnBase(V.id, (c) => c.pantallas?.gracias?.mostrar?.includes('horarios'));
  revisar(
    iguales(c5.pantallas?.gracias, { modo: 'personalizada', ocultar: ['chispas'], imagen: 'santo', mostrar: ['horarios'] }),
    `encender «Horarios» conserva chispas y santo (${JSON.stringify(c5.pantallas?.gracias)})`,
  );

  console.log('Pantallas más opciones · Estilo de todas las pantallas');
  const E = await prepararParroquia({
    config: {
      ...CONFIG_BASE,
      patrono: { ...CONFIG_BASE.patrono, imagen: { src: 'medios/patrono.png', alt: 'San José' } },
      galeria: [{ id: 'img-taller', src: 'medios/taller.png', alt: 'El taller', nombre: 'El taller' }],
    },
  });
  const p4 = await nuevaPagina(E.correo);
  await p4.goto(`${BASE}/editor/p/${E.slug}/pantallas`);
  const bloque = p4.getByRole('region', { name: 'Estilo de todas las pantallas' });
  revisar(await bloque.isVisible(), 'la lista tiene el bloque «Estilo de todas las pantallas»');
  for (const g of ['Letra del título', 'Letra de la frase']) revisar(await bloque.getByRole('group', { name: g, exact: true }).isVisible(), `con «${g}»`);
  revisar(await bloque.getByRole('group', { name: 'Tamaño del logo', exact: true }).isVisible(), 'con «Tamaño del logo»');
  revisar(
    await bloque.getByText('La letra del título cambia Inicio, Portada, Evento, Gracias, Avisos y Horarios').isVisible(),
    'debajo, la línea de a qué alcanza',
  );
  revisar(await bloque.getByText('Producción y la capa EN VIVO no cambian.').isVisible(), 'y que Producción y EN VIVO no cambian');
  const letraTitulo = bloque.getByRole('group', { name: 'Letra del título', exact: true });
  await letraTitulo.getByRole('radio', { name: /^Cinzel/ }).check();
  await esperarGuardado(p4);
  const c6 = await esperarEnBase(E.id, (c) => c.estiloPantallas?.letraTitulo === 'cinzel');
  igual(c6.estiloPantallas?.letraTitulo, 'cinzel', 'elegir Cinzel guarda estiloPantallas.letraTitulo');
  const conCinzel = await p4
    .frameLocator('main article:first-child iframe')
    .locator('#escenario.letra-titulo-cinzel')
    .waitFor({ state: 'attached', timeout: 15_000 })
    .then(() => true, () => false);
  revisar(conCinzel, 'la miniatura de Inicio usa la letra Cinzel');
  await bloque.getByRole('group', { name: 'Tamaño del logo', exact: true }).getByRole('button', { name: 'Grande' }).click();
  await esperarGuardado(p4);
  await esperarEnBase(E.id, (c) => c.estiloPantallas?.logo === 'grande');
  await letraTitulo.getByRole('radio', { name: /^Montserrat/ }).check();
  await esperarGuardado(p4);
  const c7 = await esperarEnBase(E.id, (c) => c.estiloPantallas && !('letraTitulo' in c.estiloPantallas));
  revisar(iguales(c7.estiloPantallas, { logo: 'grande' }), `volver a Montserrat borra la clave (${JSON.stringify(c7.estiloPantallas)})`);
  igual(
    JSON.stringify(await p4.locator('main article .pv-chip').allInnerTexts()),
    JSON.stringify(Array(7).fill('Como viene')),
    'el estilo no hace «Personalizada» ninguna pantalla',
  );
  igual((await camposSinEtiqueta(p4)).length, 0, 'todo campo de la lista tiene etiqueta');

  console.log('Pantallas más opciones · Tamaño de los textos');
  await p4.goto(`${BASE}/editor/p/${E.slug}/pantallas/inicio`);
  for (const g of ['Tamaño del título', 'Tamaño de la frase']) {
    igual(JSON.stringify(await p4.getByRole('group', { name: g, exact: true }).locator('button').allInnerTexts()), JSON.stringify(['Chico', 'Normal', 'Grande']), `Inicio tiene «${g}»`);
    igual(await apretado(p4, g), 'Normal', `«${g}» empieza en Normal`);
  }
  await p4.getByRole('group', { name: 'Tamaño del título', exact: true }).getByRole('button', { name: 'Grande' }).click();
  await esperarGuardado(p4);
  const c8 = await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.tamanos?.titulo === 'grande');
  revisar(iguales(c8.pantallas?.inicio, { modo: 'personalizada', tamanos: { titulo: 'grande' } }), `«Grande» guarda tamanos.titulo y la hace personalizada (${JSON.stringify(c8.pantallas?.inicio)})`);
  await p4.goto(`${BASE}/editor/p/${E.slug}/pantallas/avisos`);
  igual(await p4.getByRole('group', { name: 'Tamaño del título', exact: true }).count(), 1, 'Avisos tiene «Tamaño del título»');
  igual(await p4.getByRole('group', { name: 'Tamaño de la frase', exact: true }).count(), 0, 'y no «Tamaño de la frase»');

  console.log('Pantallas más opciones · Mover la foto');
  await p4.goto(`${BASE}/editor/p/${E.slug}/pantallas/inicio`);
  const mover = p4.getByRole('group', { name: 'Mover la foto', exact: true });
  igual(await mover.count(), 0, 'con «La del tipo de transmisión» no hay «Mover la foto»');
  await p4.getByRole('button', { name: 'Siempre la misma' }).click();
  await esperarGuardado(p4);
  await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.imagen === 'patrono');
  revisar(await mover.isVisible(), 'con «Siempre la misma» (patrono) aparece «Mover la foto»');
  const lados = mover.getByRole('slider', { name: 'Hacia los lados' });
  igual(await lados.inputValue(), '50', '«Hacia los lados» empieza al centro');
  await lados.focus();
  await p4.keyboard.press('ArrowRight');
  await p4.keyboard.press('ArrowRight');
  await esperarGuardado(p4);
  const c9 = await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.encuadre?.imagen?.de === 'patrono');
  const e9 = c9.pantallas?.inicio?.encuadre?.imagen ?? {};
  revisar(e9.de === 'patrono' && e9.x !== 50 && e9.y === 20 && e9.zoom === 100, `con el teclado guarda el encuadre del patrono (${JSON.stringify(e9)})`);
  await mover.getByRole('button', { name: 'Volver a como venía' }).click();
  await esperarGuardado(p4);
  const c10 = await esperarEnBase(E.id, (c) => !c.pantallas?.inicio?.encuadre);
  igual(c10.pantallas?.inicio?.encuadre, undefined, '«Volver a como venía» de la foto borra el encuadre');
  igual(c10.pantallas?.inicio?.modo, 'personalizada', 'y la pantalla sigue personalizada');
  await lados.focus();
  await p4.keyboard.press('ArrowLeft');
  await esperarGuardado(p4);
  await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.encuadre?.imagen?.de === 'patrono');
  await p4.getByLabel('¿Cuál imagen?').selectOption({ label: 'Fachada' });
  await esperarGuardado(p4);
  const c11 = await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.imagen === 'fachada');
  igual(c11.pantallas?.inicio?.encuadre, undefined, 'cambiar a la fachada borra el encuadre del patrono');
  igual(await lados.inputValue(), '50', 'y los deslizadores vuelven al centro');

  console.log('Pantallas más opciones · Mover la foto del fondo');
  igual(await p4.getByRole('group', { name: 'Mover la foto del fondo', exact: true }).count(), 0, 'con los colores de la parroquia no hay «Mover la foto del fondo»');
  await p4.getByRole('button', { name: 'Foto de la galería' }).click();
  await esperarGuardado(p4);
  await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.fondo?.tipo === 'imagen');
  const moverFondo = p4.getByRole('group', { name: 'Mover la foto del fondo', exact: true });
  revisar(await moverFondo.isVisible(), 'con una foto de la galería de fondo aparece «Mover la foto del fondo»');
  await moverFondo.getByRole('slider', { name: 'Arriba / abajo' }).focus();
  await p4.keyboard.press('ArrowUp');
  await esperarGuardado(p4);
  const c12 = await esperarEnBase(E.id, (c) => c.pantallas?.inicio?.encuadre?.fondo);
  const e12 = c12.pantallas?.inicio?.encuadre?.fondo ?? {};
  revisar(e12.de === 'galeria:img-taller' && e12.y !== 50, `el fondo guarda su encuadre (${JSON.stringify(e12)})`);
  igual((await camposSinEtiqueta(p4)).length, 0, 'todo campo tiene etiqueta (con los deslizadores a la vista)');
} finally {
  await navegador.close();
  await limpiar();
}
igual(errores.length, 0, `sin errores de JavaScript (${errores.slice(0, 2).join(' | ')})`);
terminar('pantallas');
