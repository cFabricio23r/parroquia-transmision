import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import AntesDeIniciar from './AntesDeIniciar';

async function mostrar(tira: { principal: string; extras: string | null; titulo?: string; onCambiar: () => void } | null) {
  const raiz = createRoot();
  await act(async () => {
    raiz.render(
      <AntesDeIniciar
        vista="lista"
        claveLista
        mensaje={null}
        terminada={false}
        avisos={[]}
        noMolestar={null}
        onActivarNoMolestar={jest.fn()}
        onIniciar={jest.fn()}
        onAjustes={jest.fn()}
        onPrepararOtraVez={jest.fn()}
        onVolverAPreparar={jest.fn()}
        tira={tira}
      />,
    );
  });
  const t: string[] = [];
  const ir = (n: unknown) => {
    if (typeof n === 'string') t.push(n);
    else if (n && typeof n === 'object' && 'children' in n) (n as TestInstance).children.forEach(ir);
  };
  ir(raiz.container);
  return { raiz, texto: t.join(''), boton: raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === 'Cambiar dónde sale en Facebook')[0] };
}

describe('AntesDeIniciar: tira «SALE EN FACEBOOK»', () => {
  it('con principal reemplaza a «clave guardada» y muestra las extras unidas', async () => {
    const onCambiar = jest.fn();
    const { texto, boton } = await mostrar({ principal: 'Parroquia Ciudad Arce', extras: 'Vicaría y Sector 3', onCambiar });
    expect(texto).toContain('SALE EN FACEBOOK');
    expect(texto).toContain('Parroquia Ciudad Arce · y en Vicaría y Sector 3');
    expect(texto).toContain('Cambiar');
    expect(texto).not.toContain('clave guardada');
    await act(async () => {
      boton.props.onClick({});
    });
    expect(onCambiar).toHaveBeenCalledTimes(1);
  });

  it('muestra el título del vivo en la tira', async () => {
    const { texto } = await mostrar({ principal: 'Parroquia Ciudad Arce', extras: null, titulo: 'Alborada Sector 8', onCambiar: jest.fn() });
    expect(texto).toContain('Alborada Sector 8');
  });

  it('sin extras elegidas no dice «y en»', async () => {
    const { texto } = await mostrar({ principal: 'Parroquia Ciudad Arce', extras: null, onCambiar: jest.fn() });
    expect(texto).toContain('Parroquia Ciudad Arce');
    expect(texto).not.toContain('y en');
  });

  it('sin tira (sin Facebook directo) queda la línea de siempre', async () => {
    const { texto, boton } = await mostrar(null);
    expect(texto).toContain('✓ Facebook: clave guardada');
    expect(texto).not.toContain('SALE EN FACEBOOK');
    expect(boton).toBeUndefined();
  });
});
