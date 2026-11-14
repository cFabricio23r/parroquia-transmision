'use server';
// Envoltorios finos: la lógica está en lib/sesion.ts y lib/perfiles.ts (se prueba con clientes inyectados).
// Los argumentos de una Server Action llegan del cliente sin garantía de tipo: se coaccionan aquí.
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { enviarCorreo } from '../../lib/correo';
import { guardarNombre } from '../../lib/perfiles';
import {
  cambiarClave as cambiarClaveLogica,
  cambiarClaveConActual,
  entrar as entrarLogica,
  pedirRecuperacionDiferida,
  resolverSitioUrl,
} from '../../lib/sesion';
import { clienteServicio } from '../../lib/supabase/servicio';
import { clienteServidor } from '../../lib/supabase/servidor';

export async function entrar(correo: string, clave: string): Promise<{ error?: 'incorrectos' | 'muchos-intentos' }> {
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

export async function guardarMiNombre(nombre: string): Promise<{ error?: string }> {
  const r = await guardarNombre(await clienteServidor(), String(nombre ?? ''));
  if (!r.error) revalidatePath('/editor', 'layout'); // el encabezado muestra el nombre
  return r;
}

export async function cambiarMiClave(
  actual: string,
  nueva: string,
  repetida: string,
): Promise<{ error?: string; campo?: 'actual' | 'nueva'; codigo?: 'muchos-intentos' }> {
  return cambiarClaveConActual(
    {
      sesion: await clienteServidor(),
      // Cliente aparte, sin cookies ni persistencia: solo comprueba la clave actual (Decisión 11).
      verificador: () =>
        createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
    },
    String(actual ?? ''),
    String(nueva ?? ''),
    String(repetida ?? ''),
  );
}
