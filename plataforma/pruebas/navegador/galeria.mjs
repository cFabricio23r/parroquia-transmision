// Pruebas de navegador de la Galería (plan 3, Tarea 14; artboard F9): filtros, subir, editar,
// borrar sin dejar referencias colgando y foco de los diálogos. Contra `next dev` + Supabase local.
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
  limpiar,
  prepararParroquia,
  revisar,
  servicio,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

const img = (id, alt, nombre, etiqueta) => ({ id, src: `medios/${id}.png`, alt, ...(nombre ? { nombre } : {}), etiquetas: [etiqueta] });
const CONFIG = {
  ...CONFIG_BASE,
  galeria: [
    img('img-aaaaa1', 'Imagen de San José con el Niño en brazos', 'San José con el Niño', 'patrono'),
    img('img-aaaaa2', 'Imagen del Sagrado Corazón de Jesús', 'Sagrado Corazón', 'santos'),
    img('img-aaaaa3', 'Custodia dorada sobre el altar', 'Custodia del altar', 'custodia'),
    img('img-aaaaa4', 'Fachada de la iglesia al atardecer', 'Fachada al atardecer', 'fachada'),
    img('img-aaaaa5', 'Imagen de Santa Rosa de Lima con corona de rosas', 'Santa Rosa de Lima', 'santos'),
    img('img-aaaaa6', '', 'Fondo navideño', 'fondos'),
  ],
  pantallas: { inicio: { modo: 'personalizada', imagen: 'galeria:img-aaaaa2' } },
};
// Un JPEG con EXIF (con GPS), para comprobar que la subida lo quita.
const JPEG = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3b5b92' } })
  .jpeg()
  .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '13/1 40/1 0/1' } })
  .toBuffer();

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia({ config: CONFIG });
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pagina, P.correo);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/galeria`);

  console.log('Grilla y filtros');
  const tarjetas = pagina.locator('.pv-galeria-tarjeta');
  igual(await tarjetas.count(), 6, 'hay 6 tarjetas');
  revisar((await pagina.getByRole('button', { name: 'Editar Fondo navideño' }).innerText()).includes('Sin descripción'), '«Fondo navideño» dice «Sin descripción»');
  const filtros = pagina.getByRole('group', { name: 'Filtrar por etiqueta' });
  await filtros.getByRole('button', { name: 'Fondos' }).click();
  igual(await tarjetas.count(), 1, 'el filtro «Fondos» deja 1');
  igual(await filtros.getByRole('button', { name: 'Fondos' }).getAttribute('aria-pressed'), 'true', '«Fondos» tiene aria-pressed="true"');
  await filtros.getByRole('button', { name: 'Todas' }).click();

  console.log('Subir');
  const abrir = pagina.getByRole('button', { name: '+ Subir imagen' });
  await abrir.click();
  const subir = pagina.getByRole('dialog', { name: 'Subir imagen' });
  await subir.waitFor();
  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo del diálogo tiene etiqueta');
  await subir.getByRole('button', { name: 'Subir', exact: true }).click();
  revisar(await subir.getByText('Elige un archivo.').isVisible(), 'sin archivo: «Elige un archivo.»');
  await subir.locator('input[type=file]').setInputFiles({ name: 'virgen-rosario.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await subir.getByRole('button', { name: 'Subir', exact: true }).click();
  revisar(await subir.getByText('Escribe la descripción.').isVisible(), 'sin alt: «Escribe la descripción.»');
  await subir.getByLabel('Descripción (alt)').fill('Imagen de la Virgen del Rosario, con manto azul');
  await subir.getByLabel('Etiqueta').selectOption({ label: 'Santos' });
  await subir.getByRole('button', { name: 'Subir', exact: true }).click();
  await subir.waitFor({ state: 'hidden', timeout: 15_000 });
  await pagina.getByRole('button', { name: 'Editar Imagen de la Virgen del Rosario, con manto azul' }).waitFor();
  revisar(true, 'el diálogo se cierra y aparece la tarjeta');
  const conNueva = await esperarEnBase(P.id, (c) => c.galeria.length === 7);
  const nueva = conNueva.galeria[6];
  revisar(/^img-[0-9a-f]{6}$/.test(nueva.id) && JSON.stringify(nueva.etiquetas) === '["santos"]', `la base tiene la imagen (${nueva.id}, ${JSON.stringify(nueva.etiquetas)})`);
  const { data: bajada } = await servicio.storage.from('borradores').download(`${P.id}/${nueva.src.replace(/^medios\//, '')}`);
  const meta = await sharp(Buffer.from(await bajada.arrayBuffer())).metadata();
  revisar(!meta.exif, 'el archivo subido no conserva EXIF');

  console.log('Editar');
  await pagina.getByRole('button', { name: 'Editar Fondo navideño' }).click();
  const editar = pagina.getByRole('dialog', { name: 'Editar imagen' });
  await editar.getByLabel('Descripción (alt)').fill('Fondo con luces de Navidad');
  await editar.getByRole('button', { name: 'Guardar' }).click();
  await esperarGuardado(pagina);
  revisar(!(await pagina.getByRole('button', { name: 'Editar Fondo navideño' }).innerText()).includes('Sin descripción'), 'la tarjeta ya no dice «Sin descripción»');
  igual(await pagina.locator('nav a', { hasText: 'Galería' }).locator('.pv-solo-lectores').textContent(), 'Listo', 'el punto de Galería pasa a «Listo»');

  console.log('Borrar una imagen en uso');
  await pagina.getByRole('button', { name: 'Editar Sagrado Corazón' }).click();
  await editar.getByRole('button', { name: 'Borrar imagen' }).click();
  const borrar = pagina.getByRole('dialog', { name: 'Borrar imagen' });
  revisar(
    await borrar.getByText('Esta imagen se usa en: Pantalla de Inicio. Si la borras, esos lugares vuelven a como vienen.').isVisible(),
    'la confirmación dice dónde se usa',
  );
  await borrar.getByRole('button', { name: 'Sí, borrar' }).click();
  const sinImagen = await esperarEnBase(P.id, (c) => !c.galeria.some((i) => i.id === 'img-aaaaa2'));
  revisar(!sinImagen.galeria.some((i) => i.id === 'img-aaaaa2'), 'la base ya no tiene la imagen');
  revisar(!('imagen' in (sinImagen.pantallas?.inicio ?? {})), 'ni pantallas.inicio.imagen');

  console.log('Foco');
  await abrir.focus();
  await abrir.press('Enter');
  await subir.waitFor();
  await pagina.keyboard.press('Escape');
  await subir.waitFor({ state: 'hidden' });
  igual(await pagina.evaluate(() => document.activeElement?.textContent), '+ Subir imagen', 'Esc cierra y el foco vuelve a «+ Subir imagen»');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('galeria');
