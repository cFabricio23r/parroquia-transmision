import { NextResponse } from 'next/server';
import { guardarAsignacion } from '../../../../../../../lib/facebook/asignaciones';
import { graphDeEntorno } from '../../../../../../../lib/facebook/graph-entorno';
import { clienteServicio } from '../../../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/facebook/asignaciones.ts. Nunca trae un token.
export async function PUT(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    // cuerpo vacío o que no es JSON: guardarAsignacion responde 422
  }
  const r = await guardarAsignacion(
    { sesion: await clienteServidor(), servicio: clienteServicio(), graph: graphDeEntorno() },
    slug,
    cuerpo,
  );
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}
