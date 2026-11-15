// Revisión fix2 (hallazgo 4): al enviar con errores, el foco va al primer campo inválido.
import { describe, expect, it, vi } from 'vitest';
import { SELECTOR_INVALIDO, enfocarPrimerInvalido } from '../../app/componentes/useEnfocarInvalido';

describe('enfocarPrimerInvalido', () => {
  it('busca el primer aria-invalid="true" de la raíz y le da el foco', () => {
    const campo = { focus: vi.fn() };
    const raiz = { querySelector: vi.fn(() => campo) };
    expect(enfocarPrimerInvalido(raiz as never)).toBe(true);
    expect(raiz.querySelector).toHaveBeenCalledWith(SELECTOR_INVALIDO);
    expect(SELECTOR_INVALIDO).toBe('[aria-invalid="true"]');
    expect(campo.focus).toHaveBeenCalledOnce();
  });

  it('sin campos inválidos (o sin raíz) no hace nada', () => {
    expect(enfocarPrimerInvalido({ querySelector: () => null } as never)).toBe(false);
    expect(enfocarPrimerInvalido(null)).toBe(false);
  });
});
