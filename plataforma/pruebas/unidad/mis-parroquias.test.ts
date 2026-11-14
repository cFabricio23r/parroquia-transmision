import { describe, expect, it } from 'vitest';
import { ultimaVersionPorParroquia } from '../../lib/mis-parroquias';

describe('ultimaVersionPorParroquia', () => {
  it('se queda con el número más alto de cada parroquia', () => {
    const m = ultimaVersionPorParroquia([
      { parroquia_id: 'a', numero: 1 },
      { parroquia_id: 'a', numero: 3 },
      { parroquia_id: 'b', numero: 2 },
    ]);
    expect(m.get('a')).toBe(3);
    expect(m.get('b')).toBe(2);
    expect(m.get('c')).toBeUndefined();
    expect(m.size).toBe(2);
  });
});
