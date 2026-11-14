import { describe, expect, it } from 'vitest';
import { autorDeVersion, etiquetaRol, etiquetaUsuario, inicial, nombreVisible, primerNombre, ROL_ADMIN, ROL_COORDINADOR } from '../../lib/persona';

describe('persona', () => {
  it('persona: nombre, primer nombre, inicial y rol', () => {
    expect(nombreVisible('  Fabricio Ramírez ', 'f@x.org')).toBe('Fabricio Ramírez');
    expect(nombreVisible(null, 'f@x.org')).toBe('f@x.org');
    expect(nombreVisible('   ', 'f@x.org')).toBe('f@x.org');
    expect(primerNombre('Fabricio Ramírez', 'f@x.org')).toBe('Fabricio');
    expect(primerNombre(null, 'f@x.org')).toBe('f@x.org');
    expect(inicial('ángela', 'a@x.org')).toBe('Á');
    expect(inicial(null, 'maria@x.org')).toBe('M');
    expect(etiquetaUsuario({ nombre: 'Fabricio Ramírez', correo: 'f@x.org', esAdmin: false })).toBe('Fabricio · Coordinador');
    expect(etiquetaUsuario({ nombre: 'María López', correo: 'm@x.org', esAdmin: true })).toBe('María · Admin de vicaría');
    expect(etiquetaUsuario({ nombre: 'María López', correo: 'm@x.org', esAdmin: false }, true)).toBe('María López · Coordinador');
    expect(etiquetaUsuario({ nombre: null, correo: 'm@x.org', esAdmin: false })).toBe('m@x.org · Coordinador');
  });
  it('roles', () => {
    expect(ROL_COORDINADOR).toBe('Coordinador');
    expect(ROL_ADMIN).toBe('Admin de vicaría');
    expect(etiquetaRol(true)).toBe(ROL_ADMIN);
    expect(etiquetaRol(false)).toBe(ROL_COORDINADOR);
  });
  it('un emoji al principio no se parte por la mitad', () => {
    expect(inicial('🙏 José', 'j@x.org')).toBe('🙏');
  });

  it('autorDeVersion: «Pastoral (admin)», el nombre o el correo, o «—»', () => {
    expect(autorDeVersion({ esAdmin: true, nombre: 'María', correo: 'm@x' })).toBe('Pastoral (admin)');
    expect(autorDeVersion({ esAdmin: false, nombre: null, correo: 'p@x' })).toBe('p@x');
    expect(autorDeVersion({ esAdmin: false, nombre: ' Ana  Pérez ', correo: 'a@x' })).toBe('Ana Pérez');
    expect(autorDeVersion({ esAdmin: false, nombre: null, correo: null })).toBe('—');
    expect(autorDeVersion(null)).toBe('—');
  });
});
