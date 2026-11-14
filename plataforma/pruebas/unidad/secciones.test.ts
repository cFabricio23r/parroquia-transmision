import { describe, expect, it } from 'vitest';
import { BLOQUES, SECCIONES, hrefSeccion, seccionDeBloque, seccionDeRuta } from '../../lib/editor/secciones';
import { bloqueDeError, limpiarMensaje } from '../../lib/editor/errores';

describe('catálogo de secciones', () => {
  it('tiene las 10 secciones del menú en orden', () => {
    expect(SECCIONES.map((s) => s.texto)).toEqual([
      'Resumen', 'Identidad', 'Patrono y fiesta', 'Pantallas', 'Rótulos y estilo', 'Tipos de transmisión',
      'Galería', 'Horarios y redes', 'Avisos fijos', 'Publicar',
    ]);
  });

  it('cada bloque pertenece a exactamente una sección', () => {
    for (const b of BLOQUES) {
      expect(SECCIONES.filter((s) => s.bloques.includes(b)).length, b).toBe(1);
    }
    expect(seccionDeBloque('redes')).toBe('horarios-y-redes');
    expect(seccionDeBloque('fiesta')).toBe('patrono');
  });

  it('encuentra la sección de una ruta', () => {
    expect(seccionDeRuta('/editor/p/san-jose', 'san-jose').id).toBe('resumen');
    expect(seccionDeRuta('/editor/p/san-jose/', 'san-jose').id).toBe('resumen');
    expect(seccionDeRuta('/editor/p/san-jose/identidad', 'san-jose').id).toBe('identidad');
    expect(seccionDeRuta('/editor/p/san-jose/pantallas/inicio', 'san-jose').id).toBe('pantallas');
    expect(seccionDeRuta('/editor/p/san-jose/no-existe', 'san-jose').id).toBe('resumen');
    expect(seccionDeRuta('/otra/cosa', 'san-jose').id).toBe('resumen');
  });

  it('arma el href de cada sección', () => {
    expect(hrefSeccion('san-jose', 'resumen')).toBe('/editor/p/san-jose');
    expect(hrefSeccion('san-jose', 'avisos')).toBe('/editor/p/san-jose/avisos');
  });
});

describe('mensajes de error', () => {
  it('saca el bloque de la ruta del mensaje', () => {
    expect(bloqueDeError('Falta la descripción de la imagen (galeria[2].alt).')).toBe('galeria');
    expect(bloqueDeError('El color principal (colores.principal) debe tener la forma #rrggbb.')).toBe('colores');
    expect(bloqueDeError('La configuración no es un objeto válido.')).toBeNull();
    expect(bloqueDeError('El slug (slug) no coincide con el de la dirección de esta página.')).toBeNull();
  });

  it('salta los paréntesis que no son rutas de un bloque, como «(alt)»', () => {
    expect(bloqueDeError('Falta la descripción (alt) de el logo blanco (logos.blanco).')).toBe('logos');
  });

  it('quita la ruta entre paréntesis', () => {
    expect(limpiarMensaje('Falta el lugar (lugar).')).toBe('Falta el lugar.');
    expect(limpiarMensaje('La fecha de inicio (avisos[0].desde) no puede ser posterior al fin (avisos[0].hasta).')).toBe(
      'La fecha de inicio no puede ser posterior al fin.',
    );
  });

  it('conserva «(alt)», que es parte del texto y no una ruta', () => {
    expect(limpiarMensaje('Falta la descripción (alt) de el logo blanco (logos.blanco).')).toBe(
      'Falta la descripción (alt) de el logo blanco.',
    );
  });
});
