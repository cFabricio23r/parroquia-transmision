// Pruebas de navegador de la administración (plan 5: marco, D1, D2 y D3), contra `next dev` + Supabase
// local. Slugs y correos con sufijo aleatorio; todo lo creado se borra al final.
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
  revisar((await pc.getByRole('alert').textContent()).includes('Solo un administrador puede hacer esto'), 'un coordinador ve el aviso de solo admin');
  revisar(await pc.getByRole('link', { name: 'Volver' }).isVisible(), 'y el botón Volver');
  igual(await pc.locator('nav[aria-label="Secciones"]').count(), 0, 'sin pestañas para el coordinador');
  await pc.context().close();

  const anonima = await nuevaPagina();
  await anonima.goto(`${BASE}/editor/admin`);
  await anonima.waitForURL((u) => u.pathname === '/editor/entrar', { timeout: 15_000 });
  revisar(true, 'sin sesión va a entrar');
  await anonima.context().close();
} catch (e) {
  revisar(false, `error inesperado: ${e instanceof Error ? e.stack : e}`);
} finally {
  await navegador.close();
  await limpiar();
}
process.exit(terminar('la administración'));
