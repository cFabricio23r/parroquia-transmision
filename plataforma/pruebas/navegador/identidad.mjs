// Pruebas de navegador de Identidad (plan 3, Tarea 12; artboard F2) y de Patrono y fiesta (Tarea 13, F3).
// Contra `next dev` + Supabase local.
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
  elegirColor,
  espiarSelector,
  selectoresAbiertos,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

// Un PNG de verdad (40×30), para que la revisión de la subida lo acepte.
const PNG = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#8a1c2b' } }).png().toBuffer();
const CONFIG = {
  ...CONFIG_BASE,
  nombreCorto: 'San José',
  logos: { blanco: { src: 'medios/logo-blanco-00000000.png', alt: 'Escudo de la Parroquia San José' } },
  fachada: { src: 'medios/fachada-00000000.png', alt: 'Fachada de día' },
  galeria: [{ id: 'img-aaaaaa', src: 'medios/img-aaaaaa.png', alt: 'Fachada al atardecer', etiquetas: ['fachada'] }],
  avisos: [{ texto: 'Colecta' }],
  pantallas: { avisos: { modo: 'personalizada' } },
  tipos: { apagados: ['semana'] },
};
const grupo = (p, nombre) => p.getByRole('group', { name: nombre, exact: true });

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia({ config: CONFIG });
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pagina, P.correo);
  await espiarSelector(pagina);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/identidad`);

  console.log('Campos y etiquetas');
  igual(await pagina.getByLabel('Nombre completo', { exact: true }).inputValue(), 'Parroquia San José', '«Nombre completo» trae el borrador');
  igual(await pagina.getByLabel('Nombre corto', { exact: true }).inputValue(), 'San José', '«Nombre corto» trae el borrador');
  igual(await pagina.getByLabel('Lugar', { exact: true }).inputValue(), CONFIG.lugar, '«Lugar» trae el borrador');
  for (const e of ['Color principal', 'Color oscuro', 'Color de acento']) revisar(await pagina.getByLabel(e, { exact: true }).isVisible(), `está «${e}»`);
  for (const g of ['Logo blanco (PNG o SVG)', 'Logo a color (opcional)', 'Foto de la fachada']) {
    revisar(await grupo(pagina, g).getByLabel('Descripción para lectores de pantalla (alt)').isVisible(), `«${g}» tiene su alt`);
  }
  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo tiene etiqueta');

  console.log('Pastillas de contraste');
  // El artboard dibuja 8,9:1 y 14,6:1, pero la fórmula WCAG de lib/contraste.ts (espejo de vicaria)
  // da 9,2:1 y 15,2:1 para #8a1c2b y #4b0f18: se prueba el cálculo real (ver el informe del plan 3).
  revisar(await pagina.getByText('Texto blanco sobre principal: 9,2:1 ✓').isVisible(), '«Texto blanco sobre principal: 9,2:1 ✓»');
  revisar(await pagina.getByText('Sobre oscuro: 15,2:1 ✓').isVisible(), '«Sobre oscuro: 15,2:1 ✓»');
  revisar(await pagina.getByText(/^Sobre acento, texto oscuro: .*✓$/).isVisible(), '«Sobre acento, texto oscuro: …✓»');

  console.log('Color a medio escribir');
  const principal = pagina.getByLabel('Color principal', { exact: true });
  await principal.fill('#8a1');
  revisar(await pagina.getByText('Escribe el color como #rrggbb.').isVisible(), '«#8a1» muestra «Escribe el color como #rrggbb.»');
  await pagina.waitForTimeout(1500);
  igual((await leerConfig(P.id)).colores.principal, '#8a1c2b', 'la base no recibe «#8a1»');
  await principal.fill('#7a1c2b');
  await esperarGuardado(pagina);
  igual((await esperarEnBase(P.id, (c) => c.colores.principal === '#7a1c2b')).colores.principal, '#7a1c2b', 'un #rrggbb completo se guarda');

  console.log('Selector de color');
  await pagina.getByRole('button', { name: 'Elegir color principal' }).click();
  let abiertos = await selectoresAbiertos(pagina);
  igual(JSON.stringify(abiertos.at(-1)), JSON.stringify({ campo: 'identidad-color-principal', valor: '#7a1c2b' }), 'el botón «Elegir color principal» abre el selector en el color actual');
  await principal.click();
  igual((await selectoresAbiertos(pagina)).length, abiertos.length + 1, 'un clic en el texto también lo abre');
  igual(await pagina.evaluate(() => document.activeElement?.id), 'identidad-color-principal', 'y el foco queda en el texto');
  const trasPrimerClic = (await selectoresAbiertos(pagina)).length;
  await principal.click();
  await principal.dblclick();
  igual((await selectoresAbiertos(pagina)).length, trasPrimerClic, 'con el foco ya en el texto, otro clic o un doble clic no lo vuelven a abrir (para corregir una letra)');
  abiertos = await selectoresAbiertos(pagina);
  await principal.focus();
  await pagina.keyboard.press('Tab');
  await pagina.keyboard.press('Tab');
  igual(await pagina.evaluate(() => document.activeElement?.id), 'identidad-color-oscuro', 'con Tab se llega al texto de «Color oscuro» (el input de color no está en el camino)');
  igual((await selectoresAbiertos(pagina)).length, abiertos.length, 'con Tab no se abre el selector');
  await pagina.keyboard.press('ControlOrMeta+a');
  await pagina.keyboard.type('#4b0f19');
  await esperarGuardado(pagina);
  igual((await esperarEnBase(P.id, (c) => c.colores.oscuro === '#4b0f19')).colores.oscuro, '#4b0f19', 'escrito con el teclado se guarda');
  await principal.fill('#8a1');
  await pagina.getByRole('button', { name: 'Elegir color principal' }).click();
  igual((await selectoresAbiertos(pagina)).at(-1)?.valor, '#7a1c2b', 'con «#8a1» a medio escribir abre en el último color válido');
  await elegirColor(pagina, 'identidad-color-principal', '#123456');
  igual(await principal.inputValue(), '#123456', 'elegir un color lo pone en el texto');
  revisar(!(await pagina.getByText('Escribe el color como #rrggbb.').isVisible()), 'y quita el error de «#8a1»');
  await esperarGuardado(pagina);
  igual((await esperarEnBase(P.id, (c) => c.colores.principal === '#123456')).colores.principal, '#123456', 'lo elegido se guarda');
  revisar(await pagina.getByText(/^Texto blanco sobre principal: 12,\d:1 ✓$/).isVisible(), 'la pastilla del principal se actualiza');
  const puts = [];
  const anotarPut = (r) => r.method() === 'PUT' && r.url().endsWith('/borrador') && puts.push(r.url());
  pagina.on('request', anotarPut);
  for (const c of ['#111111', '#222222', '#333333', '#444444', '#555555']) {
    await elegirColor(pagina, 'identidad-color-principal', c);
    await pagina.waitForTimeout(50);
  }
  await esperarGuardado(pagina);
  await pagina.waitForTimeout(1200);
  pagina.off('request', anotarPut);
  igual(puts.length, 1, 'arrastrar en el selector (cinco cambios seguidos) hace un solo guardado');
  igual((await esperarEnBase(P.id, (c) => c.colores.principal === '#555555')).colores.principal, '#555555', 'y guarda el último color');
  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo tiene etiqueta (con el input de color)');

  console.log('Nombre corto vacío');
  await pagina.getByLabel('Nombre corto', { exact: true }).fill('');
  await esperarGuardado(pagina);
  revisar(!('nombreCorto' in (await esperarEnBase(P.id, (c) => !('nombreCorto' in c)))), 'vaciar «Nombre corto» lo quita de la base');

  console.log('Subir el logo blanco');
  await pagina.locator('input[type=file][data-campo="logo-blanco"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  const conLogo = await esperarEnBase(P.id, (c) => /^medios\/logo-blanco-[0-9a-f]{8}\.png$/.test(c.logos?.blanco?.src ?? '') && c.logos.blanco.src !== CONFIG.logos.blanco.src);
  revisar(/^medios\/logo-blanco-[0-9a-f]{8}\.png$/.test(conLogo.logos.blanco.src), `la base tiene el logo nuevo (${conLogo.logos.blanco.src})`);
  igual(conLogo.logos.blanco.alt, 'Escudo de la Parroquia San José', 'y conserva el alt de antes');
  const miniatura = grupo(pagina, 'Logo blanco (PNG o SVG)').locator('.pv-miniatura img');
  revisar((await miniatura.count()) === 1 && (await miniatura.evaluate((i) => i.complete && i.naturalWidth > 0)), 'la miniatura muestra la imagen');

  console.log('Elegir de la galería');
  await grupo(pagina, 'Foto de la fachada').getByRole('button', { name: 'Elegir de la galería' }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Elegir de la galería' });
  await dialogo.getByRole('button', { name: /Fachada al atardecer/ }).click();
  const conFachada = await esperarEnBase(P.id, (c) => c.fachada?.src === 'medios/img-aaaaaa.png');
  // jsonb reordena las claves: se comparan los campos, no el texto del JSON.
  igual(JSON.stringify([conFachada.fachada?.src, conFachada.fachada?.alt, Object.keys(conFachada.fachada ?? {}).length]), JSON.stringify(['medios/img-aaaaaa.png', 'Fachada al atardecer', 2]), '«fachada» tiene el src y el alt de la imagen');

  console.log('Alt vacío');
  await grupo(pagina, 'Foto de la fachada').getByLabel('Descripción para lectores de pantalla (alt)').fill('');
  revisar(await pagina.getByText('Escribe la descripción.').isVisible(), 'un alt vacío muestra «Escribe la descripción.»');
  await esperarGuardado(pagina);
  const estado = await pagina.locator('nav a', { hasText: 'Identidad' }).locator('.pv-solo-lectores').textContent();
  igual(estado, 'Falta algo', 'el punto de Identidad pasa a «Falta algo»');

  console.log('Lo que Identidad no edita');
  const final = await leerConfig(P.id);
  igual(JSON.stringify([final.avisos, final.pantallas, final.tipos]), JSON.stringify([CONFIG.avisos, CONFIG.pantallas, CONFIG.tipos]), 'avisos, pantallas y tipos siguen iguales');

  console.log('Patrono y fiesta');
  const F = await prepararParroquia({
    config: { ...CONFIG_BASE, fiesta: { dia: 31, mes: 1, lema: 'José, hombre justo y fiel', cuentaDesdeDias: 45 } },
  });
  const pf = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pf, F.correo);
  await pf.goto(`${BASE}/editor/p/${F.slug}/patrono`);
  for (const e of ['Nombre del patrono', 'Título corto', 'Día de la fiesta', 'Mes', 'Lema de la fiesta', 'Cuenta regresiva']) {
    revisar(await pf.getByLabel(e, { exact: true }).isVisible(), `está «${e}»`);
  }
  revisar(await grupo(pf, 'Imagen principal del patrono').getByLabel('Descripción para lectores de pantalla (alt)').isVisible(), 'la imagen del patrono tiene su alt');
  igual((await camposSinEtiqueta(pf)).length, 0, 'todo campo de Patrono tiene etiqueta');
  igual(await pf.getByLabel('Cuenta regresiva', { exact: true }).locator('option:checked').innerText(), 'Desde 45 días antes', 'un valor raro (45) se muestra');
  await pf.getByLabel('Mes', { exact: true }).selectOption({ label: 'abril' });
  igual(await pf.getByLabel('Día de la fiesta', { exact: true }).inputValue(), '30', 'al elegir abril, el 31 baja a 30');
  const enAbril = await esperarEnBase(F.id, (c) => c.fiesta.mes === 4);
  igual(JSON.stringify([enAbril.fiesta.dia, enAbril.fiesta.mes]), '[30,4]', 'la base tiene { dia: 30, mes: 4 }');
  igual(enAbril.fiesta.cuentaDesdeDias, 45, 'sin tocar la cuenta, sigue en 45');
  await pf.getByLabel('Mes', { exact: true }).selectOption({ label: 'febrero' });
  igual(await pf.getByLabel('Día de la fiesta', { exact: true }).locator('option').last().innerText(), '29', 'febrero llega a 29');
  await pf.getByLabel('Cuenta regresiva', { exact: true }).selectOption({ label: 'Desde 9 días antes (la novena)' });
  igual((await esperarEnBase(F.id, (c) => c.fiesta.cuentaDesdeDias === 9)).fiesta.cuentaDesdeDias, 9, '«Desde 9 días antes (la novena)» guarda 9');
  revisar(
    await pf.getByText('«José, hombre justo y fiel» aparece como franja abajo, con el color de acento.').isVisible(),
    'la nota de la vista previa trae el lema',
  );
  await pf.getByLabel('Lema de la fiesta', { exact: true }).fill('Santo varón');
  revisar(await pf.getByText('«Santo varón» aparece como franja abajo, con el color de acento.').isVisible(), 'y cambia al escribir otro lema');

  console.log('Obligatorios vacíos: el «Falta …» junto al campo (ronda de arreglos 2)');
  // Una parroquia nueva, sin nada: el punto del menú está en rojo y cada campo dice qué le falta.
  const V = await prepararParroquia({ config: {} });
  const pv = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pv, V.correo);
  await pv.goto(`${BASE}/editor/p/${V.slug}/identidad`);
  const faltaEn = async (p, etiqueta, mensaje) => {
    const campo = p.getByLabel(etiqueta, { exact: true });
    await campo.waitFor();
    const invalido = await campo.getAttribute('aria-invalid');
    const ids = ((await campo.getAttribute('aria-describedby')) ?? '').split(' ').filter(Boolean);
    const textos = await Promise.all(ids.map((id) => p.locator(`[id="${id}"]`).innerText()));
    revisar(invalido === 'true' && textos.includes(mensaje), `«${etiqueta}» vacío: aria-invalid y «${mensaje}» (${invalido}, ${JSON.stringify(textos)})`);
  };
  await faltaEn(pv, 'Nombre completo', 'Falta el nombre de la parroquia.');
  await faltaEn(pv, 'Lugar', 'Falta el lugar.');
  await faltaEn(pv, 'Color principal', 'Falta el color principal.');
  await faltaEn(pv, 'Color oscuro', 'Falta el color oscuro.');
  igual(await pv.getByText('Escribe el color como #rrggbb.').count(), 0, 'un color vacío no muestra el error de forma');
  igual(await pv.getByLabel('Color de acento', { exact: true }).getAttribute('aria-invalid'), null, 'el acento (opcional) vacío no es error');
  igual(await pv.getByLabel('Nombre corto', { exact: true }).getAttribute('aria-invalid'), null, '«Nombre corto» (opcional) vacío no es error');
  revisar(await grupo(pv, 'Logo blanco (PNG o SVG)').getByText('Falta el logo blanco.').isVisible(), 'el logo blanco dice «Falta el logo blanco.»');
  revisar(await grupo(pv, 'Foto de la fachada').getByText('Falta la foto de la fachada.').isVisible(), 'la fachada dice «Falta la foto de la fachada.»');
  igual(await grupo(pv, 'Logo a color (opcional)').locator('.pv-campo-error').count(), 0, 'el logo a color (opcional) no dice nada');
  await pv.getByLabel('Nombre completo', { exact: true }).fill('Parroquia Nueva');
  igual(await pv.getByLabel('Nombre completo', { exact: true }).getAttribute('aria-invalid'), null, 'al escribir el nombre, el «Falta …» se va');
  await esperarGuardado(pv);
  await pv.goto(`${BASE}/editor/p/${V.slug}/patrono`);
  await faltaEn(pv, 'Nombre del patrono', 'Falta el nombre del patrono.');
  await faltaEn(pv, 'Título corto', 'Falta el título corto del patrono.');
  await faltaEn(pv, 'Día de la fiesta', 'Falta el día de la fiesta.');
  await faltaEn(pv, 'Mes', 'Falta el mes de la fiesta.');
  igual(await pv.getByLabel('Lema de la fiesta', { exact: true }).getAttribute('aria-invalid'), null, 'el lema (opcional) vacío no es error');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('identidad');
