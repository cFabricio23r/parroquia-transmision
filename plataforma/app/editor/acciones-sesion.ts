'use server';
// Envoltorios finos: la lógica está en lib/sesion.ts (se prueba con clientes inyectados).
// Los argumentos de una Server Action llegan del cliente sin garantía de tipo: se coaccionan aquí.
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { enviarCorreo } from '../../lib/correo';
import {
  cambiarClave as cambiarClaveLogica,
  entrar as entrarLogica,
  pedirRecuperacionDiferida,
  resolverSitioUrl,
} from '../../lib/sesion';
import { clienteServicio } from '../../lib/supabase/servicio';
import { clienteServidor } from '../../lib/supabase/servidor';

export async function entrar(correo: string, clave: string): Promise<{ error?: string }> {
  const r = await entrarLogica(await clienteServidor(), String(correo ?? ''), String(clave ?? ''));
  if (r.error) return r;
  redirect('/editor');
}

export async function salir(): Promise<void> {
  await (await clienteServidor()).auth.signOut();
  redirect('/editor/entrar');
}

export async function pedirRecuperacion(correo: string): Promise<{ mensaje: string }> {
  // Todo el trabajo va en after(): la respuesta no depende de si el correo existe.
  return pedirRecuperacionDiferida(
    { servicio: clienteServicio(), enviar: enviarCorreo, sitioUrl: resolverSitioUrl(process.env) },
    String(correo ?? ''),
    after,
  );
}

export async function cambiarClave(clave: string, repetida: string): Promise<{ error?: string }> {
  const r = await cambiarClaveLogica(await clienteServidor(), String(clave ?? ''), String(repetida ?? ''));
  if (r.error) return r;
  redirect('/editor');
}
