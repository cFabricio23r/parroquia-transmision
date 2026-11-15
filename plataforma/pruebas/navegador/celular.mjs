// Ancho de celular (375 y 390 px; revisión fix2 · acceso): el encabezado del editor entra sin cortar
// «Parroquia en Vivo» ni el subtítulo, el chip del borrador va en una línea y se ve el nombre; en la
// administración, la caja que recomienda la computadora y ninguna página se corre de lado.
import { chromium } from 'playwright';
import { BASE, CLAVE, entrar, igual, limpiar, prepararParroquia, revisar, servicio, sufijo, terminar, fallar } from './lib/editor.mjs';

const AVISO_ADMIN =
  'La administración está pensada para una computadora. Desde el celular puedes mirar, pero para trabajar usa una pantalla más grande.';

/** Medidas del encabezado: cada parte dentro de la pantalla, sin recortes y en cuántas líneas. */
const medirEncabezado = (p) =>
  p.evaluate(() => {
    const parte = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const linea = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return {
        visible: cs.display !== 'none' && r.width > 0 && r.height > 0,
        dentro: r.left >= -0.5 && r.right <= innerWidth + 0.5,
        recortado: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
        lineas: Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / linea),
        abajo: r.bottom,
      };
    };
    const enc = document.querySelector('header.pv-encabezado').getBoundingClientRect();
    return {
      encabezado: enc.bottom,
      titulo: parte('.pv-encabezado-titulo'),
      sub: parte('.pv-encabezado-sub'),
      chip: parte('.pv-chip-borrador'),
      nombre: parte('.pv-usuario-etiqueta'),
      avatar: parte('.pv-avatar'),
      anchoPagina: document.documentElement.scrollWidth,
      ancho: innerWidth,
    };
  });

const navegador = await chromium.launch();
try {
  const p = await prepararParroquia();
  for (const ancho of [375, 390]) {
    console.log(`Editor a ${ancho} px`);
    const pg = await (await navegador.newContext({ viewport: { width: ancho, height: 812 } })).newPage();
    await entrar(pg, p.correo);
    await pg.goto(`${BASE}/editor/p/${p.slug}`);
    await pg.locator('.pv-chip-borrador').waitFor();
    const m = await medirEncabezado(pg);
    revisar(m.titulo.visible && m.titulo.dentro && !m.titulo.recortado, '«Parroquia en Vivo» se ve entero');
    igual(m.titulo.lineas, 1, '«Parroquia en Vivo» en una línea');
    revisar(m.sub.visible && m.sub.dentro && !m.sub.recortado, 'el subtítulo se ve entero');
    revisar(m.chip.visible && m.chip.dentro, 'el chip del borrador se ve');
    igual(m.chip.lineas, 1, 'el chip del borrador en una línea');
    revisar(m.nombre.visible && m.nombre.dentro, 'se ve el nombre de quien edita');
    revisar(m.avatar.visible && m.avatar.dentro, 'y su avatar');
    for (const k of ['titulo', 'sub', 'chip', 'nombre', 'avatar'])
      revisar(m[k].abajo <= m.encabezado + 0.5, `${k} dentro de la franja azul`);
    igual(m.anchoPagina, m.ancho, 'la página no se corre de lado');
    await pg.context().close();
  }

  console.log('Administración a 375 px');
  const { data: u, error } = await servicio.auth.admin.createUser({ email: `celular-admin-${sufijo()}@prueba.test`, password: CLAVE, email_confirm: true });
  if (error) throw error;
  try {
    await servicio.from('administradores').insert({ usuario_id: u.user.id });
    const pa = await (await navegador.newContext({ viewport: { width: 375, height: 812 } })).newPage();
    await pa.goto(`${BASE}/editor/entrar`);
    await pa.getByLabel('Correo').fill(u.user.email);
    await pa.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
    await pa.getByRole('button', { name: 'Entrar', exact: true }).click();
    // 60 s: la base local compartida junta cientos de parroquias de pruebas viejas y C1 de un admin tarda.
    await pa.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'), { timeout: 60_000 });
    for (const [ruta, nombre] of [
      ['/editor/admin', 'Parroquias'],
      ['/editor/admin/coordinadores', 'Coordinadores'],
      ['/editor/admin/registro', 'Registro'],
    ]) {
      await pa.goto(`${BASE}${ruta}`, { timeout: 60_000 });
      await pa.locator('h1').first().waitFor();
      const aviso = pa.locator('.pv-info', { hasText: AVISO_ADMIN });
      revisar(await aviso.isVisible(), `${nombre}: la caja que recomienda la computadora`);
      igual(await pa.evaluate(() => document.documentElement.scrollWidth), 375, `${nombre}: la página no se corre de lado`);
      const m = await medirEncabezado(pa);
      revisar(m.titulo.visible && !m.titulo.recortado && m.titulo.lineas === 1, `${nombre}: «Parroquia en Vivo» entero y en una línea`);
      revisar(m.nombre.visible && m.nombre.dentro, `${nombre}: se ve el nombre de quien entra`);
    }
    // La tabla se desplaza dentro de su caja, no la página.
    await pa.goto(`${BASE}/editor/admin/coordinadores`, { timeout: 60_000 });
    const tabla = pa.locator('[role="table"]').first();
    await tabla.waitFor();
    revisar(await tabla.evaluate((e) => getComputedStyle(e).overflowX === 'auto' && e.clientWidth <= innerWidth), 'Coordinadores: la tabla se desplaza dentro de su caja');
    await pa.context().close();
    const pe = await (await navegador.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await pe.goto(`${BASE}/editor/entrar`);
    await pe.getByLabel('Correo').fill(u.user.email);
    await pe.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
    await pe.getByRole('button', { name: 'Entrar', exact: true }).click();
    await pe.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'), { timeout: 60_000 });
    await pe.goto(`${BASE}/editor/admin`, { timeout: 60_000 });
    await pe.locator('h1').first().waitFor();
    revisar(!(await pe.locator('.pv-info', { hasText: AVISO_ADMIN }).isVisible()), 'en la computadora la caja no aparece');
    igual(Math.round((await pe.locator('header.pv-encabezado').boundingBox()).height), 64, 'en la computadora el encabezado sigue en 64 px');
    await pe.context().close();
  } finally {
    await servicio.from('administradores').delete().eq('usuario_id', u.user.id);
    await servicio.auth.admin.deleteUser(u.user.id);
  }
} catch (e) {
  console.error(e);
  fallar();
} finally {
  await limpiar();
  await navegador.close();
}
process.exit(terminar('ancho de celular'));
