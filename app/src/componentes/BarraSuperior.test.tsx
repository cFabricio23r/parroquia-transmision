import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import BarraSuperior from './BarraSuperior';

async function textos(fase: 'iniciando' | 'en_vivo') {
  const raiz = createRoot();
  await act(async () => {
    raiz.render(
      <BarraSuperior
        fase={fase}
        segundos={0}
        cuentaFinal={null}
        mbps={null}
        ajustesDisponible
        onAjustes={jest.fn()}
        onTerminar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );
  });
  const t: string[] = [];
  const ir = (n: unknown) => {
    if (typeof n === 'string') t.push(n);
    else if (n && typeof n === 'object' && 'children' in n) (n as TestInstance).children.forEach(ir);
  };
  ir(raiz.container);
  return t.join(' | ');
}

describe('BarraSuperior', () => {
  it('mientras espera que se cree el vivo muestra «Preparando Facebook…» como texto visible', async () => {
    const texto = await textos('iniciando');
    expect(texto).toContain('Preparando Facebook…');
    expect(texto).not.toContain('Conectando con Facebook');
  });
});
