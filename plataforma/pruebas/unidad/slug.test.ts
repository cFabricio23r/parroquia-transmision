import { describe, expect, it } from 'vitest';
import { revisarSlug } from '../../lib/slug';

describe('revisarSlug', () => {
  const repo = ['ciudad-arce', 'san-jose-ejemplo'];

  it('rechaza reservados, los del repo, mayúsculas, muy corto y guiones dobles', () => {
    for (const malo of ['editor', 'api', 'auth', '_next', 'fuentes', 'img', 'medios', 'ciudad-arce', 'Ciudad-Arce', 'ab-', 'a', 'ab', 'a--b', 'x'.repeat(41)]) {
      expect(revisarSlug(malo, repo), malo).toEqual(expect.any(String));
    }
  });

  it('acepta san-pedro-apostol y abc', () => {
    expect(revisarSlug('san-pedro-apostol', repo)).toBeNull();
    expect(revisarSlug('abc', repo)).toBeNull();
  });
});
