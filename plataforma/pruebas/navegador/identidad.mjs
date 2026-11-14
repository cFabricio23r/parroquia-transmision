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
  igual(JSON.stringify(conFachada.fachada), JSON.stringify({ src: 'medios/img-aaaaaa.png', alt: 'Fachada al atardecer' }), '«fachada» tiene el src y el alt de la imagen');

  console.log('Alt vacío');
  await grupo(pagina, 'Foto de la fachada').getByLabel('Descripción para lectores de pantalla (alt)').fill('');
  revisar(await pagina.getByText('Escribe la descripción.').isVisible(), 'un alt vacío muestra «Escribe la descripción.»');
  await esperarGuardado(pagina);
  const estado = await pagina.locator('nav a', { hasText: 'Identidad' }).locator('.pv-solo-lectores').textContent();
  igual(estado, 'Falta algo', 'el punto de Identidad pasa a «Falta algo»');

  console.log('Lo que Identidad no edita');
  const final = await leerConfig(P.id);
  igual(JSON.stringify([final.avisos, final.pantallas, final.tipos]), JSON.stringify([CONFIG.avisos, CONFIG.pantallas, CONFIG.tipos]), 'avisos, pantallas y tipos siguen iguales');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('identidad');
