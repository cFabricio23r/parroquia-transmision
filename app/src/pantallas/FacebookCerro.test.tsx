import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import FacebookCerro from './FacebookCerro';

async function mostrar() {
  const raiz = createRoot();
  const onTerminar = jest.fn();
  const onIniciarNueva = jest.fn();
  await act(async () => {
    raiz.render(<FacebookCerro visible onTerminar={onTerminar} onIniciarNueva={onIniciarNueva} />);
  });
  const boton = (etiqueta: string) =>
    raiz.container.queryAll((i: TestInstance) => i.props.accessibilityRole === 'button' && i.props.accessibilityLabel === etiqueta)[0];
  return { raiz, boton, onTerminar, onIniciarNueva };
}

describe('FacebookCerro', () => {
  it('muestra los textos del lienzo', async () => {
    const { raiz } = await mostrar();
    const t: string[] = [];
    const ir = (n: unknown) => {
      if (typeof n === 'string') t.push(n);
      else if (n && typeof n === 'object' && 'children' in n) (n as TestInstance).children.forEach(ir);
    };
    ir(raiz.container);
    const texto = t.join(' | ');
    expect(texto).toContain('Facebook cerró la transmisión');
    expect(texto).toContain('La señal estuvo caída mucho tiempo. Si sigues, sale una publicación nueva en la página.');
    expect(texto).toContain('Terminar');
    expect(texto).toContain('Iniciar una nueva');
    expect(texto).toContain('Nunca se crea una transmisión nueva sin este toque.');
  });

  it('«Terminar» no inicia nada y «Iniciar una nueva» solo avisa a quien llama', async () => {
    const { boton, onTerminar, onIniciarNueva } = await mostrar();
    await act(async () => {
      boton('Terminar').props.onClick({});
    });
    expect(onTerminar).toHaveBeenCalledTimes(1);
    expect(onIniciarNueva).not.toHaveBeenCalled();
    await act(async () => {
      boton('Iniciar una nueva').props.onClick({});
    });
    expect(onIniciarNueva).toHaveBeenCalledTimes(1);
  });
});
