import { NextResponse } from 'next/server';
import { restaurar } from '../../../../../lib/publicar';
import { clienteServicio } from '../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/publicar.ts.
export async function POST(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let numero: unknown = null;
  try {
    numero = ((await peticion.json()) as { numero?: unknown } | null)?.numero;
  } catch {
    // cuerpo vacío o que no es JSON: restaurar responde 400 (después de comprobar sesión y permiso)
  }
  const r = await restaurar(
    { sesion: await clienteServidor(), servicio: clienteServicio(), hookUrl: process.env.VERCEL_DEPLOY_HOOK_URL },
    slug,
    numero,
  );
  return NextResponse.json(r.cuerpo, { status: r.estado });
}
