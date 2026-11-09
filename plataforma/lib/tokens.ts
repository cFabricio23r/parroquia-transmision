import { createHash, randomBytes } from 'node:crypto';

export const DIAS_INVITACION = 7;

/** Hash sha256 en hexadecimal: es lo único que se guarda en la base. */
export function hashDe(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Token de un solo uso: 32 bytes aleatorios en base64url y su hash. */
export function nuevoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashDe(token) };
}
