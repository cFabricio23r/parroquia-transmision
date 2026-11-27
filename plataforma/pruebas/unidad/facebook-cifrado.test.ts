import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cifrar, descifrar } from '../../lib/facebook/cifrado';

const TEXTO = 'EAAG-token-de-prueba-123';
const VARIABLE = 'FACEBOOK_CLAVE_CIFRADO';
const MENSAJE_FALTA = 'Falta FACEBOOK_CLAVE_CIFRADO';

let anterior: string | undefined;

beforeEach(() => {
  anterior = process.env[VARIABLE];
  process.env[VARIABLE] = randomBytes(32).toString('base64');
});

afterEach(() => {
  if (anterior === undefined) delete process.env[VARIABLE];
  else process.env[VARIABLE] = anterior;
});

describe('cifrado de tokens de Facebook', () => {
  it('ida y vuelta devuelve el mismo texto', () => {
    const llave = randomBytes(32);
    expect(descifrar(cifrar(TEXTO, llave), llave)).toBe(TEXTO);
  });

  it('usa el formato v1 con cuatro partes', () => {
    const sobre = cifrar(TEXTO, randomBytes(32));
    const partes = sobre.split('.');
    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe('v1');
  });

  it('dos cifrados del mismo texto dan sobres distintos', () => {
    const llave = randomBytes(32);
    expect(cifrar(TEXTO, llave)).not.toBe(cifrar(TEXTO, llave));
  });

  it('un sobre con un byte cambiado lanza', () => {
    const llave = randomBytes(32);
    const [v, iv, tag, datos] = cifrar(TEXTO, llave).split('.');
    const bytes = Buffer.from(datos, 'base64url');
    bytes[0] ^= 0x01;
    const alterado = [v, iv, tag, bytes.toString('base64url')].join('.');
    expect(() => descifrar(alterado, llave)).toThrow();
  });

  it('con otra llave lanza', () => {
    const sobre = cifrar(TEXTO, randomBytes(32));
    expect(() => descifrar(sobre, randomBytes(32))).toThrow();
  });

  it('un sobre malformado lanza', () => {
    const llave = randomBytes(32);
    expect(() => descifrar('v2.a.b.c', llave)).toThrow();
    expect(() => descifrar('v1.solo-dos', llave)).toThrow();
    expect(() => descifrar('v1.@@.@@.@@', llave)).toThrow();
  });

  it('el mensaje de error nunca contiene el texto plano ni la llave', () => {
    const llave = randomBytes(32);
    const sobre = cifrar(TEXTO, llave);
    const otra = randomBytes(32);
    let mensaje = '';
    try {
      descifrar(sobre, otra);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).not.toBe('');
    expect(mensaje).not.toContain(TEXTO);
    expect(mensaje).not.toContain(otra.toString('base64'));
    expect(mensaje).not.toContain(llave.toString('base64'));
  });

  it('sin llave en el entorno lanza el error de falta de clave', () => {
    delete process.env[VARIABLE];
    expect(() => cifrar(TEXTO)).toThrow(new Error(MENSAJE_FALTA));
  });

  it('una llave en el entorno que no mide 32 bytes lanza el error de falta de clave', () => {
    process.env[VARIABLE] = randomBytes(16).toString('base64');
    expect(() => cifrar(TEXTO)).toThrow(new Error(MENSAJE_FALTA));
    expect(() => descifrar('v1.a.b.c')).toThrow(new Error(MENSAJE_FALTA));
  });

  it('sin llave explícita usa la del entorno', () => {
    const sobre = cifrar(TEXTO);
    expect(descifrar(sobre)).toBe(TEXTO);
  });
});
