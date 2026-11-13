import { Resend } from 'resend';
import { DIAS_INVITACION } from './tokens';

export interface Mensaje { para: string; asunto: string; texto: string; html: string }

export const REMITENTE = 'Transmisiones parroquiales <no-responder@avisos.parroquiaciudadarce.org>';

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

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function envolver(titulo: string, parrafos: string[], enlace: string, boton: string): string {
  const e = esc(enlace);
  return `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
<h1 style="font-size:20px">${esc(titulo)}</h1>
${parrafos.map((p) => `<p>${p}</p>`).join('\n')}
<p><a href="${e}" style="display:inline-block;background:#1f3a5f;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">${esc(boton)}</a></p>
<p>Si el botón no funciona, copia esta dirección en tu navegador:<br>${e}</p>
</body></html>`;
}

export function correoInvitacion(d: { enlace: string; parroquia: string; rol: string }): { asunto: string; texto: string; html: string } {
  const asunto = `Te invitaron a administrar ${d.parroquia}`;
  const vence = `El enlace sirve una sola vez y vence en ${DIAS_INVITACION} días. Si no esperabas este mensaje, ignóralo.`;
  const texto = `Te invitaron a administrar ${d.parroquia} como ${d.rol}.\n\nPara aceptar la invitación entra aquí:\n${d.enlace}\n\n${vence}`;
  const html = envolver(
    asunto,
    [`Te invitaron a administrar <strong>${esc(d.parroquia)}</strong> como ${esc(d.rol)}.`, esc(vence)],
    d.enlace,
    'Aceptar la invitación',
  );
  return { asunto, texto, html };
}

export function correoRecuperar(d: { enlace: string }): { asunto: string; texto: string; html: string } {
  const asunto = 'Recupera tu contraseña';
  const texto = `Pediste cambiar tu contraseña.\n\nEntra aquí para elegir una nueva:\n${d.enlace}\n\nSi no fuiste tú, ignora este mensaje: tu contraseña sigue igual.`;
  const html = envolver(
    asunto,
    ['Pediste cambiar tu contraseña.', 'Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.'],
    d.enlace,
    'Elegir una contraseña nueva',
  );
  return { asunto, texto, html };
}
