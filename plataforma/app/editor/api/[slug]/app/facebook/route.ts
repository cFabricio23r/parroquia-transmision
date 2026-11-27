import { NextResponse } from 'next/server';
import { MENSAJE_SIN_SESION } from '../../../../../../lib/borrador';
import { leerDestinos } from '../../../../../../lib/facebook/vivos';
import { clienteServicio } from '../../../../../../lib/supabase/servicio';
import { clienteConToken } from '../../../../../../lib/supabase/con-token';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

// Envoltorio fino: la lógica (y las pruebas) están en lib/facebook/vivos.ts. La llama la app con
// `Authorization: Bearer` y el navegador con cookies. Nunca trae un token.
export async function GET(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await clienteConToken(peticion);
  if (!sesion) return NextResponse.json({ error: MENSAJE_SIN_SESION }, { status: 401, headers: SIN_CACHE });
  const r = await leerDestinos({ sesion, servicio: clienteServicio() }, slug);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: SIN_CACHE });
}
