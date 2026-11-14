import { describe, expect, it } from 'vitest';
import { claveValida, MENSAJE_CLAVES_NO_IGUALES, requisitosClave } from '../../lib/clave';

describe('requisitosClave', () => {
  it('requisitosClave marca cada regla', () => {
    expect(requisitosClave('1234567', '1234567').map((r) => r.cumplido)).toEqual([false, true]);
    expect(requisitosClave('12345678', '12345679').map((r) => r.cumplido)).toEqual([true, false]);
    expect(requisitosClave('', '').map((r) => r.cumplido)).toEqual([false, false]);
    expect(requisitosClave('x', 'x').map((r) => r.texto)).toEqual(['Al menos 8 caracteres', 'Las dos son iguales']);
  });
  it('claveValida pide las dos', () => {
    expect(claveValida('12345678', '12345678')).toBe(true);
    expect(claveValida('1234567', '1234567')).toBe(false);
    expect(claveValida('12345678', '12345670')).toBe(false);
    expect(MENSAJE_CLAVES_NO_IGUALES).toBe('Las dos contraseñas no son iguales.');
  });
});
