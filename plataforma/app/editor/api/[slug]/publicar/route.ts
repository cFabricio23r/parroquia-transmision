import { NextResponse } from 'next/server';
import { publicar } from '../../../../../lib/publicar';
import { clienteServicio } from '../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/publicar.ts.
export async function POST(_peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicar(
    { sesion: await clienteServidor(), servicio: clienteServicio(), hookUrl: process.env.VERCEL_DEPLOY_HOOK_URL },
    slug,
  );
  return NextResponse.json(r.cuerpo, { status: r.estado });
}
