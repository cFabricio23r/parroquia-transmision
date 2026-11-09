import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMPOS_IDENTIDAD, aplicarIdentidad } from '../../lib/borrador';
import { contraste as contrasteMio, mensajeContraste } from '../../lib/contraste';
import { contraste as contrasteDeParroquia } from '../../lib/validar';

const ciudadArce = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
const sanJose = JSON.parse(
  readFileSync(new URL('../../../vicaria/san-jose-ejemplo/config.json', import.meta.url), 'utf8'),
);

describe('aplicarIdentidad', () => {
  it('lista las claves de identidad del editor', () => {
    expect([...CAMPOS_IDENTIDAD]).toEqual(['nombre', 'nombreCorto', 'lugar', 'colores', 'logos', 'fachada', 'patrono', 'fiesta']);
  });

  it('conserva pantallas, avisos y tipos del borrador', () => {
    // Las dos configuraciones del repo traen los bloques de la 1b (pantallas, avisos, tipos…).
    for (const base of [ciudadArce, sanJose]) {
      const antes = structuredClone(base);
      const resultado = aplicarIdentidad(base, { lugar: 'Otro lugar', fiesta: { dia: 1, mes: 2 } }) as Record<string, unknown>;
      expect(resultado.lugar).toBe('Otro lugar');
      expect(resultado.fiesta).toEqual({ dia: 1, mes: 2 });
      for (const clave of Object.keys(base)) {
        if (!CAMPOS_IDENTIDAD.includes(clave as (typeof CAMPOS_IDENTIDAD)[number])) {
          expect(resultado[clave], clave).toEqual(base[clave]);
        }
      }
      expect(base).toEqual(antes); // no muta el borrador
    }
    expect(Object.keys(sanJose)).toEqual(expect.arrayContaining(['pantallas', 'avisos', 'tipos']));
  });

  it('ignora claves que no son de identidad, como pantallas o avisos', () => {
    const borrador = { nombre: 'A', avisos: [{ texto: 'x' }], pantallas: { inicio: 1 } };
    const r = aplicarIdentidad(borrador, { avisos: [], pantallas: null, galeria: [1], nombre: 'B' });
    expect(r).toEqual({ nombre: 'B', avisos: [{ texto: 'x' }], pantallas: { inicio: 1 } });
  });

  it('con null quita un campo opcional y lo ausente no se toca', () => {
    const r = aplicarIdentidad({ nombre: 'A', nombreCorto: 'a', lugar: 'L' }, { nombreCorto: null });
    expect(r).toEqual({ nombre: 'A', lugar: 'L' });
  });

  it('no deja pasar __proto__ ni claves heredadas', () => {
    const cambios = JSON.parse('{"__proto__": {"hack": true}, "nombre": "B"}');
    const r = aplicarIdentidad({ nombre: 'A' }, cambios) as Record<string, unknown>;
    expect(r.nombre).toBe('B');
    expect(({} as Record<string, unknown>).hack).toBeUndefined();
    expect(Object.keys(r)).toEqual(['nombre']);
  });
});

describe('contraste del formulario', () => {
  it('da el mismo número que contraste de vicaria/parroquia.js', () => {
    const colores = ['#1155a4', '#0c3562', '#8a1c2b', '#ffffff', '#000000', '#3d9be0', '#767676', '#777777', '#ff0000'];
    for (const c of colores) {
      expect(contrasteMio('#ffffff', c), c).toBe(contrasteDeParroquia('#ffffff', c));
      expect(contrasteMio(c, '#336699'), c).toBe(contrasteDeParroquia(c, '#336699'));
    }
  });

  it('dice «se lee bien» o «no se lee» con el mismo umbral de 4.5', () => {
    expect(mensajeContraste('#1155a4')).toBe('7.3:1, se lee bien');
    expect(mensajeContraste('#3d9be0')).toMatch(/^[0-9]\.[0-9]:1, no se lee: elige uno más oscuro$/);
    expect(mensajeContraste('#767676')).toBe('4.5:1, se lee bien'); // 4.54: pasa
    expect(mensajeContraste('#777777')).toBe('4.4:1, no se lee: elige uno más oscuro'); // 4.48: no pasa, y no se redondea a 4.5
    expect(mensajeContraste('rojo')).toBe('');
  });
});
