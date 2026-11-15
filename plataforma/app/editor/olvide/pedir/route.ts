// La app «Parroquia en vivo» pide el enlace de contraseña (etapa 3a, Decisión 7). Misma lógica que
// el formulario del editor (pedirRecuperacionDiferida: límites de envios_correo, misma plantilla) y
// pública, porque cuelga de /editor/olvide/ (PUBLICAS en proxy.ts). Responde siempre 200 con
// MENSAJE_RECUPERAR, al instante: el trabajo va en after(), así no se nota si el correo tiene cuenta.
// Nada se registra en la consola.
import { after, NextResponse } from 'next/server';
import { enviarCorreo } from '../../../../lib/correo';
import { correoDelCuerpo, pedirRecuperacionDiferida, resolverSitioUrl } from '../../../../lib/sesion';
import { clienteServicio } from '../../../../lib/supabase/servicio';

export async function POST(req: Request) {
  let cuerpo: unknown = null;
  try {
    cuerpo = await req.json();
  } catch {
    // cuerpo roto o vacío: se toma como correo vacío
  }
  return NextResponse.json(
    pedirRecuperacionDiferida(
      { servicio: clienteServicio(), enviar: enviarCorreo, sitioUrl: resolverSitioUrl(process.env) },
      correoDelCuerpo(cuerpo),
      after,
    ),
  );
}
