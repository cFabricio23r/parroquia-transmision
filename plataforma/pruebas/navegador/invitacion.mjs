// Pruebas de navegador de A2 · Invitación (plan 2, tarea 14), contra `next dev` + Supabase local.
// El token se genera como lib/tokens.ts (nuevoToken/hashDe): 32 bytes en base64url y su sha256 en hex.
import { createHash, randomBytes } from 'node:crypto';
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

async function crearParroquia() {
  const slug = `inv-${sufijo()}`;
  const { data, error } = await servicio.from('parroquias').insert({ slug, nombre: `Parroquia ${slug}` }).select('id, slug, nombre').single();
  if (error) throw error;
  parroquias.push(data.id);
  return data;
}

async function crearInvitacion(correo, parroquiaId, cambios = {}) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  const fila = {
    correo,
    rol: 'coordinador',
    parroquia_id: parroquiaId,
    token_hash: hash,
    vence_en: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    ...cambios,
  };
  const { error } = await servicio.from('invitaciones').insert(fila);
  if (error) throw error;
  return token;
}

async function crearUsuario(correo) {
  const { data, error } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error;
  usuarios.push(data.user.id);
  return data.user.id;
}

const fondo = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
const enMain = (p) => p.locator('main');

const navegador = await chromium.launch();
try {
  const p = await crearParroquia();

  // ---------------- paso «crear» ----------------
  console.log('A2 · paso crear');
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pagina = await contexto.newPage();
  const erroresJs = [];
  pagina.on('pageerror', (e) => erroresJs.push(e.message));
  const correo = `invitada-${sufijo()}@prueba.test`;
  // Vence el 15 a las 03:00 UTC: en El Salvador todavía es el 14 de noviembre.
  const token = await crearInvitacion(correo, p.id, { vence_en: '2099-11-15T03:00:00Z' });
  await pagina.goto(`${BASE}/editor/invitacion?token=${token}`);
  igual(await pagina.title(), 'Te invitaron a coordinar · Parroquia en Vivo', 'título de la pestaña');
  revisar(await enMain(pagina).getByText('Invitación', { exact: true }).isVisible(), 'chip «Invitación»');
  igual(await pagina.locator('h1').textContent(), 'Te invitaron a coordinar', 'h1 de A2');
  igual(
    await pagina.locator('p.pv-texto-acceso').textContent(),
    `La Pastoral de Comunicaciones te invitó a coordinar la parroquia ${p.nombre}.`,
    'texto con el nombre real de la parroquia',
  );
  igual(await pagina.locator('.pv-pie-acceso').textContent(), 'La invitación vence el 14 de noviembre.', 'pie con la fecha de vencimiento');
  const campoCorreo = pagina.getByLabel('Correo');
  igual(await campoCorreo.inputValue(), correo, 'el correo de la invitación');
  revisar(await campoCorreo.evaluate((e) => e.readOnly), 'de solo lectura');
  igual(await fondo(campoCorreo), 'rgb(238, 242, 247)', 'con el fondo de solo lectura');
  igual(Math.round((await pagina.locator('.pv-tarjeta-acceso').boundingBox()).width), 480, 'tarjeta de 480 px');
  revisar(await pagina.getByText('Así te ven en el registro de cambios.').isVisible(), 'ayuda de «Tu nombre»');

  await pagina.getByLabel('Crea una contraseña', { exact: true }).fill(CLAVE);
  await pagina.getByLabel('Repite la contraseña', { exact: true }).fill(CLAVE);
  await pagina.getByRole('button', { name: 'Crear cuenta y entrar' }).click();
  const nombre = pagina.getByLabel('Tu nombre');
  await pagina.getByText('Escribe tu nombre.').waitFor();
  igual(await nombre.getAttribute('aria-invalid'), 'true', 'sin nombre: el campo queda inválido');
  revisar((await nombre.getAttribute('aria-describedby')).includes('nombre-error'), 'y el error está atado al campo');

  await nombre.fill('María José 🙏');
  await pagina.getByRole('button', { name: 'Crear cuenta y entrar' }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith('/editor/invitacion'), { timeout: 20_000 });
  revisar(new URL(pagina.url()).pathname.startsWith('/editor'), 'crea la cuenta y entra');
  const { data: id } = await servicio.rpc('usuario_id_por_correo', { p_correo: correo });
  if (id) usuarios.push(id);
  const { data: perfil } = await servicio.from('perfiles').select('nombre').eq('usuario_id', id).maybeSingle();
  igual(perfil?.nombre, 'María José 🙏', 'perfiles guarda el nombre con tildes y emoji');
  await contexto.close();

  // ---------------- vencida y usada ----------------
  console.log('A2 · vencida y usada');
  const c2 = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await c2.newPage();
  const vencida = await crearInvitacion(`vencida-${sufijo()}@prueba.test`, p.id, { vence_en: new Date(Date.now() - 60_000).toISOString() });
  await p2.goto(`${BASE}/editor/invitacion?token=${vencida}`);
  revisar((await enMain(p2).getByRole('alert').textContent()).includes('Invitación vencida'), 'vencida: «Invitación vencida»');
  const usada = await crearInvitacion(`usada-${sufijo()}@prueba.test`, p.id, {
    usada_en: new Date().toISOString(),
    vence_en: new Date(Date.now() - 60_000).toISOString(),
  });
  await p2.goto(`${BASE}/editor/invitacion?token=${usada}`);
  revisar((await enMain(p2).getByRole('alert').textContent()).includes('Invitación que ya no sirve'), 'usada y vencida: «Invitación que ya no sirve»');
  revisar((await enMain(p2).getByRole('link', { name: 'Ir a entrar' }).getAttribute('href')) === '/editor/entrar', 'usada: «Ir a entrar» lleva a entrar');

  // ---------------- cuenta existente sin sesión ----------------
  console.log('A2 · cuenta existente');
  const existente = `existente-${sufijo()}@prueba.test`;
  await crearUsuario(existente);
  const tExistente = await crearInvitacion(existente, p.id);
  await p2.goto(`${BASE}/editor/invitacion?token=${tExistente}`);
  revisar((await enMain(p2).getByRole('alert').textContent()).includes(`Ya tienes una cuenta con ${existente}`), 'sin sesión: «Ya tienes una cuenta…»');
  revisar(await p2.getByRole('link', { name: 'Entrar con mi cuenta' }).isVisible(), 'con «Entrar con mi cuenta»');
  igual(await p2.locator('input[type="password"]').count(), 0, 'sin campos de contraseña');

  // ---------------- con la sesión de otra cuenta ----------------
  const otra = `otra-${sufijo()}@prueba.test`;
  await crearUsuario(otra);
  await p2.goto(`${BASE}/editor/entrar`);
  await p2.getByLabel('Correo').fill(otra);
  await p2.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await p2.getByRole('button', { name: 'Entrar', exact: true }).click();
  await p2.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'));
  await p2.goto(`${BASE}/editor/invitacion?token=${tExistente}`);
  revisar((await enMain(p2).getByRole('alert').textContent()).includes(`Esta invitación es para ${existente}`), 'otra sesión: «Esta invitación es para…»');
  revisar(await p2.getByRole('link', { name: 'Ir a entrar' }).isVisible(), 'con «Ir a entrar»');
  await c2.close();

  igual(erroresJs.length, 0, `sin errores de JavaScript (${erroresJs.join(' | ')})`);
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  for (const id of parroquias) {
    await servicio.from('invitaciones').delete().eq('parroquia_id', id);
    await servicio.from('miembros').delete().eq('parroquia_id', id);
    await servicio.from('registro').delete().eq('parroquia_id', id);
    await servicio.from('parroquias').delete().eq('id', id);
  }
  for (const id of usuarios) await servicio.auth.admin.deleteUser(id);
  await navegador.close();
}
console.log(fallos ? `\n${fallos} fallas` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
