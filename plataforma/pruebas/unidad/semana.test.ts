import { describe, expect, it } from 'vitest';
import { SEMANA } from '../../lib/semana';

describe('lib/semana', () => {
  it('expone el núcleo compartido de vicaria/semana.js', () => {
    expect(SEMANA.lunesDe('2026-11-15')).toBe('2026-11-09');
    expect(SEMANA.textoEstado(2)).toBe('● Faltan 2 datos');
  });
});
