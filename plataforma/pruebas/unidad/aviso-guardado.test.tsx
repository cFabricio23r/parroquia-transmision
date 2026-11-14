// Textos del aviso de guardado (plan 3, Tarea 10; Decisión 8).
import { describe, expect, it } from 'vitest';
import { TEXTO_RECHAZADO, textoConflicto } from '../../app/editor/p/[slug]/AvisoGuardado';

describe('textoConflicto', () => {
  it('si la sección actual tiene un bloque en conflicto dice «esta sección»', () => {
    expect(textoConflicto(['lugar'], 'identidad')).toBe('Otra persona cambió esta sección mientras editabas.');
  });
  it('si no, nombra la sección del bloque en conflicto', () => {
    expect(textoConflicto(['galeria'], 'identidad')).toBe('Otra persona cambió Galería mientras editabas.');
  });
  it('con bloques de varias secciones las nombra a todas, sin repetir', () => {
    expect(textoConflicto(['horarios', 'redes', 'avisos'], 'galeria')).toBe('Otra persona cambió Horarios y redes y Avisos fijos mientras editabas.');
  });
  it('el texto del rechazo', () => {
    expect(TEXTO_RECHAZADO).toBe('No se pudo guardar: hay datos que no tienen la forma correcta.');
  });
});
