import { NextResponse } from 'next/server';
import { MAX_BYTES_SUBIDA, subirImagen, type EntradaImagen } from '../../../../../lib/borrador';
import { clienteServidor } from '../../../../../lib/supabase/servidor';

// Envoltorio fino: la lógica (y las pruebas) están en lib/borrador.ts.
export async function POST(peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Se lee el formulario solo después de comprobar sesión y permiso (lo pide `subirImagen`).
  async function leer(): Promise<EntradaImagen> {
    const largo = Number(peticion.headers.get('content-length') ?? 0);
    if (largo > MAX_BYTES_SUBIDA) return { error: 'La imagen pesa más de 3 MB. Reduce su tamaño y vuelve a subirla.' };
    let formulario: FormData;
    try {
      formulario = await peticion.formData();
    } catch {
      return { error: 'La petición no es válida.' };
    }
    const archivo = formulario.get('archivo');
    const campo = formulario.get('campo');
    if (!(archivo instanceof File) || typeof campo !== 'string') return { error: 'Falta el archivo de la imagen.' };
    return { campo, bytes: new Uint8Array(await archivo.arrayBuffer()) };
  }

  const r = await subirImagen(await clienteServidor(), slug, leer);
  return NextResponse.json(r.cuerpo, { status: r.estado });
}
