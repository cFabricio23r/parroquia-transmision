import { NextResponse } from 'next/server';
import { conError } from '../../../../../lib/borrador';
import { aplicarOperacion, leerOperacion, leerSemana } from '../../../../../lib/semana-editor';
import { clienteServidor } from '../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/semana-editor.ts.
export async function GET(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lunes = new URL(peticion.url).searchParams.get('lunes');
  const r = await leerSemana(await clienteServidor(), slug, lunes);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    // cuerpo vacío o que no es JSON: leerOperacion lo rechaza
  }
  const sesion = await clienteServidor();
  const op = leerOperacion(cuerpo);
  const r = 'error' in op ? conError(400, op.error) : await aplicarOperacion(sesion, slug, op);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}
