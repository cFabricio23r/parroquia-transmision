'use server';
// Envoltorios finos: la lógica está en lib/admin.ts, lib/admin-parroquias.ts y lib/admin-coordinadores.ts
// (se prueba con clientes inyectados). Los argumentos de una Server Action llegan del cliente sin
// garantía de tipo: se coaccionan aquí. Cada función de lib vuelve a comprobar que quien actúa es admin.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import slugsDelRepo from '../../../lib/generado/slugs-del-repo.json';
import {
  aceptarInvitacion as aceptarLogica,
  crearParroquia as crearLogica,
  invitar as invitarLogica,
  quitarAcceso as quitarLogica,
  type DepsAdmin,
  type Resultado,
} from '../../../lib/admin';
import { anularInvitacion, asignar, reenviarInvitacion } from '../../../lib/admin-coordinadores';
import { cambiarVisible, desactivarParroquia, reactivarParroquia } from '../../../lib/admin-parroquias';
import { enviarCorreo } from '../../../lib/correo';
import type { EstadoHook } from '../../../lib/despliegue';
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
    hookUrl: process.env.VERCEL_DEPLOY_HOOK_URL,
  };
}

const texto = (x: unknown) => String(x ?? '');
/** Todo lo que cambia algo refresca las tres pestañas (y C1, que muestra el chip «Desactivada»). */
function refrescar<T extends Resultado>(r: T): T {
  if (!r.error) {
    revalidatePath('/editor/admin', 'layout');
    revalidatePath('/editor');
  }
  return r;
}

export async function crearParroquia(nombre: string, slug: string, lugar: string): Promise<Resultado & { slug?: string }> {
  return refrescar(await crearLogica(await deps(), texto(slug), texto(nombre), texto(lugar)));
}

export async function desactivar(parroquiaId: string): Promise<Resultado & { hook?: EstadoHook }> {
  return refrescar(await desactivarParroquia(await deps(), texto(parroquiaId)));
}

export async function reactivar(parroquiaId: string): Promise<Resultado & { hook?: EstadoHook }> {
  return refrescar(await reactivarParroquia(await deps(), texto(parroquiaId)));
}

export async function cambiarVisibilidad(parroquiaId: string, visible: boolean): Promise<Resultado> {
  return refrescar(await cambiarVisible(await deps(), texto(parroquiaId), visible === true));
}

export async function invitar(correo: string, parroquiaId: string): Promise<Resultado> {
  return refrescar(await invitarLogica(await deps(), texto(correo), texto(parroquiaId)));
}

export async function reenviar(invitacionId: string): Promise<Resultado & { correo?: string }> {
  return refrescar(await reenviarInvitacion(await deps(), texto(invitacionId)));
}

export async function anular(invitacionId: string): Promise<Resultado> {
  return refrescar(await anularInvitacion(await deps(), texto(invitacionId)));
}

export async function asignarParroquia(usuarioId: string, parroquiaId: string): Promise<Resultado> {
  return refrescar(await asignar(await deps(), texto(usuarioId), texto(parroquiaId)));
}

export async function quitarAcceso(parroquiaId: string, usuarioId: string): Promise<Resultado> {
  return refrescar(await quitarLogica(await deps(), texto(parroquiaId), texto(usuarioId)));
}

export async function aceptarInvitacion(
  token: string,
  clave: string,
  repetida: string,
  nombre: string,
): Promise<Resultado & { aviso?: string }> {
  const r = await aceptarLogica(await deps(), texto(token), {
    clave: texto(clave),
    repetida: texto(repetida),
    nombre: texto(nombre),
  });
  if (r.error) return { error: r.error, campo: r.campo };
  if (r.aviso) return { aviso: r.aviso }; // la cuenta quedó creada pero no se pudo iniciar la sesión
  redirect('/editor');
}
