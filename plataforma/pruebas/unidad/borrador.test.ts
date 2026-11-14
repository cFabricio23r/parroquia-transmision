import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { aplicarCambios } from '../../lib/borrador';
import { contraste as contrasteMio, mensajeContraste } from '../../lib/contraste';
import { contraste as contrasteDeParroquia } from '../../lib/validar';

const ciudadArce = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
const sanJose = JSON.parse(
  readFileSync(new URL('../../../vicaria/san-jose-ejemplo/config.json', import.meta.url), 'utf8'),
);

describe('aplicarCambios', () => {
  it('reemplaza galería y avisos y conserva el nombre', () => {
    const r = aplicarCambios({ nombre: 'A', galeria: [1], avisos: [{ texto: 'x' }] }, { galeria: [2], avisos: [] });
    expect(r).toEqual({ nombre: 'A', galeria: [2], avisos: [] });
  });

  it('conserva pantallas, avisos y tipos cuando cambian otros bloques', () => {
    for (const base of [ciudadArce, sanJose]) {
      const antes = structuredClone(base);
      const resultado = aplicarCambios(base, { lugar: 'Otro lugar', fiesta: { dia: 1, mes: 2 } }) as Record<string, unknown>;
      expect(resultado.lugar).toBe('Otro lugar');
      expect(resultado.fiesta).toEqual({ dia: 1, mes: 2 });
      for (const clave of Object.keys(base)) {
        if (clave !== 'lugar' && clave !== 'fiesta') expect(resultado[clave], clave).toEqual(base[clave]);
      }
      expect(base).toEqual(antes);
    }
    expect(Object.keys(sanJose)).toEqual(expect.arrayContaining(['pantallas', 'avisos', 'tipos']));
  });

  it('con null quita el bloque', () => {
    expect(aplicarCambios({ nombre: 'A', redes: [1] }, { redes: null })).toEqual({ nombre: 'A' });
  });

  it('ignora claves que no son bloques', () => {
    expect(aplicarCambios({ nombre: 'A' }, { foo: 1, esquema: 2 })).toEqual({ nombre: 'A' });
  });

  it('no deja pasar __proto__ ni claves heredadas', () => {
    const cambios = JSON.parse('{"__proto__": {"x": 1}, "nombre": "B"}');
    const r = aplicarCambios({ nombre: 'A' }, cambios) as Record<string, unknown>;
    expect(r.nombre).toBe('B');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(Object.keys(r)).toEqual(['nombre']);
    expect(Object.prototype.hasOwnProperty.call(r, '__proto__')).toBe(false);
  });

  it('no muta los argumentos', () => {
    const b = { nombre: 'A', avisos: [{ texto: 'x' }] };
    const c = { avisos: [], lugar: 'L' };
    const bAntes = structuredClone(b);
    const cAntes = structuredClone(c);
    aplicarCambios(b, c);
    expect(b).toEqual(bAntes);
    expect(c).toEqual(cAntes);
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
