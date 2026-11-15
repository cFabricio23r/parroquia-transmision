import { NextResponse } from 'next/server';
import { guardarClave, quitarClave } from '../../../../../../lib/app-transmision';
import { clienteServicio } from '../../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/app-transmision.ts.
// La respuesta nunca trae la clave: solo { guardadaEn } o un error sin detalle.
export async function PUT(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    // cuerpo vacío o que no es JSON: guardarClave responde 422
  }
  const r = await guardarClave({ sesion: await clienteServidor(), servicio: clienteServicio() }, slug, cuerpo);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(_peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await quitarClave({ sesion: await clienteServidor(), servicio: clienteServicio() }, slug);
  return NextResponse.json(r.cuerpo, { status: r.estado, headers: { 'Cache-Control': 'no-store' } });
}
