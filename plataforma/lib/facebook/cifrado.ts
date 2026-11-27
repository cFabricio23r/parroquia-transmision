// Cifrado en reposo de los tokens de Facebook (AES-256-GCM, node:crypto).
// Formato del sobre: v1.<iv b64url>.<tag b64url>.<datos b64url>
// Nunca incluir el texto plano ni la llave en ningún mensaje de error.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIJO = 'v1';
const VARIABLE = 'FACEBOOK_CLAVE_CIFRADO';
const LARGO_IV = 12;
const LARGO_TAG = 16;
const LARGO_LLAVE = 32;
const ALGORITMO = 'aes-256-gcm';
const PATRON_B64URL = /^[A-Za-z0-9_-]*$/;

const MENSAJE_FALTA = 'Falta FACEBOOK_CLAVE_CIFRADO';
const MENSAJE_LLAVE_INVALIDA = 'La llave de cifrado debe medir 32 bytes';
const MENSAJE_DESCIFRAR = 'No se pudo descifrar el token';

function llaveDesdeEntorno(): Buffer {
  const valor = process.env[VARIABLE];
  const llave = valor ? Buffer.from(valor, 'base64') : Buffer.alloc(0);
  if (llave.length !== LARGO_LLAVE) throw new Error(MENSAJE_FALTA);
  return llave;
}

function resolverLlave(llave?: Buffer): Buffer {
  if (llave === undefined) return llaveDesdeEntorno();
  if (llave.length !== LARGO_LLAVE) throw new Error(MENSAJE_LLAVE_INVALIDA);
  return llave;
}

export function cifrar(texto: string, llave?: Buffer): string {
  const clave = resolverLlave(llave);
  const iv = randomBytes(LARGO_IV);
  const cifrador = createCipheriv(ALGORITMO, clave, iv, { authTagLength: LARGO_TAG });
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  const tag = cifrador.getAuthTag();
  return [PREFIJO, iv.toString('base64url'), tag.toString('base64url'), datos.toString('base64url')].join('.');
}

export function descifrar(sobre: string, llave?: Buffer): string {
  const clave = resolverLlave(llave);
  const partes = sobre.split('.');
  if (partes.length !== 4 || partes[0] !== PREFIJO) throw new Error(MENSAJE_DESCIFRAR);
  const [, ivB64, tagB64, datosB64] = partes;
  if (![ivB64, tagB64, datosB64].every((p) => PATRON_B64URL.test(p))) throw new Error(MENSAJE_DESCIFRAR);

  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const datos = Buffer.from(datosB64, 'base64url');
  if (iv.length !== LARGO_IV || tag.length !== LARGO_TAG) throw new Error(MENSAJE_DESCIFRAR);

  try {
    const descifrador = createDecipheriv(ALGORITMO, clave, iv, { authTagLength: LARGO_TAG });
    descifrador.setAuthTag(tag);
    return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
  } catch {
    throw new Error(MENSAJE_DESCIFRAR);
  }
}
