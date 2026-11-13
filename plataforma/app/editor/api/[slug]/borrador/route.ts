import { NextResponse } from 'next/server';
import { guardarBorrador } from '../../../../../lib/borrador';
import { clienteServidor } from '../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/borrador.ts.
export async function PUT(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    // cuerpo vacío o que no es JSON: guardarBorrador responde 400 (después de comprobar sesión y permiso)
  }
  const r = await guardarBorrador(await clienteServidor(), slug, cuerpo);
  return NextResponse.json(r.cuerpo, { status: r.estado });
}
