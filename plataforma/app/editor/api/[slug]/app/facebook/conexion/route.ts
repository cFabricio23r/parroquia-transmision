import { NextResponse } from 'next/server';
import { desconectar } from '../../../../../../../lib/facebook/conexion';
import { graphDeEntorno } from '../../../../../../../lib/facebook/graph-entorno';
import { clienteServicio } from '../../../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/facebook/conexion.ts. Nunca trae un token.
export async function DELETE(_peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // desconectar no llama a Facebook; el graph solo completa las dependencias. graphDeEntorno no se cae si falta
  // FACEBOOK_VERSION_GRAPH (crearGraph lanza): desconectar tiene que funcionar aunque Facebook no esté configurado.
  const graph = graphDeEntorno();
  const r = await desconectar({ sesion: await clienteServidor(), servicio: clienteServicio(), graph }, slug);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}
