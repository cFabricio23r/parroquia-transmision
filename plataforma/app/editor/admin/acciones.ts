'use server';
// Envoltorios finos: la lógica está en lib/admin.ts (se prueba con clientes inyectados).
// Los argumentos de una Server Action llegan del cliente sin garantía de tipo: se coaccionan aquí.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import slugsDelRepo from '../../../lib/generado/slugs-del-repo.json';
import {
  aceptarInvitacion as aceptarLogica,
  crearParroquia as crearLogica,
  invitar as invitarLogica,
  quitarAcceso as quitarLogica,
  type DepsAdmin,
} from '../../../lib/admin';
import { enviarCorreo } from '../../../lib/correo';
import { resolverSitioUrl } from '../../../lib/sesion';
import { clienteServicio } from '../../../lib/supabase/servicio';
import { clienteServidor } from '../../../lib/supabase/servidor';

async function deps(): Promise<DepsAdmin> {
  return {
    servicio: clienteServicio(),
    sesion: await clienteServidor(),
    enviar: enviarCorreo,
    sitioUrl: resolverSitioUrl(process.env),
    slugsDelRepo,
  };
}

export async function crearParroquia(slug: string, nombre: string): Promise<{ error?: string }> {
  const r = await crearLogica(await deps(), String(slug ?? ''), String(nombre ?? ''));
  if (r.error || !r.slug) return { error: r.error };
  revalidatePath('/editor/admin');
  redirect(`/editor/admin/parroquia/${r.slug}`);
}

export async function invitar(correo: string, parroquiaId: string): Promise<{ error?: string }> {
  const r = await invitarLogica(await deps(), String(correo ?? ''), String(parroquiaId ?? ''));
  if (!r.error) revalidatePath('/editor/admin/parroquia/[slug]', 'page');
  return r;
}

export async function quitarAcceso(parroquiaId: string, usuarioId: string): Promise<{ error?: string }> {
  const r = await quitarLogica(await deps(), String(parroquiaId ?? ''), String(usuarioId ?? ''));
  if (!r.error) revalidatePath('/editor/admin/parroquia/[slug]', 'page');
  return r;
}

export async function aceptarInvitacion(token: string, clave: string, repetida: string): Promise<{ error?: string }> {
  const r = await aceptarLogica(await deps(), String(token ?? ''), { clave: String(clave ?? ''), repetida: String(repetida ?? '') });
  if (r.error) return r;
  redirect('/editor');
}
