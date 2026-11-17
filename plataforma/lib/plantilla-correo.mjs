// La plantilla de los correos de Parroquia en vivo: la usan `lib/correo.ts` y el script
// `herramientas/invitar-admin.mjs` (por eso es .mjs, sin TypeScript). HTML para correo: tablas y estilos
// en línea, que es lo que respetan Gmail y Outlook. Diseño aprobado por el usuario el 2026-11-16.

export const REMITENTE = 'Parroquia en vivo <no-responder@avisos.parroquiaciudadarce.org>';

/** El logo blanco de la Pastoral de Comunicaciones (225×141), publicado con las páginas de OBS. */
export const LOGO_CORREO = 'https://obs.parroquiaciudadarce.org/img/logo-blanco.png';

/** A dónde se escribe para pedir ayuda: los correos salen de una dirección que no recibe. */
export const CORREO_AYUDA = 'admin@parroquiaciudadarce.org';

const C = {
  azulOscuro: '#0c3562',
  azulRey: '#1155a4',
  azulMedio: '#157ec1',
  celeste: '#3d9be0',
  celesteClaro: '#8cc0ef',
  texto: '#2b3440',
  gris: '#6b7684',
};

const FUENTE_TITULO = 'Montserrat,Arial,Helvetica,sans-serif';

/** @param {string} s */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * El correo completo. Todo se escapa menos `parrafos`, que ya vienen en HTML (con lo variable escapado
 * por quien los arma).
 * @param {{ titulo: string, previa: string, parrafos: string[], enlace: string, boton: string, aviso: string }} d
 * @returns {string}
 */
export function envolverCorreo(d) {
  const e = esc(d.enlace);
  const parrafos = d.parrafos
    .map((p, i) => {
      const abajo = i === d.parrafos.length - 1 ? 28 : 16;
      return `<p style="margin:0 0 ${abajo}px;font-size:16px;line-height:1.6;color:${C.texto}">${p}</p>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.titulo)}</title></head>
<body style="margin:0;padding:0;background:#e9edf2;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc(d.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9edf2">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${C.azulOscuro};padding:28px 32px" align="left">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:16px"><img src="${LOGO_CORREO}" width="72" height="45" alt="Logo de la Pastoral de Comunicaciones" style="display:block;border:0"></td>
<td valign="middle">
<div style="font-family:${FUENTE_TITULO};font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.3px">Parroquia en vivo</div>
<div style="font-size:12px;color:${C.celesteClaro};letter-spacing:1.2px;text-transform:uppercase;padding-top:4px">Pastoral de Comunicaciones · Ciudad Arce</div>
</td>
</tr></table>
</td></tr>
<tr><td style="height:4px;background:${C.azulMedio};line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:36px 32px 8px">
<h1 style="margin:0 0 16px;font-family:${FUENTE_TITULO};font-size:24px;line-height:1.25;color:${C.azulOscuro}">${esc(d.titulo)}</h1>
${parrafos}
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${C.azulRey};border-radius:8px">
<a href="${e}" style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(d.boton)}</a>
</td></tr></table>
<p style="margin:28px 0 0;padding:14px 16px;background:#eef5fc;border-left:4px solid ${C.celeste};font-size:14px;line-height:1.5;color:${C.texto}">${esc(d.aviso)}</p>
</td></tr>
<tr><td style="padding:24px 32px 32px">
<p style="margin:0;font-size:13px;line-height:1.5;color:${C.gris}">Si el botón no funciona, copia esta dirección en tu navegador:<br><span style="color:${C.azulRey};word-break:break-all">${e}</span></p>
</td></tr>
<tr><td style="background:#f4f6f9;padding:20px 32px;border-top:1px solid #e3e8ee">
<p style="margin:0;font-size:12px;line-height:1.6;color:${C.gris}">Parroquia en vivo es de la Pastoral de Comunicaciones de la Parroquia Inmaculada Concepción de María, Ciudad Arce.<br>Este correo no recibe respuestas. Para ayuda escribe a <a href="mailto:${CORREO_AYUDA}" style="color:${C.azulRey}">${CORREO_AYUDA}</a>.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
