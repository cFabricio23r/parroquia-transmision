'use server';
// Envoltorios finos: la lógica está en lib/sesion.ts (se prueba con clientes inyectados).
import { redirect } from 'next/navigation';
import { enviarCorreo } from '../../lib/correo';
import { cambiarClave as cambiarClaveLogica, entrar as entrarLogica, pedirRecuperacion as pedirLogica } from '../../lib/sesion';
import { clienteServicio } from '../../lib/supabase/servicio';
import { clienteServidor } from '../../lib/supabase/servidor';

export async function entrar(correo: string, clave: string): Promise<{ error?: string }> {
  const r = await entrarLogica(await clienteServidor(), correo, clave);
  if (r.error) return r;
  redirect('/editor');
}

export async function salir(): Promise<void> {
  await (await clienteServidor()).auth.signOut();
  redirect('/editor/entrar');
}

export async function pedirRecuperacion(correo: string): Promise<{ mensaje: string }> {
  return pedirLogica(
    { servicio: clienteServicio(), enviar: enviarCorreo, sitioUrl: process.env.SITIO_URL || 'http://localhost:3000' },
    correo,
  );
}

export async function cambiarClave(clave: string, repetida: string): Promise<{ error?: string }> {
  const r = await cambiarClaveLogica(await clienteServidor(), clave, repetida);
  if (r.error) return r;
  redirect('/editor');
}
