// Pruebas de navegador de la administración (plan 5: marco, D1, D2 y D3), contra `next dev` + Supabase
// local. Slugs y correos con sufijo aleatorio; todo lo creado se borra al final.
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { BASE, CLAVE, VIEWPORT, camposSinEtiqueta, entrar, igual, revisar, servicio, sufijo, terminar } from './lib/editor.mjs';

const creadas = { parroquias: [], usuarios: [], correos: [] };
const estilo = (loc, prop) => loc.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

async function crearUsuario(prefijo, nombre) {
  const correo = `${prefijo}-${sufijo()}@prueba.test`;
  const { data, error } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error;
  creadas.usuarios.push(data.user.id);
  if (nombre) {
    const { error: ep } = await servicio.from('perfiles').upsert({ usuario_id: data.user.id, nombre });
    if (ep) throw ep;
  }
  return { id: data.user.id, correo };
}
async function crearParroquia(nombre, config) {
  const slug = `adm-${sufijo()}`;
  const nombreFinal = `${nombre} ${slug}`;
  const { data, error } = await servicio.from('parroquias').insert({ slug, nombre: nombreFinal }).select('id, slug, nombre').single();
  if (error) throw error;
  creadas.parroquias.push(data.id);
  const { error: eb } = await servicio.from('borradores').insert({ parroquia_id: data.id, config: config ?? { nombre: nombreFinal, lugar: 'Lugar de prueba' } });
  if (eb) throw eb;
  return data;
}
async function hacerMiembro(parroquiaId, usuarioId) {
  const { error } = await servicio.from('miembros').insert({ parroquia_id: parroquiaId, usuario_id: usuarioId });
  if (error) throw error;
}
async function limpiar() {
  for (const id of creadas.parroquias) await servicio.from('parroquias').delete().eq('id', id);
  for (const correo of creadas.correos) await servicio.from('invitaciones').delete().eq('correo', correo);
  for (const id of creadas.usuarios) await servicio.auth.admin.deleteUser(id);
}

const navegador = await chromium.launch();
const nuevaPagina = async () => {
  const contexto = await navegador.newContext({ viewport: VIEWPORT });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => revisar(false, `error de JavaScript: ${e.message}`));
  return pagina;
};

try {
  const admin = await crearUsuario('adm-admin', 'María Admin');
  const { error: ea } = await servicio.from('administradores').insert({ usuario_id: admin.id });
  if (ea) throw ea;
  const p = await nuevaPagina();
  await entrar(p, admin.correo);

  // ---------------- Marco ----------------
  console.log('Marco del admin');
  await p.goto(`${BASE}/editor/admin`);
  revisar((await p.locator('header').textContent()).includes('Pastoral de Comunicaciones · Ciudad Arce'), 'encabezado con el subtítulo');
  const nav = p.locator('nav[aria-label="Secciones"]');
  igual(await nav.locator('a').allTextContents().then((t) => t.join('|')), 'Parroquias|Coordinadores|Registro', 'las tres pestañas');
  const actual = nav.locator('a[aria-current="page"]');
  igual(await actual.textContent(), 'Parroquias', 'Parroquias es la actual');
  igual(await estilo(actual, 'border-bottom-width'), '3px', 'la actual con borde inferior de 3px');
  igual(await estilo(actual, 'border-bottom-color'), 'rgb(17, 85, 164)', 'la actual en azul');
  igual(await estilo(p.locator('main'), 'padding'), '26px 40px', 'main con relleno 26 40');
  igual((await camposSinEtiqueta(p)).length, 0, 'D1 sin campos sin etiqueta');
  await p.goto(`${BASE}/editor/admin/coordinadores`);
  igual(await p.locator('nav[aria-label="Secciones"] a[aria-current="page"]').textContent(), 'Coordinadores', 'en D2 la actual es Coordinadores');
  igual((await camposSinEtiqueta(p)).length, 0, 'D2 sin campos sin etiqueta');
  await p.goto(`${BASE}/editor/admin/registro`);
  igual(await p.locator('nav[aria-label="Secciones"] a[aria-current="page"]').textContent(), 'Registro', 'en D3 la actual es Registro');
  igual((await camposSinEtiqueta(p)).length, 0, 'D3 sin campos sin etiqueta');

  const vieja = await crearParroquia('Vieja');
  await p.goto(`${BASE}/editor/admin/parroquia/${vieja.slug}`);
  await p.waitForURL((u) => u.pathname === '/editor/admin/coordinadores', { timeout: 15_000 });
  igual(new URL(p.url()).search, `?parroquia=${vieja.slug}`, 'la ruta vieja redirige a Coordinadores filtrado');

  const coord = await crearUsuario('adm-coord', 'Coord Prueba');
  await hacerMiembro(vieja.id, coord.id);
  const pc = await nuevaPagina();
  await entrar(pc, coord.correo);
  await pc.goto(`${BASE}/editor/admin`);
  revisar((await pc.locator('main').getByRole('alert').textContent()).includes('Solo un administrador puede hacer esto'), 'un coordinador ve el aviso de solo admin');
  revisar(await pc.getByRole('link', { name: 'Volver' }).isVisible(), 'y el botón Volver');
  igual(await pc.locator('nav[aria-label="Secciones"]').count(), 0, 'sin pestañas para el coordinador');
  await pc.context().close();

  const anonima = await nuevaPagina();
  await anonima.goto(`${BASE}/editor/admin`);
  await anonima.waitForURL((u) => u.pathname === '/editor/entrar', { timeout: 15_000 });
  revisar(true, 'sin sesión va a entrar');
  await anonima.context().close();

  // ---------------- D1 · Parroquias ----------------
  console.log('D1 · Parroquias');
  const pub = await crearParroquia('Publicada', { nombre: 'Publicada', lugar: 'Lugar del borrador', colores: {} });
  {
    const { error } = await servicio.from('versiones').insert({ parroquia_id: pub.id, numero: 1, config: { nombre: pub.nombre, lugar: 'Lugar uno' } });
    if (error) throw error;
  }
  const sinConf = await crearParroquia('Sin configurar');
  const correoInv = `adm-inv-${sufijo()}@prueba.test`;
  creadas.correos.push(correoInv);
  {
    const { error } = await servicio.from('invitaciones').insert({
      correo: correoInv,
      rol: 'coordinador',
      parroquia_id: sinConf.id,
      token_hash: `prueba-${sufijo()}`,
      vence_en: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (error) throw error;
  }
  const deAna = await crearParroquia('De Ana', { nombre: 'De Ana', lugar: 'Lugar de Ana', colores: {} });
  const ana = await crearUsuario('adm-ana', 'Ana Pérez');
  await hacerMiembro(deAna.id, ana.id);

  await p.goto(`${BASE}/editor/admin`);
  igual(await p.locator('main h1').textContent(), 'Parroquias de la vicaría', 'h1 de D1');
  revisar(await p.getByRole('button', { name: '+ Nueva parroquia' }).isVisible(), 'botón «+ Nueva parroquia»');
  const cabecera = p.locator('[role="table"] [role="columnheader"]');
  igual((await cabecera.allInnerTexts()).slice(0, 4).join('|'), 'PARROQUIA|LINK|ESTADO|COORDINADORES', 'cabecera de la tabla');
  const fila = (pq) => p.locator('[role="row"]', { hasText: pq.slug });
  const chipPub = fila(pub).locator('.pv-chip');
  igual(await chipPub.textContent(), 'Publicada · v1', 'chip de la publicada');
  igual(await estilo(chipPub, 'background-color'), 'rgb(226, 246, 236)', 'chip verde');
  const lugarPub = fila(pub).locator('.pv-admin-sub');
  igual(await lugarPub.textContent(), 'Lugar uno', 'el lugar sale de la versión publicada');
  igual(await estilo(lugarPub, 'font-size'), '12px', 'lugar en 12 px');
  revisar((await estilo(fila(pub).locator('.pv-admin-slug'), 'font-family')).includes('monospace'), 'slug en monoespaciada');
  igual(await fila(sinConf).locator('.pv-chip').textContent(), 'Sin configurar', 'chip «Sin configurar»');
  revisar((await fila(sinConf).textContent()).includes('invitación enviada'), 'columna «invitación enviada»');
  igual(await fila(deAna).locator('.pv-chip').textContent(), 'Borrador', 'chip «Borrador»');
  revisar((await fila(deAna).textContent()).includes('Ana Pérez'), 'coordinadora en la columna');
  igual(
    await p.locator('main .pv-info').textContent(),
    '«Ver» abre el editor de esa parroquia, para que el admin pueda ayudar a configurarla. Desactivar no borra nada: el link deja de funcionar y sus coordinadores pierden el acceso. Se puede reactivar.',
    'caja de información de D1',
  );
  igual(await p.getByRole('link', { name: `Ver ${pub.nombre}` }).getAttribute('href'), `/editor/p/${pub.slug}`, '«Ver» lleva al editor');

  // Nueva parroquia
  const botonNueva = p.getByRole('button', { name: '+ Nueva parroquia' });
  await botonNueva.click();
  const dlgNueva = p.getByRole('dialog', { name: 'Nueva parroquia' });
  revisar(await dlgNueva.isVisible(), 'abre el diálogo «Nueva parroquia»');
  const suf = sufijo();
  await dlgNueva.getByLabel('Nombre de la parroquia').fill(`Parroquia Santa Lucía ${suf}`);
  igual(await dlgNueva.getByLabel('Link').inputValue(), `santa-lucia-${suf}`, 'el link se sugiere del nombre');
  revisar(
    (await dlgNueva.textContent()).includes(`Va en la dirección: …/santa-lucia-${suf}/pantalla.html. No se puede cambiar después.`),
    'la ayuda del link muestra la dirección',
  );
  await dlgNueva.getByRole('button', { name: 'Crear parroquia' }).click();
  await p.waitForTimeout(800);
  revisar((await dlgNueva.locator('#nueva-lugar-error').count()) === 1, 'sin lugar: error en el campo Lugar');
  await dlgNueva.getByLabel('Lugar').fill('Chalchuapa, Santa Ana');
  await dlgNueva.getByRole('button', { name: 'Crear parroquia' }).click();
  await p.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 15_000 });
  const filaNueva = p.locator('[role="row"]', { hasText: `santa-lucia-${suf}` });
  await filaNueva.waitFor({ timeout: 15_000 });
  igual(await filaNueva.locator('.pv-chip').textContent(), 'Sin configurar', 'la nueva aparece «Sin configurar»');
  revisar(
    (await p.getByRole('status').filter({ hasText: 'Creaste' }).textContent()).includes(
      `Creaste Parroquia Santa Lucía ${suf}. Ahora puedes invitar a quien la va a configurar.`,
    ),
    'anuncia «Creaste …»',
  );
  igual(
    await p.getByRole('status').filter({ hasText: 'Creaste' }).getByRole('link', { name: 'Invitar coordinador' }).getAttribute('href'),
    `/editor/admin/coordinadores?parroquia=santa-lucia-${suf}`,
    'con el enlace «Invitar coordinador»',
  );
  igual(await p.evaluate(() => document.activeElement?.textContent), '+ Nueva parroquia', 'el foco vuelve al botón que abrió el diálogo');
  {
    const { data } = await servicio.from('parroquias').select('id').eq('slug', `santa-lucia-${suf}`).single();
    if (data) creadas.parroquias.push(data.id);
  }

  // Desactivar
  const botonDes = p.getByRole('button', { name: `Desactivar ${deAna.nombre}` });
  await botonDes.click();
  const dlgDes = p.getByRole('dialog', { name: 'Desactivar parroquia' });
  igual(
    await dlgDes.locator('p').first().textContent(),
    `¿Desactivar «${deAna.nombre}»? Desactivar no borra nada: el link deja de funcionar y sus coordinadores pierden el acceso. Se puede reactivar.`,
    'texto del diálogo «Desactivar parroquia»',
  );
  await dlgDes.getByRole('button', { name: 'Cancelar' }).click();
  igual(await fila(deAna).locator('.pv-chip').textContent(), 'Borrador', 'Cancelar no cambia nada');
  igual(await p.evaluate(() => document.activeElement?.getAttribute('aria-label')), `Desactivar ${deAna.nombre}`, 'el foco vuelve a «Desactivar»');
  await botonDes.click();
  await dlgDes.getByRole('button', { name: 'Sí, desactivar' }).click();
  const chipEs = (slug, texto) =>
    p.waitForFunction(
      ([s, t]) => [...document.querySelectorAll('[role="row"]')].find((r) => r.textContent.includes(s))?.querySelector('.pv-chip')?.textContent === t,
      [slug, texto],
      { timeout: 15_000 },
    );
  await chipEs(deAna.slug, 'Desactivada');
  revisar(true, 'chip «Desactivada»');
  igual((await fila(deAna).getByRole('button').allTextContents()).join('|'), 'Reactivar', 'solo el botón «Reactivar»');
  igual(await estilo(fila(deAna).locator('b').first(), 'color'), 'rgb(74, 85, 104)', 'nombre en gris');

  const pa = await nuevaPagina();
  await pa.goto(`${BASE}/editor/entrar`);
  await pa.getByLabel('Correo').fill(ana.correo);
  await pa.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await pa.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pa.waitForURL((u) => !u.pathname.startsWith('/editor/entrar'), { timeout: 15_000 });
  revisar((await pa.locator('main').textContent()).includes('Sin parroquia asignada'), 'Ana en /editor: «Sin parroquia asignada»');
  await pa.goto(`${BASE}/editor/p/${deAna.slug}`);
  revisar((await pa.locator('main').textContent()).includes('No encontramos esa parroquia'), 'Ana en su editor: no encontrada');

  await p.goto(`${BASE}/editor`);
  const filaC1 = p.locator('li', { hasText: deAna.nombre });
  igual(await filaC1.locator('.pv-chip').textContent(), 'Desactivada', 'C1 del admin: chip «Desactivada»');

  await p.goto(`${BASE}/editor/admin`);
  await p.getByRole('button', { name: `Reactivar ${deAna.nombre}` }).click();
  const anuncio = p.getByRole('status').filter({ hasText: 'activa otra vez' });
  await anuncio.waitFor({ timeout: 15_000 });
  igual(await anuncio.textContent(), `${deAna.nombre} está activa otra vez. Vuelve a salir en OBS después del próximo despliegue.`, 'anuncia la reactivación');
  await chipEs(deAna.slug, 'Borrador');
  revisar(true, 'vuelve a «Borrador»');
  await pa.goto(`${BASE}/editor/p/${deAna.slug}`);
  revisar(!(await pa.locator('body').textContent()).includes('No encontramos esa parroquia'), 'Ana vuelve a entrar al editor');
  await pa.context().close();
  igual((await camposSinEtiqueta(p)).length, 0, 'D1 sin campos sin etiqueta al final');

  // ---------------- D2 · Coordinadores ----------------
  console.log('D2 · Coordinadores');
  const A = await crearParroquia('Alfa');
  const B = await crearParroquia('Beta');
  const anaD2 = await crearUsuario('adm-ana2', 'Ana Pérez');
  await hacerMiembro(A.id, anaD2.id);
  {
    const anonimo = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { error } = await anonimo.auth.signInWithPassword({ email: anaD2.correo, password: CLAVE }); // ya entró una vez
    if (error) throw error;
  }
  const vigente = `adm-vig-${sufijo()}@prueba.test`;
  const vencida = `adm-ven-${sufijo()}@prueba.test`;
  creadas.correos.push(vigente, vencida);
  for (const [correo, parroquia, dias] of [
    [vigente, A, 5],
    [vencida, B, -1],
  ]) {
    const { error } = await servicio.from('invitaciones').insert({
      correo,
      rol: 'coordinador',
      parroquia_id: parroquia.id,
      token_hash: `prueba-${sufijo()}`,
      vence_en: new Date(Date.now() + dias * 86_400_000).toISOString(),
    });
    if (error) throw error;
  }

  await p.goto(`${BASE}/editor/admin/coordinadores`);
  igual(await p.locator('main h1').textContent(), 'Coordinadores', 'h1 de D2');
  revisar(await p.getByRole('button', { name: '+ Invitar coordinador' }).isVisible(), 'botón «+ Invitar coordinador»');
  igual(
    (await p.locator('[role="table"] [role="columnheader"]').allInnerTexts()).slice(0, 4).join('|'),
    'PERSONA|ASIGNADO A|ESTADO|ÚLTIMA ENTRADA',
    'cabecera de D2',
  );
  const filaDe = (texto, extra) => p.locator('[role="row"]', { hasText: texto }).filter(extra ? { hasText: extra } : {});
  const filaAna = filaDe(anaD2.correo, A.nombre);
  igual(await filaAna.locator('b').first().textContent(), 'Ana Pérez', 'Ana en negrita');
  igual(await estilo(filaAna.locator('.pv-admin-sub'), 'font-size'), '12px', 'su correo en 12 px');
  igual(await filaAna.locator('.pv-chip').textContent(), 'Activo', 'chip «Activo»');
  revisar((await filaAna.textContent()).includes('hoy'), 'última entrada «hoy»');
  igual((await filaAna.getByRole('button').allTextContents()).join('|'), 'Asignar|Quitar', 'botones Asignar y Quitar');
  const filaVig = filaDe(vigente);
  igual(await filaVig.locator('b').first().textContent(), vigente, 'la invitación con el correo en negrita');
  igual(await filaVig.locator('.pv-chip').textContent(), 'Invitación enviada', 'chip «Invitación enviada»');
  igual(await estilo(filaVig.locator('.pv-chip'), 'background-color'), 'rgb(230, 241, 251)', 'chip azul');
  revisar((await filaVig.locator('[role="cell"]').nth(3).textContent()) === '—', 'sin última entrada: «—»');
  igual((await filaVig.getByRole('button').allTextContents()).join('|'), 'Reenviar|Quitar', 'botones Reenviar y Quitar');
  const filaVen = filaDe(vencida);
  igual(await filaVen.locator('.pv-chip').textContent(), 'Invitación vencida', 'chip «Invitación vencida»');
  igual(await estilo(filaVen.locator('.pv-chip'), 'background-color'), 'rgb(255, 244, 214)', 'chip ámbar');

  // Invitar
  await p.getByRole('button', { name: '+ Invitar coordinador' }).click();
  const dlgInv = p.getByRole('dialog', { name: 'Invitar coordinador' });
  igual(await estilo(dlgInv, 'width'), '500px', 'diálogo de 500 px');
  igual(await estilo(dlgInv.locator('h2'), 'font-size'), '20px', 'h2 de 20 px');
  revisar(await dlgInv.getByLabel('Correo').isVisible(), 'campo Correo');
  revisar(await dlgInv.getByLabel('Asignar a').isVisible(), 'campo Asignar a');
  const textoDlg = await dlgInv.textContent();
  revisar(textoDlg.includes('Una parroquia puede tener varios coordinadores; todos editan, publican y transmiten.'), 'ayuda de Asignar a');
  revisar(
    textoDlg.includes('Le llega un correo para crear su contraseña. La invitación dura 7 días; si vence, se reenvía desde la lista.'),
    'caja de la invitación',
  );
  revisar(await dlgInv.getByRole('button', { name: 'Cancelar' }).isVisible(), 'botón Cancelar');
  const nuevo = `nuevo-${sufijo()}@prueba.test`;
  creadas.correos.push(nuevo);
  await dlgInv.getByLabel('Correo').fill(nuevo);
  await dlgInv.getByLabel('Asignar a').selectOption({ label: B.nombre });
  await dlgInv.getByRole('button', { name: 'Enviar invitación' }).click();
  await p.getByRole('status').filter({ hasText: `Le enviamos la invitación a ${nuevo}.` }).waitFor({ timeout: 15_000 });
  revisar(true, 'anuncia la invitación');
  await filaDe(nuevo).waitFor({ timeout: 15_000 });
  igual(await filaDe(nuevo).locator('.pv-chip').textContent(), 'Invitación enviada', 'aparece la fila de la invitación nueva');

  // Asignar
  await p.getByRole('button', { name: 'Asignar a Ana Pérez' }).first().click();
  const dlgAsig = p.getByRole('dialog', { name: 'Asignar a otra parroquia' });
  const opciones = await dlgAsig.getByLabel('Parroquia').locator('option').allTextContents();
  revisar(opciones.includes(B.nombre) && !opciones.includes(A.nombre), 'el select trae B y no A');
  await dlgAsig.getByLabel('Parroquia').selectOption({ label: B.nombre });
  await dlgAsig.getByRole('button', { name: 'Asignar', exact: true }).click();
  await filaDe(anaD2.correo, B.nombre).waitFor({ timeout: 15_000 });
  igual(await p.locator('[role="row"]', { hasText: anaD2.correo }).count(), 2, 'Ana tiene dos filas');

  // Quitar
  await p.getByRole('button', { name: `Quitar a Ana Pérez de ${B.nombre}` }).click();
  const dlgQuitar = p.getByRole('dialog', { name: 'Quitar acceso' });
  igual(
    await dlgQuitar.locator('p').first().textContent(),
    `¿Quitar a Ana Pérez de ${B.nombre}? Deja de poder editar y publicar esa parroquia.`,
    'texto de «Quitar acceso»',
  );
  await dlgQuitar.getByRole('button', { name: 'Sí, quitar' }).click();
  await p.waitForFunction((c) => [...document.querySelectorAll('[role="row"]')].filter((r) => r.textContent.includes(c)).length === 1, anaD2.correo, {
    timeout: 15_000,
  });
  revisar(true, 'queda una fila de Ana');

  // Reenviar la vencida
  await p.getByRole('button', { name: `Reenviar la invitación de ${vencida}` }).click();
  await p.getByRole('status').filter({ hasText: `Le enviamos una invitación nueva a ${vencida}.` }).waitFor({ timeout: 15_000 });
  revisar(true, 'anuncia el reenvío');
  await p.waitForFunction(
    (c) => [...document.querySelectorAll('[role="row"]')].find((r) => r.textContent.includes(c))?.querySelector('.pv-chip')?.textContent === 'Invitación enviada',
    vencida,
    { timeout: 15_000 },
  );
  revisar(true, 'la vencida pasa a «Invitación enviada»');

  // Anular
  await p.getByRole('button', { name: `Quitar la invitación de ${vigente}` }).click();
  const dlgAnular = p.getByRole('dialog', { name: 'Anular invitación' });
  igual(
    await dlgAnular.locator('p').first().textContent(),
    `¿Anular la invitación de ${vigente} a ${A.nombre}? El enlace deja de servir.`,
    'texto de «Anular invitación»',
  );
  await dlgAnular.getByRole('button', { name: 'Sí, anular' }).click();
  await p.waitForFunction((c) => ![...document.querySelectorAll('[role="row"]')].some((r) => r.textContent.includes(c)), vigente, { timeout: 15_000 });
  revisar(true, 'la invitación anulada desaparece');

  // Filtro
  await p.goto(`${BASE}/editor/admin/coordinadores?parroquia=${A.slug}`);
  const celdasParroquia = await p.locator('[role="row"]:not(.pv-tabla-cabecera) [role="cell"]:nth-child(2)').allTextContents();
  revisar(celdasParroquia.length > 0 && celdasParroquia.every((t) => t === A.nombre), 'con filtro, solo filas de A');
  igual(await p.locator('.pv-admin-filtro').textContent(), `Solo ${A.nombre}. Ver todas`, 'la línea «Solo …» con «Ver todas»');
  igual(await p.getByRole('link', { name: 'Ver todas' }).getAttribute('href'), '/editor/admin/coordinadores', '«Ver todas» quita el filtro');
  await p.getByRole('button', { name: '+ Invitar coordinador' }).click();
  igual(
    await p.getByRole('dialog', { name: 'Invitar coordinador' }).getByLabel('Asignar a').evaluate((s) => s.options[s.selectedIndex].text),
    A.nombre,
    'el diálogo trae A elegida',
  );
  await p.getByRole('dialog', { name: 'Invitar coordinador' }).getByRole('button', { name: 'Cancelar' }).click();
  igual((await camposSinEtiqueta(p)).length, 0, 'D2 sin campos sin etiqueta');

  // ---------------- D3 · Registro ----------------
  console.log('D3 · Registro');
  await p.goto(`${BASE}/editor/admin/registro`);
  igual(await p.locator('main h1').textContent(), 'Registro de cambios', 'h1 de D3');
  const lugar = p.getByLabel('Lugar');
  revisar(await lugar.isVisible(), 'control «Lugar»');
  igual(await lugar.evaluate((s) => s.options[s.selectedIndex].text), 'Todos', '«Lugar» empieza en «Todos»');
  igual(
    (await p.locator('[role="table"] [role="columnheader"]').allInnerTexts()).join('|'),
    'CUÁNDO|QUIÉN|QUÉ HIZO|TIPO',
    'cabecera de D3',
  );
  const filaReg = (texto) => p.locator('[role="row"]', { hasText: texto }).first();
  const filaDes = filaReg(`Desactivó ${deAna.nombre}`);
  igual(await filaDes.locator('.pv-chip').textContent(), 'Parroquia', '«Desactivó …» con el chip «Parroquia»');
  const filaInv = filaReg(`Invitó a ${nuevo} a ${B.nombre}`);
  igual(await filaInv.locator('.pv-chip').textContent(), 'Acceso', '«Invitó a …» con el chip «Acceso»');
  igual(await estilo(filaInv.locator('.pv-chip'), 'background-color'), 'rgb(230, 241, 251)', '«Invitó» en azul');
  const filaQui = filaReg(`Quitó el acceso de Ana Pérez a ${B.nombre}`);
  igual(await filaQui.locator('.pv-chip').textContent(), 'Acceso', '«Quitó el acceso…» con el chip «Acceso»');
  igual(await estilo(filaQui.locator('.pv-chip'), 'background-color'), 'rgb(255, 244, 214)', '«Quitó» en ámbar');
  const primeraCelda = filaInv.locator('[role="cell"]').first();
  revisar((await primeraCelda.textContent()).startsWith('Hoy '), 'el cuándo empieza con «Hoy »');
  igual(await estilo(primeraCelda, 'color'), 'rgb(86, 101, 122)', 'el cuándo en gris');
  revisar((await filaInv.locator('[role="cell"]').nth(1).textContent()).endsWith('(admin)'), 'el quién termina en «(admin)»');
  revisar(!(await p.locator('main').textContent()).includes('guardar_borrador'), 'ninguna fila dice «guardar_borrador»');
  igual(await estilo(filaInv, 'padding'), '14px 18px', 'relleno de fila 14 18');
  igual(
    await p.locator('.pv-admin-nota').last().textContent(),
    'Solo quién hizo qué y cuándo. No guarda contraseñas ni datos de las transmisiones.',
    'la nota de D3',
  );
  await lugar.selectOption({ label: A.nombre });
  await p.waitForURL((u) => u.searchParams.get('parroquia') === A.id, { timeout: 15_000 });
  revisar(true, '«Lugar» lleva a ?parroquia=<id de A>');
  await p.locator('[role="row"]:not(.pv-tabla-cabecera)').first().waitFor({ timeout: 15_000 });
  const frasesA = await p.locator('[role="row"]:not(.pv-tabla-cabecera) [role="cell"]:nth-child(3)').allTextContents();
  revisar(frasesA.length > 0 && frasesA.every((t) => t.includes(A.nombre)), 'con «Lugar», solo filas de A');
  igual(await p.getByLabel('Lugar').evaluate((s) => s.options[s.selectedIndex].text), A.nombre, '«Lugar» muestra A');
  igual((await camposSinEtiqueta(p)).length, 0, 'D3 sin campos sin etiqueta');
} catch (e) {
  revisar(false, `error inesperado: ${e instanceof Error ? e.stack : e}`);
} finally {
  await navegador.close();
  await limpiar();
}
process.exit(terminar('la administración'));
