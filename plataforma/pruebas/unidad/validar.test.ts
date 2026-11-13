import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validarBorrador, validarConfig } from '../../lib/validar';

const config = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);

describe('validarConfig', () => {
  it('acepta vicaria/ciudad-arce/config.json con slug ciudad-arce y lo rechaza con slug otro', () => {
    expect(validarConfig(config, 'ciudad-arce')).toEqual({ ok: true, errores: [] });
    const otro = validarConfig(config, 'otro');
    expect(otro.ok).toBe(false);
    expect(otro.errores.join(' ')).toContain('slug');
  });

  it('no filtra estado entre slugs: alternar slugs da siempre el mismo resultado', () => {
    for (let i = 0; i < 3; i++) {
      expect(validarConfig(config, 'ciudad-arce').ok).toBe(true);
      expect(validarConfig(config, 'otro').ok).toBe(false);
    }
  });
});

describe('validarBorrador', () => {
  it('de un borrador recién creado (solo nombre) lista los faltantes en español', () => {
    const r = validarBorrador({ nombre: 'Parroquia de prueba' }, 'prueba');
    expect(r.ok).toBe(false);
    expect(r.errores).toContain('Falta el lugar (lugar).');
    expect(r.errores).not.toContain('Falta el nombre de la parroquia (nombre).');
  });

  it('tolera un borrador que no es objeto', () => {
    expect(validarBorrador(null, 'prueba').ok).toBe(false);
  });
});
