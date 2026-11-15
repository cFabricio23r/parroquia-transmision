// Pruebas de navegador del Resumen (plan 3, Tarea 11; artboard F1): tarjetas por sección, links para
// OBS con «Copiar», «Revisar y publicar» y el diálogo de la última versión publicada.
import { chromium } from 'playwright';
import { BASE, CONFIG_BASE, entrar, igual, limpiar, prepararParroquia, revisar, terminar, VIEWPORT } from './lib/editor.mjs';

const TITULOS = [
  'Identidad',
  'Patrono y fiesta',
  'Pantallas',
  'Rótulos y estilo',
  'Tipos de transmisión',
  'Galería',
  'Horarios y redes',
  'Avisos fijos',
];
const img = (id, alt) => ({ id, src: `medios/${id}.png`, alt, etiquetas: ['santos'] });
const CONFIG = {
  ...CONFIG_BASE,
  galeria: [img('img-a', 'Imagen de San José'), img('img-b', '')],
  pantallas: { inicio: { modo: 'personalizada', distribucion: 'derecha' }, avisos: { modo: 'personalizada' } },
  horarios: [
    { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }], lugar: 'Templo' },
    { dia: 'Sábado', hora: '5:00 p. m.', lugar: 'Capilla' },
    { dia: 'Jueves', horas: [{ hora: '6:00 p. m.' }], lugar: 'Templo' },
    { dia: 'Lunes a viernes', horas: [{ hora: '6:30 a. m.' }], lugar: 'Templo' },
  ],
  redes: [
    { red: 'facebook', url: 'https://facebook.com/x', texto: 'facebook.com/x' },
    { red: 'whatsapp', url: 'https://wa.me/50370000000', texto: '7000-0000' },
  ],
};
const tarjeta = (p, titulo) => p.locator('.pv-resumen-tarjeta', { has: p.getByRole('link', { name: titulo, exact: true }) });

const navegador = await chromium.launch();
try {
  console.log('Tarjetas');
  const P = await prepararParroquia({ config: CONFIG });
  const contexto = await navegador.newContext({ viewport: VIEWPORT, permissions: ['clipboard-read', 'clipboard-write'] });
  const pagina = await contexto.newPage();
  await entrar(pagina, P.correo);
  await pagina.goto(`${BASE}/editor/p/${P.slug}`);
  const titulos = await pagina.locator('.pv-resumen-tarjeta .pv-resumen-titulo').allInnerTexts();
  igual(JSON.stringify(titulos), JSON.stringify(TITULOS), 'hay 8 tarjetas en el orden del menú');
  const galeria = await tarjeta(pagina, 'Galería').innerText();
  revisar(galeria.includes('Falta algo') && galeria.includes('1 imagen sin descripción (alt).'), '«Galería» dice «Falta algo» y «1 imagen sin descripción (alt).»');
  const avisos = await tarjeta(pagina, 'Avisos fijos').innerText();
  revisar(avisos.includes('Opcional') && avisos.includes('Sin avisos todavía.'), '«Avisos fijos» dice «Opcional» y «Sin avisos todavía.»');
  revisar((await tarjeta(pagina, 'Horarios y redes').innerText()).includes('4 horarios, Facebook y WhatsApp.'), '«Horarios y redes» dice «4 horarios, Facebook y WhatsApp.»');
  igual(
    await tarjeta(pagina, 'Galería').getByRole('link', { name: 'Galería', exact: true }).getAttribute('href'),
    `/editor/p/${P.slug}/galeria`,
    'el título «Galería» lleva a /galeria',
  );

  console.log('Toda la tarjeta es el enlace (ronda de arreglos 2)');
  const enlacesPorTarjeta = await pagina.locator('.pv-resumen-tarjeta').evaluateAll((l) => l.map((t) => t.querySelectorAll('a').length));
  revisar(enlacesPorTarjeta.every((k) => k === 1), `cada tarjeta tiene un solo enlace (${enlacesPorTarjeta.join(', ')})`);
  // Un punto de la frase (abajo a la derecha de la tarjeta) cae en el enlace, no en texto suelto.
  const destino = await tarjeta(pagina, 'Horarios y redes').evaluate((t) => {
    const r = t.getBoundingClientRect();
    const e = document.elementFromPoint(r.right - 12, r.bottom - 8);
    return e?.closest('a')?.getAttribute('href') ?? null;
  });
  igual(destino, `/editor/p/${P.slug}/horarios-y-redes`, 'la esquina de abajo de la tarjeta lleva a su sección');
  const enlaceGaleria = tarjeta(pagina, 'Galería').getByRole('link', { name: 'Galería', exact: true });
  await enlaceGaleria.focus();
  await pagina.keyboard.press('Shift+Tab');
  await pagina.keyboard.press('Tab');
  const foco = await tarjeta(pagina, 'Galería').evaluate((t) => {
    const c = getComputedStyle(t);
    return { estilo: c.outlineStyle, ancho: parseFloat(c.outlineWidth), enfocado: document.activeElement?.textContent };
  });
  revisar(foco.enfocado === 'Galería' && foco.estilo !== 'none' && foco.ancho >= 2, `con el teclado, la tarjeta enfocada muestra el foco (${JSON.stringify(foco)})`);
  // Un clic de verdad en el centro de la frase (el enlace la cubre: locator.click diría que algo la tapa).
  const frase = await tarjeta(pagina, 'Horarios y redes').locator('.pv-resumen-frase').boundingBox();
  await pagina.mouse.click(frase.x + frase.width / 2, frase.y + frase.height / 2);
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/horarios-y-redes`, { timeout: 5000 }).catch(() => {});
  igual(new URL(pagina.url()).pathname, `/editor/p/${P.slug}/horarios-y-redes`, 'un clic en la frase abre la sección');
  await pagina.goto(`${BASE}/editor/p/${P.slug}`);

  console.log('Pantallas y Tipos (plan 4)');
  revisar((await tarjeta(pagina, 'Pantallas').innerText()).includes('2 de 7 personalizadas; el resto, como vienen.'), '«Pantallas» dice «2 de 7 personalizadas; el resto, como vienen.»');
  const T = await prepararParroquia({ config: { ...CONFIG, tipos: { apagados: ['procesion'], propios: [{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora' }] } } });
  const pt = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pt, T.correo);
  await pt.goto(`${BASE}/editor/p/${T.slug}`);
  // Decisión 16: 8 filas comunes encendidas (9 menos procesión) más el propio.
  revisar((await tarjeta(pt, 'Tipos de transmisión').innerText()).includes('9 activos, 1 propio.'), '«Tipos de transmisión» dice «9 activos, 1 propio.»');

  console.log('Links para OBS');
  revisar(await pagina.getByText(`…/${P.slug}/panel.html`).isVisible(), `está el texto …/${P.slug}/panel.html`);
  const fila = pagina.locator('.pv-resumen-link', { hasText: 'Panel de control' });
  await fila.getByRole('button', { name: 'Copiar' }).click();
  await fila.getByRole('button', { name: 'Copiado' }).waitFor({ timeout: 2000 });
  revisar(true, 'el botón dice «Copiado»');
  const copiado = await pagina.evaluate(() => navigator.clipboard.readText());
  igual(copiado, `${new URL(BASE).origin}/${P.slug}/panel.html`, 'el portapapeles tiene el link del panel');
  igual(await pagina.locator('.pv-resumen-anuncio').textContent(), 'Link copiado.', 'un status anuncia «Link copiado.»');

  console.log('Sin versión publicada');
  igual(await pagina.getByRole('button', { name: 'Ver la última versión publicada' }).count(), 0, 'sin versión no hay «Ver la última versión publicada»');
  await pagina.getByRole('link', { name: 'Revisar y publicar' }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/publicar`);
  revisar(true, '«Revisar y publicar» lleva a /publicar');

  console.log('Con versión publicada');
  const V = await prepararParroquia({ config: CONFIG, versiones: [{ numero: 1, config: { ...CONFIG, nombre: 'Nombre de la versión uno' } }] });
  const p2 = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(p2, V.correo);
  await p2.goto(`${BASE}/editor/p/${V.slug}`);
  await p2.getByRole('button', { name: 'Ver la última versión publicada' }).click();
  const dialogo = p2.getByRole('dialog', { name: 'Versión 1 publicada' });
  await dialogo.waitFor();
  const marco = dialogo.locator('iframe');
  const caja = await marco.boundingBox();
  revisar(Math.abs(caja.width - 448) <= 1 && Math.abs(caja.height - 252) <= 1, `el iframe mide 448 × 252 (mide ${caja.width} × ${caja.height})`);
  await p2.frameLocator('dialog iframe').getByText('Nombre de la versión uno').first().waitFor({ timeout: 5000 });
  revisar(true, 'el iframe muestra el nombre de la versión publicada');
  await dialogo.getByRole('button', { name: 'Cerrar' }).click();
  revisar(!(await dialogo.isVisible()), '«Cerrar» cierra el diálogo');
  await p2.getByRole('button', { name: 'Ver la última versión publicada' }).click();
  await dialogo.waitFor();
  await p2.keyboard.press('Escape');
  revisar(!(await dialogo.isVisible()), 'Esc cierra el diálogo');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('resumen');
