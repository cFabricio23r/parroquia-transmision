import { Resend } from 'resend';
import { DIAS_INVITACION } from './tokens';
import { envolverCorreo, esc, REMITENTE } from './plantilla-correo.mjs';

export { REMITENTE };

export interface Mensaje { para: string; asunto: string; texto: string; html: string }

let buzonDePrueba: Mensaje[] | null = null;

/** Para las pruebas: los mensajes se guardan en `buzon` y no se envía nada. `null` lo desactiva. */
export function usarBuzonDePrueba(buzon: Mensaje[] | null): void {
  buzonDePrueba = buzon;
}

/** Envía un correo con Resend. Sin RESEND_API_KEY solo lo escribe en la consola (desarrollo). */
export async function enviarCorreo(m: Mensaje): Promise<void> {
  if (buzonDePrueba) {
    buzonDePrueba.push(m);
    return;
  }
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.info(`[correo sin RESEND_API_KEY] Para: ${m.para}\nAsunto: ${m.asunto}\n${m.texto}`);
    return;
  }
  const { error } = await new Resend(clave).emails.send({
    from: process.env.CORREO_REMITENTE || REMITENTE,
    to: m.para,
    subject: m.asunto,
    text: m.texto,
    html: m.html,
  });
  if (error) throw new Error(`No se pudo enviar el correo: ${error.message}`);
}

const PARA_QUE = 'Desde la plataforma vas a preparar las transmisiones de cada semana: los rótulos, los avisos y los horarios que se ven en la misa.';

export function correoInvitacion(d: { enlace: string; parroquia: string; rol: string }): { asunto: string; texto: string; html: string } {
  const asunto = `Te invitaron a administrar ${d.parroquia}`;
  const vence = `El enlace sirve una sola vez y vence en ${DIAS_INVITACION} días. Si no esperabas este mensaje, ignóralo.`;
  const texto = `Te invitaron a administrar ${d.parroquia} como ${d.rol}.

${PARA_QUE}

Para aceptar la invitación entra aquí:
${d.enlace}

${vence}`;
  const html = envolverCorreo({
    titulo: 'Te invitaron a administrar una parroquia',
    previa: 'Acepta la invitación para empezar a preparar las transmisiones de tu parroquia.',
    parrafos: [`Te invitaron a administrar <strong>${esc(d.parroquia)}</strong> como <strong>${esc(d.rol)}</strong>.`, esc(PARA_QUE)],
    enlace: d.enlace,
    boton: 'Aceptar la invitación',
    aviso: vence,
  });
  return { asunto, texto, html };
}

export function correoRecuperar(d: { enlace: string }): { asunto: string; texto: string; html: string } {
  const asunto = 'Recupera tu contraseña';
  const texto = `Pediste cambiar tu contraseña.

Entra aquí para elegir una nueva:
${d.enlace}

Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.`;
  const html = envolverCorreo({
    titulo: asunto,
    previa: 'Elige una contraseña nueva para entrar a Parroquia en vivo.',
    parrafos: ['Pediste cambiar tu contraseña. Toca el botón para elegir una nueva; después vuelve a la app y entra con ella.'],
    enlace: d.enlace,
    boton: 'Elegir una contraseña nueva',
    aviso: 'Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.',
  });
  return { asunto, texto, html };
}
