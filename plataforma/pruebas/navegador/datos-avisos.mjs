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

  console.log('F11 · Lista');
  const AVISOS = [
    { texto: 'Colecta para el techo', detalle: 'Gracias por tu aporte; la meta es terminar en marzo.', orden: 2 },
    { texto: 'Retiro de jóvenes', detalle: '14 de febrero, todo el día.', desde: '2099-02-01', hasta: '2099-02-14', activo: false, orden: 3 },
    { texto: 'Inscripciones de catequesis', detalle: 'Sábados de 8:00 a 11:00 a. m., en el salón parroquial.', hasta: '2099-01-30', orden: 1 },
  ];
  const A = await prepararParroquia({ config: { ...CONFIG_BASE, avisos: AVISOS } });
  const pa = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  await entrar(pa, A.correo);
  const antesA = await leerBorrador(A.id);
  await pa.goto(`${BASE}/editor/p/${A.slug}/avisos`);
  const titulos = () => pa.locator('.pv-aviso-titulo').allInnerTexts();
  igual(JSON.stringify(await titulos()), JSON.stringify(['Inscripciones de catequesis', 'Colecta para el techo', 'Retiro de jóvenes']), 'la lista sale en el orden de `orden`');
  igual(await pa.getByRole('switch', { name: 'Mostrar Retiro de jóvenes' }).getAttribute('aria-checked'), 'false', 'el retiro está apagado');
  await pa.waitForTimeout(1500);
  igual((await leerBorrador(A.id)).actualizado_en, antesA.actualizado_en, 'abrir la página no cambia la base');
  igual((await camposSinEtiqueta(pa)).length, 0, 'todo campo tiene etiqueta');

  console.log('F11 · Vista previa');
  const previa = pa.frameLocator('iframe.pv-previa-marco');
  await previa.getByText('Colecta para el techo').first().waitFor({ timeout: 8000 });
  revisar(true, 'la vista previa muestra un aviso activo');

  console.log('F11 · Interruptor');
  await pa.getByRole('switch', { name: 'Mostrar Retiro de jóvenes' }).click();
  const encendido = await esperarEnBase(A.id, (c) => c.avisos.every((x) => !('activo' in x)));
  revisar(!('activo' in encendido.avisos.find((x) => x.texto === 'Retiro de jóvenes')), 'encendido, el aviso ya no tiene `activo`');
  await pa.getByRole('switch', { name: 'Mostrar Colecta para el techo' }).click();
  await pa.waitForFunction(() => !document.querySelector('iframe.pv-previa-marco')?.contentDocument?.body?.innerText.includes('Colecta para el techo'), null, { timeout: 5000 });
  revisar(true, 'al apagarlo deja de verse en la vista previa');
  await pa.getByRole('switch', { name: 'Mostrar Colecta para el techo' }).click();

  console.log('F11 · Teclado y arrastre');
  await pa.getByRole('button', { name: 'Mover Colecta para el techo' }).focus();
  await pa.keyboard.press('Enter');
  await pa.getByRole('menuitem', { name: 'Subir' }).click();
  igual((await titulos())[0], 'Colecta para el techo', '«Subir» la pone primera');
  const subida = await esperarEnBase(A.id, (c) => c.avisos[0]?.texto === 'Colecta para el techo');
  igual(JSON.stringify(subida.avisos.map((x) => x.orden)), '[1,2,3]', 'la base queda con orden 1, 2, 3');
  await pa.getByRole('button', { name: 'Mover Retiro de jóvenes' }).dragTo(pa.locator('.pv-aviso-fila').first());
  igual((await titulos())[0], 'Retiro de jóvenes', 'arrastrar el último sobre el primero también reordena');
  await pa.getByRole('button', { name: 'Mover Colecta para el techo' }).click();
  await pa.keyboard.press('Escape');
  igual(await pa.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Mover Colecta para el techo', 'Esc cierra el menú y el foco vuelve al tirador');

  console.log('F11 · Editar');
  await pa.getByRole('button', { name: 'Editar Inscripciones de catequesis' }).click();
  igual(await pa.getByLabel('Título', { exact: true }).inputValue(), 'Inscripciones de catequesis', 'el formulario carga el aviso');
  await pa.getByLabel('Hasta', { exact: true }).fill('2099-01-31');
  await pa.getByRole('button', { name: 'Guardar aviso' }).click();
  const editadoA = await esperarEnBase(A.id, (c) => c.avisos.some((x) => x.hasta === '2099-01-31'), 3000);
  revisar(editadoA.avisos.some((x) => x.hasta === '2099-01-31'), '«Guardar aviso» guarda la fecha nueva');
  await pa.getByLabel('Desde', { exact: true }).fill('2099-02-10');
  await pa.getByRole('button', { name: 'Guardar aviso' }).click();
  revisar(await pa.getByText('La fecha «Desde» no puede ser después de «Hasta».').isVisible(), '«Desde» después de «Hasta» muestra el error');
  await pa.waitForTimeout(1200);
  revisar(!(await leerConfig(A.id)).avisos.some((x) => x.desde === '2099-02-10'), 'y no guarda');

  console.log('F11 · Nuevo');
  await pa.getByRole('button', { name: '+ Nuevo aviso' }).click();
  igual(await pa.locator('#pv-avisos-form-titulo').innerText(), 'Nuevo aviso', 'el formulario dice «Nuevo aviso»');
  await pa.getByRole('button', { name: 'Guardar aviso' }).click();
  revisar(await pa.getByText('Escribe el título.').isVisible(), 'sin título: «Escribe el título.»');
  await pa.getByLabel('Título', { exact: true }).fill('Bautizos');
  await pa.getByRole('button', { name: 'Guardar aviso' }).click();
  igual((await titulos()).at(-1), 'Bautizos', 'el aviso nuevo aparece al final');
  const conNuevo = await esperarEnBase(A.id, (c) => c.avisos.length === 4, 3000);
  revisar(!('activo' in conNuevo.avisos[3]), 'sin `activo` escrito');

  console.log('F11 · Borrar');
  await pa.getByRole('button', { name: 'Mover Bautizos' }).click();
  await pa.getByRole('menuitem', { name: 'Borrar aviso' }).click();
  igual(await pa.getByRole('button', { name: 'Editar Bautizos' }).count(), 0, '«Borrar aviso» lo quita');
  await esperarEnBase(A.id, (c) => c.avisos.length === 3);
} finally {
  await navegador.close();
  await limpiar();
}
terminar('datos-avisos');
