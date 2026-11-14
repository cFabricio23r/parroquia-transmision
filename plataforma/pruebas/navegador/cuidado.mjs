// Lo escrito no se pierde y un error no frena el guardado (plan 3, ronda 2 de la revisión).
// Avisos: formulario con cambios sin guardar, borrar con confirmación, aviso vencido en ámbar.
// Identidad: lo escrito mientras sube una imagen, y un «Nombre corto» de solo espacios.
// Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import sharp from 'sharp';
import {
  BASE,
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

const PNG = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#8a1c2b' } }).png().toBuffer();
const AVISOS = [
  { texto: 'Inscripciones de catequesis', detalle: 'Sábados de 8:00 a 11:00 a. m.', orden: 1 },
  { texto: 'Colecta para el techo', detalle: 'Gracias por tu aporte.', hasta: '2020-01-10', orden: 2 },
  { texto: 'Retiro de jóvenes', orden: 3 },
];
const guardadoDice = (p) => p.locator('[role="status"].pv-guardado').textContent();

const navegador = await chromium.launch();
try {
  const A = await prepararParroquia({ config: { ...CONFIG_BASE, avisos: AVISOS } });
  const pa = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pa, A.correo);
  await pa.goto(`${BASE}/editor/p/${A.slug}/avisos`);
  await pa.locator('.pv-aviso-titulo').first().waitFor();

  console.log('Aviso vencido en ámbar');
  const revisarCaja = pa.locator('.pv-revisar');
  revisar(await revisarCaja.isVisible(), 'la sección muestra la caja «Revisar»');
  const textoCaja = (await revisarCaja.innerText()) ?? '';
  revisar(textoCaja.includes('El aviso «Colecta para el techo» ya terminó'), 'con el título del aviso vencido');
  revisar(textoCaja.includes('Ya no sale en la pantalla. Puedes borrarlo o cambiarle las fechas.'), 'y qué hacer');
  const filaColecta = pa.locator('.pv-aviso-fila').filter({ hasText: 'Colecta para el techo' });
  revisar(await filaColecta.locator('.pv-aviso-rango--vencido').isVisible(), 'la fila vencida tiene la fecha en ámbar');
  const color = await filaColecta.locator('.pv-aviso-rango').evaluate((e) => getComputedStyle(e).color);
  revisar(color !== 'rgb(86, 101, 122)', `y no el gris de las demás (${color})`);
  igual(await pa.locator('.pv-aviso-rango--vencido').count(), 1, 'solo la vencida');

  console.log('Formulario con cambios sin guardar');
  const titulo = pa.getByLabel('Título', { exact: true });
  await pa.getByRole('button', { name: 'Editar Inscripciones de catequesis' }).click();
  await titulo.fill('Inscripciones de catequesis 2027');
  igual(await guardadoDice(pa), 'Sin guardar', 'el encabezado dice «Sin guardar»');
  revisar(await pa.getByText('Este aviso tiene cambios sin guardar.').isVisible(), 'y el formulario lo avisa');

  await pa.getByRole('button', { name: 'Editar Colecta para el techo' }).click();
  const descartar = pa.getByRole('dialog', { name: 'Cambios sin guardar' });
  revisar(await descartar.isVisible(), 'elegir otro aviso pregunta antes');
  await descartar.getByRole('button', { name: 'Seguir editando' }).click();
  igual(await titulo.inputValue(), 'Inscripciones de catequesis 2027', '«Seguir editando» deja lo escrito');

  await pa.locator('nav a', { hasText: 'Galería' }).click();
  await pa.waitForURL(/\/galeria$/);
  igual(await guardadoDice(pa), 'Sin guardar', 'en otra sección el encabezado sigue diciendo «Sin guardar»');
  await pa.locator('nav a', { hasText: 'Avisos fijos' }).click();
  await pa.waitForURL(/\/avisos$/);
  igual(await pa.getByLabel('Título', { exact: true }).inputValue(), 'Inscripciones de catequesis 2027', 'al volver, lo escrito sigue ahí');

  let dialogo = false;
  pa.on('dialog', async (d) => {
    if (d.type() === 'beforeunload') dialogo = true;
    await d.dismiss();
  });
  await pa.reload({ timeout: 3000 }).catch(() => {});
  revisar(dialogo, 'recargar con el formulario sin guardar pide confirmación');

  await pa.getByRole('button', { name: 'Editar Colecta para el techo' }).click();
  await descartar.getByRole('button', { name: 'Guardar aviso' }).click();
  await descartar.waitFor({ state: 'hidden' });
  igual(await pa.getByLabel('Título', { exact: true }).inputValue(), 'Colecta para el techo', '«Guardar aviso» guarda y pasa al otro aviso');
  const conCambio = await esperarEnBase(A.id, (c) => c.avisos.some((x) => x.texto === 'Inscripciones de catequesis 2027'));
  revisar(conCambio.avisos.some((x) => x.texto === 'Inscripciones de catequesis 2027'), 'la base tiene el título nuevo');
  await esperarGuardado(pa);
  igual(await guardadoDice(pa), 'Guardado', 'y el encabezado vuelve a «Guardado»');

  await titulo.fill('Colecta (otra)');
  await pa.getByRole('button', { name: 'Editar Retiro de jóvenes' }).click();
  await descartar.getByRole('button', { name: 'Descartar cambios' }).click();
  igual(await pa.getByLabel('Título', { exact: true }).inputValue(), 'Retiro de jóvenes', '«Descartar cambios» pasa al otro aviso');
  revisar(!(await leerConfig(A.id)).avisos.some((x) => x.texto === 'Colecta (otra)'), 'sin guardar lo descartado');

  console.log('Borrar aviso pide confirmación');
  await pa.getByRole('button', { name: 'Mover Retiro de jóvenes' }).click();
  await pa.getByRole('menuitem', { name: 'Borrar aviso' }).click();
  const borrar = pa.getByRole('dialog', { name: 'Borrar aviso' });
  revisar(await borrar.isVisible(), '«Borrar aviso» abre la confirmación');
  revisar((await borrar.innerText()).includes('¿Borrar el aviso «Retiro de jóvenes»?'), 'que nombra el aviso');
  await borrar.getByRole('button', { name: 'Cancelar' }).click();
  igual(await pa.getByRole('button', { name: 'Editar Retiro de jóvenes' }).count(), 1, '«Cancelar» no borra');
  await pa.waitForTimeout(1200);
  igual((await leerConfig(A.id)).avisos.length, 3, 'y la base sigue con 3');
  await pa.getByRole('button', { name: 'Mover Retiro de jóvenes' }).click();
  await pa.getByRole('menuitem', { name: 'Borrar aviso' }).click();
  await borrar.getByRole('button', { name: 'Sí, borrar' }).click();
  igual(await pa.getByRole('button', { name: 'Editar Retiro de jóvenes' }).count(), 0, '«Sí, borrar» lo quita');
  igual((await esperarEnBase(A.id, (c) => c.avisos.length === 2)).avisos.length, 2, 'y la base queda con 2');

  console.log('Lo escrito mientras sube una imagen');
  const I = await prepararParroquia({
    config: { ...CONFIG_BASE, logos: { blanco: { src: 'medios/logo-blanco-00000000.png', alt: 'Escudo' } } },
  });
  const pi = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pi, I.correo);
  // Cada subida tarda 2,5 s: da tiempo a escribir mientras dice «Subiendo…».
  await pi.route('**/editor/api/*/imagen', async (r) => {
    await new Promise((ok) => setTimeout(ok, 2500));
    await r.continue();
  });
  await pi.goto(`${BASE}/editor/p/${I.slug}/identidad`);
  const grupo = (n) => pi.getByRole('group', { name: n, exact: true });
  const altDe = (n) => grupo(n).getByLabel('Descripción para lectores de pantalla (alt)');

  await pi.locator('input[type=file][data-campo="logo-color"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await grupo('Logo a color (opcional)').getByText('Subiendo…').waitFor();
  await altDe('Logo a color (opcional)').fill('Escudo a color');
  await altDe('Logo blanco (PNG o SVG)').fill('Escudo en blanco');
  const conColor = await esperarEnBase(I.id, (c) => typeof c.logos?.color?.src === 'string', 10_000);
  igual(conColor.logos?.color?.alt, 'Escudo a color', 'el alt escrito durante la subida (campo vacío) se guarda con la imagen');
  igual((await esperarEnBase(I.id, (c) => c.logos?.blanco?.alt === 'Escudo en blanco')).logos?.blanco?.alt, 'Escudo en blanco', 'y el alt del otro logo no se pisa');

  await pi.locator('input[type=file][data-campo="logo-blanco"]').setInputFiles({ name: 'logo2.png', mimeType: 'image/png', buffer: PNG });
  await grupo('Logo blanco (PNG o SVG)').getByText('Subiendo…').waitFor();
  await altDe('Logo blanco (PNG o SVG)').fill('Escudo nuevo');
  const nuevo = await esperarEnBase(I.id, (c) => c.logos?.blanco?.src !== 'medios/logo-blanco-00000000.png', 10_000);
  await esperarGuardado(pi);
  const final = await leerConfig(I.id);
  revisar(final.logos.blanco.src !== 'medios/logo-blanco-00000000.png', `la imagen nueva entra (${nuevo.logos?.blanco?.src})`);
  igual(final.logos.blanco.alt, 'Escudo nuevo', 'con el alt escrito durante la subida (campo con imagen)');
  igual(await altDe('Logo blanco (PNG o SVG)').inputValue(), 'Escudo nuevo', 'y el campo lo sigue mostrando');

  console.log('Un dato que el servidor rechaza no frena lo demás');
  await pi.unroute('**/editor/api/*/imagen');
  await pi.getByLabel('Nombre corto', { exact: true }).fill('   ');
  await pi.getByLabel('Lugar', { exact: true }).fill('Lugar nuevo');
  await esperarGuardado(pi);
  const trasEspacios = await leerConfig(I.id);
  revisar(!('nombreCorto' in trasEspacios), '«Nombre corto» de solo espacios no llega a la base');
  igual(trasEspacios.lugar, 'Lugar nuevo', 'y el lugar se guarda');
  igual(await pi.getByText('No se pudo guardar: hay datos que no tienen la forma correcta.').count(), 0, 'sin aviso de rechazo');
  igual(await pi.locator('[role="status"].pv-guardado').textContent(), 'Guardado', 'y el encabezado dice «Guardado»');

  console.log('Un bloque viejo mal formado no frena las otras secciones');
  const M = await prepararParroquia({ config: { ...CONFIG_BASE, avisos: [{ texto: 'Aviso viejo', desde: 'malo' }] } });
  const pm = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pm, M.correo);
  await pm.goto(`${BASE}/editor/p/${M.slug}/avisos`);
  await pm.getByRole('switch', { name: 'Mostrar Aviso viejo' }).click();
  await pm.getByText('No se pudo guardar: hay datos que no tienen la forma correcta.').waitFor({ timeout: 8000 });
  revisar(true, 'el aviso mal formado se rechaza (422) y se dice');
  await pm.locator('nav a', { hasText: 'Identidad' }).click();
  await pm.waitForURL(/\/identidad$/);
  await pm.getByLabel('Lugar', { exact: true }).fill('Otro lugar');
  const conLugar = await esperarEnBase(M.id, (c) => c.lugar === 'Otro lugar');
  igual(conLugar.lugar, 'Otro lugar', 'el cambio de Identidad igual llega a la base');
  // jsonb reordena las claves: se comparan los campos.
  igual(JSON.stringify(conLugar.avisos.map((a) => [a.texto, a.desde, 'activo' in a])), JSON.stringify([['Aviso viejo', 'malo', false]]), 'y el bloque rechazado no se toca');
  igual(await pm.locator('[role="status"].pv-guardado').textContent(), 'Sin guardar', 'el encabezado sigue diciendo «Sin guardar» por el aviso');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('cuidado');
