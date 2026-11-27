// Controles al aire: micrófono (2026-11-27) y botones con íconos en vez de texto (2026-11-27, pedido del
// usuario: «pantalla completa» y «micrófono» ocupaban mucho; el zoom, un poco más chico).
import { act } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';

import ControlesCamara from './ControlesCamara';

async function montar(silenciado: boolean, completa = false, conZoom = false) {
  const onSilenciar = jest.fn();
  const onCompleta = jest.fn();
  const raiz = createRoot();
  await act(async () => {
    raiz.render(
      <ControlesCamara
        rango={conZoom ? { min: 1, max: 5 } : null}
        zoom={1}
        onZoom={jest.fn()}
        completa={completa}
        onCompleta={onCompleta}
        fase="en_vivo"
        segundos={0}
        fps={30}
        silenciado={silenciado}
        onSilenciar={onSilenciar}
      />,
    );
  });
  const textos: string[] = [];
  const botones: TestInstance[] = [];
  const ir = (n: unknown) => {
    if (typeof n === 'string') textos.push(n);
    else if (n && typeof n === 'object' && 'children' in n) {
      const i = n as TestInstance;
      if (i.props?.accessibilityRole === 'button') botones.push(i);
      i.children.forEach(ir);
    }
  };
  ir(raiz.container);
  const boton = (re: RegExp) => botones.find((b) => re.test(String(b.props.accessibilityLabel)));
  return {
    texto: textos.join(' | '),
    microfono: boton(/micrófono/i),
    completa: boton(/pantalla completa/i),
    acercar: boton(/^Acercar$/),
    nivel: boton(/^Zoom /),
    onSilenciar,
    onCompleta,
  };
}

const medidas = (b: TestInstance | undefined) => StyleSheet.flatten(b?.props.style) as { width?: number; height?: number };

describe('ControlesCamara: micrófono', () => {
  it('con el micrófono abierto: ícono sin texto, con nombre accesible, que lo silencia', async () => {
    const { texto, microfono, onSilenciar } = await montar(false);
    expect(texto).not.toContain('Micrófono');
    expect(microfono?.props.accessibilityLabel).toBe('Silenciar el micrófono');
    expect(microfono?.props.accessibilityState).toEqual({ selected: false });
    act(() => microfono?.props.onClick({}));
    expect(onSilenciar).toHaveBeenCalledWith(true);
  });

  it('silenciado: «Activar el micrófono», y tocar lo vuelve a abrir', async () => {
    const { texto, microfono, onSilenciar } = await montar(true);
    expect(texto).not.toContain('Micrófono apagado');
    expect(microfono?.props.accessibilityLabel).toBe('Activar el micrófono');
    expect(microfono?.props.accessibilityState).toEqual({ selected: true });
    act(() => microfono?.props.onClick({}));
    expect(onSilenciar).toHaveBeenCalledWith(false);
  });

  it('en pantalla completa, silenciado, la barra mínima avisa «SIN SONIDO»', async () => {
    expect((await montar(true, true)).texto).toContain('SIN SONIDO');
    expect((await montar(false, true)).texto).not.toContain('SIN SONIDO');
  });
});

describe('ControlesCamara: íconos y tamaños', () => {
  it('pantalla completa es un ícono sin texto que alterna', async () => {
    const fuera = await montar(false);
    expect(fuera.texto).not.toContain('Pantalla completa');
    expect(fuera.completa?.props.accessibilityLabel).toBe('Pantalla completa');
    act(() => fuera.completa?.props.onClick({}));
    expect(fuera.onCompleta).toHaveBeenCalledWith(true);

    const dentro = await montar(false, true);
    expect(dentro.texto).not.toContain('Salir');
    expect(dentro.completa?.props.accessibilityLabel).toBe('Salir de pantalla completa');
  });

  it('los botones de ícono miden 44×44 (el mínimo táctil)', async () => {
    const { microfono, completa } = await montar(false);
    expect(medidas(microfono)).toMatchObject({ width: 44, height: 44 });
    expect(medidas(completa)).toMatchObject({ width: 44, height: 44 });
  });

  it('el zoom es más chico que antes (48) sin bajar de 44', async () => {
    const { acercar, nivel } = await montar(false, false, true);
    expect(medidas(acercar)).toMatchObject({ width: 44, height: 44 });
    expect(medidas(nivel).height).toBe(44);
  });
});
