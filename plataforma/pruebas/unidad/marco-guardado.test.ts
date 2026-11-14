// El texto del estado del guardado en el encabezado (Decisión 6; ronda 2: formularios sin guardar).
import { describe, expect, it } from 'vitest';
import { textoGuardado } from '../../app/editor/p/[slug]/MarcoEditor';

describe('textoGuardado', () => {
  it('estados de la máquina', () => {
    expect(textoGuardado('guardado')).toBe('Guardado');
    expect(textoGuardado('pendiente')).toBe('Guardando…');
    expect(textoGuardado('guardando')).toBe('Guardando…');
    expect(textoGuardado('rechazado')).toBe('Sin guardar');
  });
  it('un formulario sin guardar gana sobre «Guardado»', () => {
    expect(textoGuardado('guardado', true)).toBe('Sin guardar');
    expect(textoGuardado('guardando', true)).toBe('Sin guardar');
  });
});
