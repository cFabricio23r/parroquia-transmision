import { describe, expect, it } from 'vitest';
import type { EstadoSeccion, Problema } from '../../lib/editor/estados';
import { LINKS_OBS } from '../../lib/editor/links-obs';
import {
  LINKS_OBS_PUBLICAR,
  NOTA_VERSIONES,
  revisarParaPublicar,
  siguienteVersion,
  textoBloqueo,
} from '../../lib/editor/revision';
import { SECCIONES, type IdSeccion } from '../../lib/editor/secciones';

type Ids = Exclude<IdSeccion, 'publicar'>;

function estados(cambios: Partial<Record<Ids, Partial<EstadoSeccion>>> = {}): Record<Ids, EstadoSeccion> {
  const r = {} as Record<Ids, EstadoSeccion>;
  for (const s of SECCIONES) {
    if (s.id === 'publicar') continue;
    r[s.id] = { estado: 'listo', frase: '', errores: [], avisos: [], ...cambios[s.id] };
  }
  return r;
}

const problema = (seccion: IdSeccion, titulo: string, detalle: string): Problema => ({ seccion, titulo, detalle });

describe('revisión de F12', () => {
  it('errores de sección primero, en rojo, con «Corregir en …»; los avisos al final, en ámbar', () => {
    const r = revisarParaPublicar(
      estados({
        galeria: { errores: [problema('galeria', 'Fondo navideño no tiene descripción', 'Sin la descripción (alt) no se puede publicar.')] },
        rotulos: { avisos: [problema('rotulos', 'El acento como fondo de rótulo tiene poco contraste', 'Detalle.')] },
      }),
      [],
    );
    expect(r.errores[0]).toEqual({
      titulo: 'Fondo navideño no tiene descripción',
      detalle: 'Sin la descripción (alt) no se puede publicar.',
      seccion: 'galeria',
      enlace: 'Corregir en Galería',
      tono: 'rojo',
    });
    expect(r.avisos[0].enlace).toBe('Ver Rótulos y estilo');
    expect(r.avisos[0].tono).toBe('ambar');
  });

  it('los errores en el orden del menú', () => {
    const r = revisarParaPublicar(
      estados({
        galeria: { errores: [problema('galeria', 'G', 'g')] },
        identidad: { errores: [problema('identidad', 'I', 'i')] },
      }),
      [],
    );
    expect(r.errores.map((e) => e.titulo)).toEqual(['I', 'G']);
  });

  it('un error sin bloque va a Resumen, después de los de sección', () => {
    const r = revisarParaPublicar(estados({ galeria: { errores: [problema('galeria', 'G', 'g')] } }), [
      'Falta el lugar (lugar).',
      'El esquema (esquema) debe ser 1.',
    ]);
    expect(r.errores).toHaveLength(2);
    expect(r.errores[1]).toEqual({
      titulo: 'El esquema debe ser 1.',
      detalle: 'Revisa este dato antes de publicar.',
      seccion: 'resumen',
      enlace: 'Ver Resumen',
      tono: 'rojo',
    });
  });

  it('sin nada, las dos listas vacías', () => {
    expect(revisarParaPublicar(estados(), [])).toEqual({ errores: [], avisos: [] });
  });

  it('textoBloqueo en singular y plural', () => {
    expect(textoBloqueo(1)).toBe('Corrige 1 problema para poder publicar.');
    expect(textoBloqueo(3)).toBe('Corrige 3 problemas para poder publicar.');
  });

  it('siguienteVersion cuenta desde la reservada o la mayor publicada (Review Focus 5)', () => {
    expect(siguienteVersion(5, 3)).toBe(6);
    expect(siguienteVersion(null, null)).toBe(1);
    expect(siguienteVersion(0, 2)).toBe(3);
  });

  it('la nota y los links del artboard', () => {
    expect(NOTA_VERSIONES).toBe('«Volver a esta» publica de nuevo esa versión como una nueva; no se borra ninguna.');
    expect(LINKS_OBS_PUBLICAR).toBe(LINKS_OBS);
  });
});
