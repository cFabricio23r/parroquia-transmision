// Ayudas para las pruebas de integración contra el Supabase LOCAL.
// Las variables las entrega `supabase status -o env` (ver herramientas/integracion.mjs).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const clavePublica = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const claveSecreta = process.env.SUPABASE_SECRET_KEY ?? '';

// Freno de seguridad: jamás correr contra la nube.
function comprobarLocal(): void {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // url vacío o inválido: se aborta abajo
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('las pruebas de integración solo corren contra el Supabase local');
  }
  if (!clavePublica || !claveSecreta) {
    throw new Error('faltan SUPABASE_PUBLISHABLE_KEY o SUPABASE_SECRET_KEY (corre «npm run test:integracion»)');
  }
}
comprobarLocal();

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

/** Sufijo aleatorio para slugs y correos únicos por corrida. */
export function sufijo(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Cliente con la llave secreta (service_role): salta RLS. */
export function clienteServicio(): SupabaseClient {
  return createClient(url, claveSecreta, opciones);
}

/** Cliente anónimo (llave publicable, sin sesión). */
export function clienteAnonimo(): SupabaseClient {
  return createClient(url, clavePublica, opciones);
}

export interface UsuarioPrueba {
  id: string;
  correo: string;
  cliente: SupabaseClient;
}

/** Crea un usuario confirmado y devuelve un cliente con su sesión iniciada. */
export async function crearUsuario(correo: string, clave: string): Promise<UsuarioPrueba> {
  const servicio = clienteServicio();
  const { data, error } = await servicio.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`no se pudo crear el usuario: ${error?.message}`);
  const cliente = clienteAnonimo();
  const { error: errorSesion } = await cliente.auth.signInWithPassword({ email: correo, password: clave });
  if (errorSesion) throw new Error(`no se pudo iniciar sesión: ${errorSesion.message}`);
  return { id: data.user.id, correo, cliente };
}

/** Crea una parroquia con slug único (`<slug>-<sufijo>`) y su borrador inicial. */
export async function crearParroquia(slug: string): Promise<{ id: string; slug: string }> {
  const servicio = clienteServicio();
  const slugFinal = `${slug}-${sufijo()}`;
  const { data, error } = await servicio
    .from('parroquias')
    .insert({ slug: slugFinal, nombre: `Parroquia ${slugFinal}` })
    .select('id, slug')
    .single();
  if (error || !data) throw new Error(`no se pudo crear la parroquia: ${error?.message}`);
  const { error: errorBorrador } = await servicio
    .from('borradores')
    .insert({ parroquia_id: data.id, config: { titulo: 'inicial', color: '#123456' } });
  if (errorBorrador) throw new Error(`no se pudo crear el borrador: ${errorBorrador.message}`);
  return data;
}

/** Hace miembro (coordinador) a un usuario de una parroquia. */
export async function hacerMiembro(parroquiaId: string, usuarioId: string): Promise<void> {
  const { error } = await clienteServicio().from('miembros').insert({ parroquia_id: parroquiaId, usuario_id: usuarioId });
  if (error) throw new Error(`no se pudo crear el miembro: ${error.message}`);
}

/** Hace administrador a un usuario. */
export async function hacerAdmin(usuarioId: string): Promise<void> {
  const { error } = await clienteServicio().from('administradores').insert({ usuario_id: usuarioId });
  if (error) throw new Error(`no se pudo crear el administrador: ${error.message}`);
}
