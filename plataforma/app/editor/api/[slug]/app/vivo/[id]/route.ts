import { NextResponse } from 'next/server';
import { MENSAJE_SIN_SESION } from '../../../../../../../lib/borrador';
import { graphDeEntorno } from '../../../../../../../lib/facebook/graph-entorno';
import { estadoVivo, terminarVivo } from '../../../../../../../lib/facebook/vivos';
import { clienteConToken } from '../../../../../../../lib/supabase/con-token';
import { clienteServicio } from '../../../../../../../lib/supabase/servicio';

const SIN_CACHE = { 'Cache-Control': 'no-store' };
type Contexto = { params: Promise<{ slug: string; id: string }> };

// Envoltorios finos: la lógica (y las pruebas) están en lib/facebook/vivos.ts.
export async function GET(peticion: Request, { params }: Contexto) {
  const { slug, id } = await params;
  const sesion = await clienteConToken(peticion);
  if (!sesion) return NextResponse.json({ error: MENSAJE_SIN_SESION }, { status: 401, headers: SIN_CACHE });
  const r = await estadoVivo({ sesion, servicio: clienteServicio(), graph: graphDeEntorno() }, slug, id);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: SIN_CACHE });
}

export async function DELETE(peticion: Request, { params }: Contexto) {
  const { slug, id } = await params;
  const sesion = await clienteConToken(peticion);
  if (!sesion) return NextResponse.json({ error: MENSAJE_SIN_SESION }, { status: 401, headers: SIN_CACHE });
  const r = await terminarVivo({ sesion, servicio: clienteServicio(), graph: graphDeEntorno() }, slug, id);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: SIN_CACHE });
}
