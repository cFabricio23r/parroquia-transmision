import { NextResponse, after } from 'next/server';
import { MENSAJE_SIN_SESION } from '../../../../../../lib/borrador';
import { graphDeEntorno } from '../../../../../../lib/facebook/graph-entorno';
import { crearVivo } from '../../../../../../lib/facebook/vivos';
import { clienteConToken } from '../../../../../../lib/supabase/con-token';
import { clienteServicio } from '../../../../../../lib/supabase/servicio';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

// Ruling 13: el peor camino (leer el activo 12 s + crear 12 s + base) más el crosspost que corre en `after`
// (12 s) no debe morir a mitad entre crear en Facebook y guardar la fila. `after` corre dentro de este mismo
// límite (docs de Next 16.4.5 en node_modules/next/dist/docs). El tope del plan de Vercel: no verificado.
export const maxDuration = 60;

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
  // El crosspost a las extras va en `after`: no demora la respuesta (la app corta a los 15 s).
  const r = await crearVivo({ sesion, servicio: clienteServicio(), graph: graphDeEntorno(), despues: (tarea) => after(tarea) }, slug, cuerpo);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: SIN_CACHE });
}
