// Ayudas compartidas de las pruebas de navegador del editor (plan 3). No es una prueba: el runner
// (herramientas/navegador.mjs) solo corre los .mjs de primer nivel de pruebas/navegador/.
// Contra el Supabase LOCAL: slugs y correos con sufijo aleatorio, y `limpiar()` borra lo creado.
import { createClient } from '@supabase/supabase-js';

export const BASE = process.env.BASE_URL;
export const servicio = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const sufijo = () => Math.random().toString(36).slice(2, 10);
export const CLAVE = 'clave-de-prueba-123';
export const VIEWPORT = { width: 1440, height: 900 };

let fallos = 0;
export const revisar = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FALLA ') + msg);
  if (!cond) fallos++;
};
export const igual = (real, esperado, msg) =>
  revisar(real === esperado, msg + (real === esperado ? '' : ` (era ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`));
export const fallar = () => fallos++;
export const terminar = (nombre) => {
  console.log(fallos === 0 ? `\nPruebas de navegador de ${nombre}: todo bien.` : `\n${fallos} comprobaciones fallaron.`);
  // Sin esto, una prueba que termina con fallas saldría con código 0 (un falso verde para el runner).
  if (fallos) process.exitCode = 1;
  return fallos === 0 ? 0 : 1;
};

const creadas = { parroquias: [], usuarios: [] };

/** Un borrador mínimo pero publicable en lo básico; cada prueba lo completa con lo suyo. */
export const CONFIG_BASE = {
  nombre: 'Parroquia San José',
  lugar: 'Lugar de ejemplo, La Libertad',
  colores: { principal: '#8a1c2b', oscuro: '#4b0f18', acento: '#d9a441' },
  patrono: { nombre: 'San José, esposo de la Virgen María', corto: 'San José' },
  fiesta: { dia: 19, mes: 3, lema: 'José, hombre justo y fiel' },
};

/**
 * Crea una parroquia `nav-<sufijo>` con su borrador, una coordinadora miembro con perfil «María López»
 * y, si se pide, versiones publicadas (`[{ numero, config }]`). Devuelve `{ id, slug, correo, usuarioId }`.
 */
export async function prepararParroquia({ config = CONFIG_BASE, versiones = [], nombre = 'María López' } = {}) {
  const slug = `nav-${sufijo()}`;
  const { data: p, error } = await servicio.from('parroquias').insert({ slug, nombre: `Parroquia ${slug}` }).select('id').single();
  if (error) throw error;
  creadas.parroquias.push({ id: p.id, slug });
  const { error: eb } = await servicio.from('borradores').insert({ parroquia_id: p.id, config });
  if (eb) throw eb;
  for (const v of versiones) {
    const { error: ev } = await servicio.from('versiones').insert({ parroquia_id: p.id, numero: v.numero, config: v.config });
    if (ev) throw ev;
  }
  const correo = `nav-${sufijo()}@prueba.test`;
  const { data: u, error: eu } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (eu) throw eu;
  creadas.usuarios.push(u.user.id);
  const { error: em } = await servicio.from('miembros').insert({ parroquia_id: p.id, usuario_id: u.user.id });
  if (em) throw em;
  if (nombre) {
    const { error: ep } = await servicio.from('perfiles').upsert({ usuario_id: u.user.id, nombre });
    if (ep) throw ep;
  }
  return { id: p.id, slug, correo, usuarioId: u.user.id };
}

export async function entrar(pagina, correo) {
  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.getByLabel('Correo').fill(correo);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'), { timeout: 15_000 });
}

export const leerConfig = async (id) => (await servicio.from('borradores').select('config').eq('parroquia_id', id).single()).data.config;
export const leerBorrador = async (id) =>
  (await servicio.from('borradores').select('config, actualizado_en').eq('parroquia_id', id).single()).data;

/** Espera a que el encabezado diga «Guardado» (el estado del guardado automático). */
export async function esperarGuardado(pagina, timeout = 10_000) {
  await pagina.waitForFunction(() => document.querySelector('[role="status"].pv-guardado')?.textContent === 'Guardado', null, { timeout });
}

/** Espera hasta que `cond(config)` sea verdadero en la base (o se acabe el tiempo). */
export async function esperarEnBase(id, cond, timeout = 8000) {
  const limite = Date.now() + timeout;
  for (;;) {
    const c = await leerConfig(id);
    if (cond(c)) return c;
    if (Date.now() > limite) return c;
    await new Promise((ok) => setTimeout(ok, 250));
  }
}

async function borrarCarpeta(bucket, carpeta) {
  const rutas = [];
  const recorrer = async (c) => {
    const { data } = await servicio.storage.from(bucket).list(c, { limit: 1000 });
    for (const e of data ?? []) {
      if (e.id === null) await recorrer(`${c}/${e.name}`);
      else rutas.push(`${c}/${e.name}`);
    }
  };
  await recorrer(carpeta);
  if (rutas.length) await servicio.storage.from(bucket).remove(rutas);
}

/** Borra las parroquias, sus archivos y los usuarios que crearon estas ayudas. */
export async function limpiar() {
  for (const p of creadas.parroquias) {
    await borrarCarpeta('borradores', p.id);
    await borrarCarpeta('publicado', p.slug);
    await servicio.from('parroquias').delete().eq('id', p.id);
  }
  for (const id of creadas.usuarios) await servicio.auth.admin.deleteUser(id);
  creadas.parroquias.length = 0;
  creadas.usuarios.length = 0;
}

/** Ids de los campos sin etiqueta (label o aria-label/aria-labelledby). */
export const camposSinEtiqueta = (pagina) =>
  pagina.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((e) => e.type !== 'hidden' && !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
      .map((e) => e.id || e.name || e.outerHTML.slice(0, 60)),
  );
