import { NextResponse } from 'next/server';
import { MENSAJE_SIN_SESION } from '../../../../../../lib/borrador';
import { graphDeEntorno } from '../../../../../../lib/facebook/graph-entorno';
import { crearVivo } from '../../../../../../lib/facebook/vivos';
import { clienteConToken } from '../../../../../../lib/supabase/con-token';
import { clienteServicio } from '../../../../../../lib/supabase/servicio';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

// Envoltorio fino: la lógica (y las pruebas) están en lib/facebook/vivos.ts.
// La respuesta lleva la clave de transmisión: nunca se guarda en caché ni se registra.
export async function POST(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await clienteConToken(peticion);
  if (!sesion) return NextResponse.json({ error: MENSAJE_SIN_SESION }, { status: 401, headers: SIN_CACHE });
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    // cuerpo vacío o que no es JSON: crearVivo responde 422
  }
  const r = await crearVivo({ sesion, servicio: clienteServicio(), graph: graphDeEntorno() }, slug, cuerpo);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: SIN_CACHE });
}
