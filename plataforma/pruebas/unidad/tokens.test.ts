import { describe, expect, it } from 'vitest';
import { DIAS_INVITACION, hashDe, nuevoToken } from '../../lib/tokens';

describe('tokens', () => {
  it('hashDe(token) === hash y dos tokens nunca coinciden', () => {
    const a = nuevoToken();
    const b = nuevoToken();
    expect(hashDe(a.token)).toBe(a.hash);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('el token son 32 bytes en base64url y el hash es sha256 en hex', () => {
    const { token, hash } = nuevoToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(DIAS_INVITACION).toBe(7);
  });
});
