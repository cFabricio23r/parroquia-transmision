// Pruebas de navegador de C2 · Mi cuenta y C1 · Elegir parroquia (plan 2, tareas 15 y 16),
// contra `next dev` + Supabase local. Slugs y correos con sufijo aleatorio.
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL;
const servicio = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sufijo = () => Math.random().toString(36).slice(2, 10);
const CLAVE = 'clave-de-prueba-123';

let fallos = 0;
const revisar = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FALLA ') + msg);
  if (!cond) fallos++;
};
const igual = (real, esperado, msg) =>
  revisar(real === esperado, msg + (real === esperado ? '' : ` (era ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`));

const usuarios = [];
const parroquias = [];

async function crearUsuario(prefijo) {
  const correo = `${prefijo}-${sufijo()}@prueba.test`;
  const { data, error } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error;
  usuarios.push(data.user.id);
  return { id: data.user.id, correo };
}
async function crearParroquia(nombre) {
  const slug = `cta-${sufijo()}`;
  const { data, error } = await servicio.from('parroquias').insert({ slug, nombre: `${nombre} ${slug}` }).select('id, slug, nombre').single();
  if (error) throw error;
  parroquias.push(data.id);
  return data;
}
async function hacerMiembro(parroquiaId, usuarioId) {
  const { error } = await servicio.from('miembros').insert({ parroquia_id: parroquiaId, usuario_id: usuarioId });
  if (error) throw error;
}
async function entrar(pagina, correo, clave = CLAVE) {
  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.getByLabel('Correo').fill(correo);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(clave);
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  // 60 s: la base local compartida junta cientos de parroquias de pruebas viejas y C1 de un admin tarda.
  await pagina.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'), { timeout: 60_000 });
}
const estilo = (loc, prop) => loc.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const nuevaPagina = async () => (await navegador.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const navegador = await chromium.launch();
try {
  const A = await crearParroquia('Inmaculada');
  const B = await crearParroquia('San José');
  const { error: errorVersion } = await servicio.from('versiones').insert({ parroquia_id: A.id, numero: 3, config: { nombre: A.nombre } });
  if (errorVersion) throw errorVersion;

  // ---------------- C2 · Mi cuenta ----------------
  console.log('C2 · Mi cuenta');
  const c = await crearUsuario('cuenta');
  await hacerMiembro(A.id, c.id);
  const p = await nuevaPagina();
  await entrar(p, c.correo);
  await p.goto(`${BASE}/editor/cuenta`);
  igual(await p.title(), 'Mi cuenta · Parroquia en Vivo', 'título de la pestaña');
  const usuario = p.locator('header a.pv-usuario');
  igual(await usuario.getAttribute('href'), '/editor/cuenta', 'el encabezado enlaza a Mi cuenta');
  igual((await usuario.locator('.pv-usuario-etiqueta').textContent()), `${c.correo} · Coordinador`, 'sin nombre: «<correo> · Coordinador»');
  igual(await usuario.locator('.pv-avatar').textContent(), c.correo[0].toUpperCase(), 'avatar con la inicial del correo');
  const chipRol = p.locator('.pv-cuenta-chips .pv-chip').first();
  igual(await chipRol.textContent(), 'Coordinador', 'chip «Coordinador»');
  igual(await estilo(chipRol, 'background-color'), 'rgb(230, 241, 251)', 'chip del rol en azul claro');
  igual(await p.locator('.pv-cuenta-chips .pv-chip').nth(1).textContent(), A.nombre, 'un chip por parroquia');
  for (const s of await p.locator('main section').all()) {
    igual(await estilo(s, 'border-radius'), '14px', 'sección con radio 14');
    igual(await estilo(s, 'padding-top'), '26px', 'sección con relleno 26');
  }

  await p.getByLabel('Nombre').fill('   ');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await p.getByText('Escribe tu nombre.').waitFor();
  revisar(true, 'solo espacios: «Escribe tu nombre.»');
  await p.getByLabel('Nombre').fill('Fabricio Ramírez');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await p.getByRole('status').filter({ hasText: 'Guardado.' }).waitFor();
  revisar(true, 'guardar el nombre muestra «Guardado.»');
  // Ronda 2: el botón no se deshabilita mientras espera, así el foco no se cae al <body>.
  igual(await p.evaluate(() => document.activeElement?.textContent?.trim()), 'Guardar', 'después de «Guardado.» el foco sigue en Guardar');
  await p.reload();
  igual(await usuario.locator('.pv-usuario-etiqueta').textContent(), 'Fabricio · Coordinador', 'al recargar: «Fabricio · Coordinador»');
  igual(await usuario.locator('.pv-avatar').textContent(), 'F', 'avatar «F»');

  await p.getByLabel('Contraseña actual', { exact: true }).fill('clave-equivocada-1');
  await p.getByLabel('Contraseña nueva', { exact: true }).fill('clave-nueva-456');
  await p.getByLabel('Repite la contraseña nueva', { exact: true }).fill('clave-nueva-456');
  await p.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await p.getByText('La contraseña actual no es correcta.').waitFor();
  igual(await p.getByLabel('Contraseña actual', { exact: true }).getAttribute('aria-invalid'), 'true', 'actual mala: el error en ese campo');
  await p.getByLabel('Contraseña actual', { exact: true }).fill(CLAVE);
  await p.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await p.getByRole('status').filter({ hasText: 'Listo: tu contraseña cambió.' }).waitFor();
  igual(await p.evaluate(() => document.activeElement?.textContent?.trim()), 'Cambiar contraseña', 'después de «Listo» el foco sigue en el botón');
  igual(await p.getByLabel('Contraseña actual', { exact: true }).inputValue(), '', 'los campos se vacían');
  const otra = await nuevaPagina();
  await entrar(otra, c.correo, 'clave-nueva-456');
  revisar(!new URL(otra.url()).pathname.startsWith('/editor/entrar'), 'la clave nueva sirve para entrar en otro contexto');
  await otra.context().close();

  await p.getByRole('button', { name: 'Cerrar sesión' }).click();
  await p.waitForURL(`${BASE}/editor/entrar`);
  await p.goto(`${BASE}/editor/cuenta`);
  igual(new URL(p.url()).pathname, '/editor/entrar', 'sin sesión, Mi cuenta manda a entrar');
  await p.context().close();

  // ---------------- C1 · Elegir parroquia ----------------
  console.log('C1 · Elegir parroquia');
  const dos = await crearUsuario('dos');
  await hacerMiembro(A.id, dos.id);
  await hacerMiembro(B.id, dos.id);
  const q = await nuevaPagina();
  await entrar(q, dos.correo);
  igual(new URL(q.url()).pathname, '/editor', 'con dos parroquias se queda en /editor');
  // Se llega por la redirección de la acción de entrar (navegación del cliente): la URL cambia antes de que
  // React ponga el <title> nuevo, y justo en ese instante document.title está vacío. Se espera a que haya
  // título (máximo 10 s) y recién ahí se compara el texto exacto.
  await q.waitForFunction(() => document.title !== '', null, { timeout: 10_000 }).catch(() => {});
  igual(await q.title(), '¿Qué vas a editar? · Parroquia en Vivo', 'título de la pestaña');
  igual(await estilo(q.locator('h1'), 'font-size'), '26px', 'h1 de 26 px');
  igual((await q.locator('.pv-elegir-texto').textContent())?.trim(), 'Ves solo las parroquias que te asignaron.', 'un coordinador lee «Ves solo las parroquias que te asignaron.»');
  const filaA = q.locator('li', { hasText: A.nombre });
  const filaB = q.locator('li', { hasText: B.nombre });
  const chipA = filaA.locator('.pv-chip');
  const chipB = filaB.locator('.pv-chip');
  igual(await chipA.textContent(), 'Publicada · v3', 'A: «Publicada · v3»');
  igual(await estilo(chipA, 'background-color'), 'rgb(226, 246, 236)', 'chip verde');
  igual(await chipB.textContent(), 'Borrador', 'B: «Borrador»');
  igual(await estilo(chipB, 'background-color'), 'rgb(255, 244, 214)', 'chip ámbar');
  revisar(await filaA.getByText(`Parroquia · ${A.slug}`).isVisible(), '«Parroquia · <slug>»');
  await q.getByRole('link', { name: `Editar ${A.nombre}` }).click();
  await q.waitForURL(`${BASE}/editor/p/${A.slug}`);
  revisar(true, '«Editar» lleva al editor de la parroquia');
  await q.context().close();

  const una = await crearUsuario('una');
  await hacerMiembro(B.id, una.id);
  const r = await nuevaPagina();
  await entrar(r, una.correo);
  await r.waitForURL(`${BASE}/editor/p/${B.slug}`);
  revisar(true, 'con una sola parroquia entra directo');
  await r.context().close();

  const ninguna = await crearUsuario('ninguna');
  const s = await nuevaPagina();
  await entrar(s, ninguna.correo);
  const alerta = s.locator('main').getByRole('alert');
  await alerta.waitFor();
  revisar((await alerta.textContent()).includes('Sin parroquia asignada'), 'sin parroquias: «Sin parroquia asignada»');
  igual(await s.locator('h1').count(), 1, 'sin parroquias: un solo h1');
  igual((await s.locator('h1').first().textContent())?.trim(), 'Sin parroquia asignada', 'sin parroquias: el h1 es el título del mensaje');
  await s.getByRole('button', { name: 'Cerrar sesión' }).click();
  await s.waitForURL(`${BASE}/editor/entrar`);
  revisar(true, '«Cerrar sesión» lo saca');
  await s.context().close();

  const admin = await crearUsuario('admin');
  await servicio.from('administradores').insert({ usuario_id: admin.id });
  const t = await nuevaPagina();
  await entrar(t, admin.correo);
  igual(await t.locator('main').getByRole('alert').count(), 0, 'un admin sin membresías no ve «Sin parroquia asignada»');
  revisar(await t.getByRole('link', { name: 'Administrar parroquias' }).isVisible(), 'y tiene «Administrar parroquias»');
  igual(
    (await t.locator('.pv-elegir-texto').textContent())?.trim(),
    'Como administrador, ves todas las parroquias.',
    'un admin lee que ve todas las parroquias (no «las que te asignaron»)',
  );
  await t.context().close();
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  for (const id of parroquias) {
    await servicio.from('miembros').delete().eq('parroquia_id', id);
    await servicio.from('parroquias').delete().eq('id', id);
  }
  for (const id of usuarios) {
    await servicio.from('administradores').delete().eq('usuario_id', id);
    await servicio.auth.admin.deleteUser(id);
  }
  await navegador.close();
}
console.log(fallos ? `\n${fallos} fallas` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
