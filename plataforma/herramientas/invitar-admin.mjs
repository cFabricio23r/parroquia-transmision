/*
  Invita a un administrador de la plataforma (el primero no puede salir de la propia plataforma).
  Uso:  node herramientas/invitar-admin.mjs <correo>
  Lee plataforma/.env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, SITIO_URL y,
  para enviar el correo de verdad, RESEND_API_KEY (y CORREO_REMITENTE). Sin RESEND_API_KEY
  escribe el correo en la consola. La llave secreta nunca se imprime ni se guarda en otro lado.

  Es un .mjs que no puede importar los .ts: repite las tres piezas pequeñas de lib/tokens.ts
  (token y hash) y lib/correo.ts (texto del correo). Si cambian allá, cámbialas aquí.
*/
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const DIAS_INVITACION = 7;
const REMITENTE = 'Transmisiones parroquiales <no-responder@avisos.parroquiaciudadarce.org>';
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashDe = (token) => createHash('sha256').update(token).digest('hex');

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivoEnv = path.join(raiz, '.env.local');
if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);

const correo = String(process.argv[2] ?? '').trim().toLowerCase();
if (!RE_CORREO.test(correo)) salir('Uso: node herramientas/invitar-admin.mjs <correo>');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SECRET_KEY;
const sitio = (process.env.SITIO_URL ?? '').replace(/\/+$/, '');
if (!url || !llave) salir('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en plataforma/.env.local');
if (!sitio) salir('Falta SITIO_URL en plataforma/.env.local: sin ella el enlace de la invitación no apuntaría a ningún lado');

const servicio = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

// Anula las invitaciones de administrador pendientes del mismo correo.
const { error: errorAnular } = await servicio
  .from('invitaciones')
  .update({ anulada_en: new Date().toISOString() })
  .eq('correo', correo)
  .eq('rol', 'administrador')
  .is('usada_en', null)
  .is('anulada_en', null);
if (errorAnular) salir(`No se pudo anular la invitación anterior: ${errorAnular.message}`);

const token = randomBytes(32).toString('base64url');
const vence = new Date(Date.now() + DIAS_INVITACION * 86_400_000).toISOString();
const { data: fila, error: errorInsert } = await servicio
  .from('invitaciones')
  .insert({ correo, rol: 'administrador', parroquia_id: null, token_hash: hashDe(token), vence_en: vence })
  .select('id')
  .single();
if (errorInsert || !fila) salir(`No se pudo guardar la invitación: ${errorInsert?.message}`);

const enlace = `${sitio}/editor/invitacion?token=${token}`;
const asunto = 'Te invitaron a administrar la plataforma de parroquias';
const aviso = `El enlace sirve una sola vez y vence en ${DIAS_INVITACION} días. Si no esperabas este mensaje, ignóralo.`;
const texto = `Te invitaron a administrar la plataforma de parroquias como administrador.\n\nPara aceptar la invitación entra aquí:\n${enlace}\n\n${aviso}`;
const html = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
<h1 style="font-size:20px">${asunto}</h1>
<p>Te invitaron a administrar la plataforma de parroquias como administrador.</p>
<p>${aviso}</p>
<p><a href="${enlace}" style="display:inline-block;background:#1f3a5f;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">Aceptar la invitación</a></p>
<p>Si el botón no funciona, copia esta dirección en tu navegador:<br>${enlace}</p>
</body></html>`;

try {
  if (process.env.RESEND_API_KEY) {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.CORREO_REMITENTE || REMITENTE,
      to: correo,
      subject: asunto,
      text: texto,
      html,
    });
    if (error) throw new Error(error.message);
  } else {
    console.info(`[correo sin RESEND_API_KEY] Para: ${correo}\nAsunto: ${asunto}\n${texto}`);
  }
} catch (e) {
  await servicio.from('invitaciones').update({ anulada_en: new Date().toISOString() }).eq('id', fila.id);
  salir(`No se pudo enviar el correo (la invitación quedó anulada): ${e.message}`);
}

// El registro lleva el correo, nunca el token.
const { error: errorRegistro } = await servicio
  .from('registro')
  .insert({ parroquia_id: null, usuario_id: null, accion: 'invitar', detalle: { correo, rol: 'administrador' } });
if (errorRegistro) console.error(`La invitación salió, pero no quedó en el registro: ${errorRegistro.message}`);

console.log(`Invitación de administrador enviada a ${correo} (vence en ${DIAS_INVITACION} días).`);
