// Pruebas de navegador de «Transmisiones de la semana» (etapa 3b, Tarea 9), contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import { BASE, camposSinEtiqueta, entrar, igual, limpiar, prepararParroquia, revisar, servicio, terminar, VIEWPORT } from './lib/editor.mjs';

// Fechas en UTC, como vicaria/semana.js; «hoy» en la hora de El Salvador, como el editor.
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const utc = (f) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const sumar = (f, n) => iso(utc(f) + n * 86_400_000);
const dow = (f) => ((new Date(utc(f)).getUTCDay() + 6) % 7) + 1;
const LUNES = sumar(hoy, 1 - dow(hoy));
const JUEVES = sumar(LUNES, 3);
const nJueves = Number(JUEVES.slice(8, 10));
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOMINGO = sumar(LUNES, 6);
const rango = (() => {
  const a = { d: Number(LUNES.slice(8)), m: MESES[Number(LUNES.slice(5, 7)) - 1], y: LUNES.slice(0, 4) };
  const b = { d: Number(DOMINGO.slice(8)), m: MESES[Number(DOMINGO.slice(5, 7)) - 1], y: DOMINGO.slice(0, 4) };
  if (a.y !== b.y) return `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}`;
  return `${a.d} – ${b.d} ${b.m} ${b.y}`;
})();

const esperar = async (cond, timeout = 10_000) => {
  const limite = Date.now() + timeout;
  for (;;) {
    const v = await cond().catch(() => false);
    if (v || Date.now() > limite) return v;
    await new Promise((ok) => setTimeout(ok, 250));
  }
};

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia();
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  pagina.on('pageerror', (e) => revisar(false, `error de JavaScript: ${e.message}`));
  await entrar(pagina, P.correo);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/semana`);
  const lista = pagina.locator('.sem-lista');

  console.log('Vacía');
  igual(await pagina.locator('h1').innerText(), 'Transmisiones de la semana', 'el h1');
  revisar(await pagina.getByText(rango, { exact: true }).isVisible(), `el rango «${rango}»`);
  revisar(
    await esperar(() => pagina.getByText('Todavía no hay transmisiones esta semana. Empieza con una fija, como la misa del domingo.').isVisible()),
    'el texto de semana vacía',
  );

  console.log('+ Fija');
  const botonFija = pagina.getByRole('button', { name: '+ Fija (todas las semanas)' });
  await botonFija.click();
  const dialogo = pagina.locator('dialog[open]');
  await dialogo.getByLabel('Día de la semana').selectOption('4');
  await dialogo.getByLabel('Hora', { exact: true }).fill('18:00');
  await dialogo.getByLabel('Tipo', { exact: true }).selectOption('horasanta');
  for (const e of ['Guía', 'Exposición del Santísimo', 'Lectura', 'Oración']) {
    revisar(await dialogo.getByLabel(e, { exact: true }).isVisible(), `Hora Santa pide «${e}»`);
  }
  igual((await camposSinEtiqueta(pagina)).length, 0, 'con el diálogo abierto, todos los campos tienen etiqueta');
  await dialogo.getByLabel('Guía', { exact: true }).fill('Ana');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  const fila = lista.locator('.sem-item', { hasText: `Jue ${nJueves} · 18:00 · Hora Santa` });
  revisar(await esperar(() => fila.isVisible()), 'la fila «Jue <n> · 18:00 · Hora Santa»');
  revisar(await fila.getByText('Fija (todos los jueves)').isVisible(), '«Fija (todos los jueves)»');
  revisar(await fila.getByText('● Faltan 3 datos').isVisible(), '«● Faltan 3 datos»');

  console.log('Editar este día');
  const nombreEditar = `Editar el jueves ${nJueves}, 18:00, Hora Santa`;
  const editar = fila.getByRole('button', { name: nombreEditar });
  igual(await editar.innerText(), 'Editar este día', `«Editar este día» se llama «${nombreEditar}»`);
  await editar.click();
  await dialogo.getByLabel('Exposición del Santísimo', { exact: true }).fill('Santísimo');
  await dialogo.getByLabel('Lectura', { exact: true }).fill('Juan 6');
  await dialogo.getByLabel('Oración', { exact: true }).fill('Alma de Cristo');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  revisar(await esperar(() => fila.getByText('● Listo').isVisible()), 'con los tres completos, «● Listo»');

  console.log('Esc devuelve el foco');
  await editar.click();
  await dialogo.waitFor();
  await pagina.keyboard.press('Escape');
  revisar(await esperar(() => pagina.locator('dialog[open]').count().then((n) => n === 0)), 'Esc cierra el diálogo');
  revisar(await editar.evaluate((b) => b === document.activeElement), 'el foco vuelve al botón');

  console.log('Administrar fijas');
  await pagina.getByRole('link', { name: 'Administrar fijas' }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/semana/fijas`);
  const tablaFijas = pagina.getByRole('table', { name: 'Fijas' });
  revisar(await esperar(() => tablaFijas.getByText('Guía: Ana', { exact: true }).isVisible()), 'la fija sigue con «Guía: Ana»');
  igual(await tablaFijas.getByText('Juan 6').count(), 0, 'y nada más (editar un día no cambia la fija)');
  igual((await camposSinEtiqueta(pagina)).length, 0, 'Administrar fijas: campos con etiqueta');
  await pagina.goBack();

  console.log('Saltar esta semana');
  await fila.getByRole('button', { name: `Saltar el jueves ${nJueves}, 18:00, Hora Santa` }).click();
  revisar(await esperar(() => fila.getByText('saltada esta semana').isVisible()), '«saltada esta semana»');
  await fila.getByRole('button', { name: /^Volver a ponerla/ }).click();
  revisar(await esperar(() => fila.getByText('● Listo').isVisible()), 'vuelve, con sus datos');

  console.log('+ Serie');
  await pagina.getByRole('button', { name: '+ Serie de días (novena)' }).click();
  await dialogo.getByLabel('Nombre', { exact: true }).fill('Prenovena 2026');
  await dialogo.getByLabel('Tipo', { exact: true }).selectOption('prenovena');
  await dialogo.getByLabel('Empieza el').fill(LUNES);
  await dialogo.getByLabel('Cantidad de días').fill('9');
  await dialogo.getByLabel('Hora', { exact: true }).fill('19:00');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  const deSerie = lista.getByText('Parte de "Prenovena 2026" (9 días)');
  revisar(await esperar(() => deSerie.count().then((n) => n === 7)), 'siete filas de la serie esta semana');
  await pagina.getByRole('button', { name: 'Semana siguiente' }).click();
  revisar(await esperar(() => deSerie.count().then((n) => n === 2)), 'la semana siguiente muestra las dos que quedan');
  await pagina.getByRole('button', { name: 'Semana anterior' }).click();
  revisar(await esperar(() => deSerie.count().then((n) => n === 7)), 'y de vuelta');

  console.log('+ Una transmisión');
  await pagina.getByRole('button', { name: '+ Una transmisión' }).click();
  await dialogo.getByLabel('Fecha de la transmisión').fill(sumar(LUNES, 4));
  await dialogo.getByLabel('Hora', { exact: true }).fill('10:00');
  await dialogo.getByLabel('Tipo', { exact: true }).selectOption('dominical');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  const suelta = lista.locator('.sem-item', { hasText: 'Una sola vez' });
  revisar(await esperar(() => suelta.isVisible()), 'la suelta sale con «Una sola vez»');
  await suelta.getByRole('button', { name: /^Borrar el/ }).click();
  revisar(await pagina.getByText('¿Borrar esta transmisión?').isVisible(), 'pide confirmar');
  await pagina.locator('dialog[open]').getByRole('button', { name: 'Borrar' }).click();
  revisar(await esperar(() => suelta.count().then((n) => n === 0)), 'Borrar la quita');

  console.log('Cambiado desde la app');
  const { data: fijas } = await servicio.from('transmisiones_fijas').select('id').eq('parroquia_id', P.id);
  const fijaId = fijas[0].id;
  const viernes = sumar(LUNES, 4);
  const { error: e1 } = await servicio.from('transmisiones_fijas').update({ dia_semana: 5 }).eq('id', fijaId);
  revisar(!e1, 'la fija pasa al viernes');
  const { error: e2 } = await servicio.from('transmisiones').insert({
    parroquia_id: P.id, clave: `fija:${fijaId}:${viernes}`, fecha: viernes, hora: '18:00', tipo: 'horasanta',
    datos: { lectura1: 'Desde la app' }, origen: 'fija', fija_id: fijaId, editada: true, actualizado_desde: 'app',
  });
  revisar(!e2, 'se escribe una fila desde la app');

  console.log('Tipo no disponible');
  const { error: e3 } = await servicio.from('transmisiones_fijas').insert({ parroquia_id: P.id, dia_semana: 6, hora: '07:00', tipo: 'vigilia', datos: {} });
  revisar(!e3, 'una fija con un tipo que no existe');
  await pagina.reload();
  revisar(await esperar(() => lista.getByText(/^Cambiado desde la app el /).isVisible()), '«Cambiado desde la app el …»');
  const vigilia = lista.locator('.sem-item', { hasText: '07:00' });
  revisar(await esperar(() => vigilia.getByText('Este tipo ya no está en la parroquia. Cámbialo.').isVisible()), 'el aviso del tipo');
  revisar(await vigilia.getByText('● Tipo no disponible').isVisible(), '«● Tipo no disponible»');
  igual((await camposSinEtiqueta(pagina)).length, 0, 'la sección: campos con etiqueta');
} catch (e) {
  revisar(false, `excepción: ${e instanceof Error ? e.message : e}`);
} finally {
  await limpiar();
  await navegador.close();
}
terminar('semana');
