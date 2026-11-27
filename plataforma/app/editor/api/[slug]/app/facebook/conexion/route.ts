import { NextResponse } from 'next/server';
import { desconectar } from '../../../../../../../lib/facebook/conexion';
import { crearGraph } from '../../../../../../../lib/facebook/graph';
import { clienteServicio } from '../../../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/facebook/conexion.ts. Nunca trae un token.
export async function DELETE(_peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // desconectar no llama a Facebook; el graph solo completa las dependencias.
  const graph = crearGraph({ appId: process.env.FACEBOOK_APP_ID ?? '', secreto: process.env.FACEBOOK_APP_SECRETO ?? '' });
  const r = await desconectar({ sesion: await clienteServidor(), servicio: clienteServicio(), graph }, slug);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}
