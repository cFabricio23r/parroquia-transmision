// Pruebas de navegador de Horarios y redes (plan 3, Tarea 15; F10) y de Avisos fijos (Tarea 16; F11).
// Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import {
  BASE,
  camposSinEtiqueta,
  CONFIG_BASE,
  entrar,
  esperarEnBase,
  igual,
  leerBorrador,
  leerConfig,
  limpiar,
  prepararParroquia,
  revisar,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

const HORARIOS = [
  { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }, { hora: '9:00 a. m.' }, { hora: '6:00 p. m.' }], lugar: 'Templo parroquial' },
  { dia: 'Sábado', hora: '5:00 p. m.', lugar: 'Capilla de ejemplo (la atiende la parroquia)' },
  { dia: 'Jueves', horas: [{ hora: '6:00 p. m.', nota: 'Hora Santa' }], lugar: 'Templo parroquial' },
  { dia: 'Lunes a viernes', horas: [{ hora: '6:30 a. m.' }], lugar: 'Templo parroquial' },
];
const filaDe = (p, dia) => p.getByRole('row').filter({ has: p.getByRole('cell', { name: dia, exact: true }) });

const navegador = await chromium.launch();
try {
  console.log('F10 · Tabla de horarios');
  const P = await prepararParroquia({ config: { ...CONFIG_BASE, horarios: HORARIOS } });
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pagina, P.correo);
  const antes = await leerBorrador(P.id);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/horarios-y-redes`);
  const domingo = await filaDe(pagina, 'Domingo').innerText();
  revisar(domingo.includes('7:00 a. m. · 9:00 a. m. · 6:00 p. m.') && domingo.includes('Templo parroquial'), 'la fila del domingo se lee como en el artboard');
  revisar((await filaDe(pagina, 'Sábado').innerText()).includes('5:00 p. m.'), 'la fila vieja del sábado se lee bien');
  await pagina.waitForTimeout(1500);
  igual((await leerBorrador(P.id)).actualizado_en, antes.actualizado_en, 'abrir la página no cambia la base (Review Focus 4)');
  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo tiene etiqueta');

  console.log('F10 · Agregar');
  await pagina.getByRole('button', { name: '+ Agregar horario' }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Agregar horario' });
  await dialogo.getByRole('button', { name: 'Guardar horario' }).click();
  revisar(await dialogo.getByText('Escribe el día.').isVisible(), 'vacío: «Escribe el día.»');
  await dialogo.getByLabel('Día', { exact: true }).fill('Martes');
  await dialogo.getByLabel('Hora', { exact: true }).fill('6:00 a. m.');
  await dialogo.getByRole('button', { name: '+ Agregar otra hora' }).click();
  await dialogo.getByLabel('Hora 2', { exact: true }).fill('7:00 p. m.');
  await dialogo.getByRole('button', { name: 'Guardar horario' }).click();
  await dialogo.waitFor({ state: 'hidden' });
  revisar(await filaDe(pagina, 'Martes').isVisible(), 'la fila del martes aparece');
  const conMartes = await esperarEnBase(P.id, (c) => c.horarios.length === 5, 3000);
  igual(JSON.stringify(conMartes.horarios[4]), JSON.stringify({ dia: 'Martes', horas: [{ hora: '6:00 a. m.' }, { hora: '7:00 p. m.' }] }), 'la base tiene el martes');

  console.log('F10 · Editar');
  await pagina.getByRole('button', { name: 'Editar Sábado' }).click();
  const editar = pagina.getByRole('dialog', { name: 'Editar horario' });
  await editar.getByLabel('Hora', { exact: true }).fill('5:30 p. m.');
  await editar.getByRole('button', { name: 'Guardar horario' }).click();
  const editado = await esperarEnBase(P.id, (c) => c.horarios[1]?.horas?.[0]?.hora === '5:30 p. m.', 3000);
  revisar(editado.horarios.every((h) => Array.isArray(h.horas) && !('hora' in h)), 'todos los horarios quedan en la forma nueva');

  console.log('F10 · Borrar');
  await pagina.getByRole('button', { name: 'Editar Martes' }).click();
  await editar.getByRole('button', { name: 'Borrar horario' }).click();
  await esperarEnBase(P.id, (c) => c.horarios.length === 4, 3000);
  igual(await filaDe(pagina, 'Martes').count(), 0, '«Borrar horario» quita la fila');

  console.log('F10 · Redes');
  await pagina.getByLabel('Facebook', { exact: true }).fill('facebook.com/parroquiasanjose');
  await pagina.getByLabel('WhatsApp', { exact: true }).fill('7000-0000');
  await pagina.getByLabel('Sitio web', { exact: true }).fill('parroquia');
  revisar(await pagina.getByText('Escribe la dirección completa, por ejemplo parroquia.org.').isVisible(), '«parroquia» en «Sitio web» muestra el error');
  const conRedes = await esperarEnBase(P.id, (c) => (c.redes ?? []).length === 2);
  igual(
    JSON.stringify(conRedes.redes.find((r) => r.red === 'facebook')),
    JSON.stringify({ red: 'facebook', url: 'https://facebook.com/parroquiasanjose', texto: 'facebook.com/parroquiasanjose' }),
    'la base tiene Facebook',
  );
  igual(conRedes.redes.find((r) => r.red === 'whatsapp')?.url, 'https://wa.me/50370000000', 'y WhatsApp como wa.me/503…');
  revisar(!conRedes.redes.some((r) => r.red === 'web'), 'y no tiene web');
  igual(JSON.stringify((await leerConfig(P.id)).horarios.length), '4', 'los horarios siguen ahí');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('datos-avisos');
