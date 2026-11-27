import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import ElegirPaginas, { alternar } from './ElegirPaginas';

const EXTRAS = [
  { id: 'e1', nombre: 'Vicaría Ciudad Arce', porDefecto: true },
  { id: 'e2', nombre: 'Sector 3', porDefecto: false },
  { id: 'e3', nombre: 'Sector 5', porDefecto: false },
];

async function mostrar(
  o: {
    elegidas?: string[];
    onCambiar?: (ids: string[]) => void;
    onListo?: () => void;
    textos?: { titulo: string; descripcion: string };
    onCambiarTextos?: (t: { titulo: string; descripcion: string }) => void;
  } = {},
) {
  const raiz = createRoot();
  const onCambiar = o.onCambiar ?? jest.fn();
  const onListo = o.onListo ?? jest.fn();
  const onCambiarTextos = o.onCambiarTextos ?? jest.fn();
  await act(async () => {
    raiz.render(
      <ElegirPaginas
        visible
        principal={{ id: 'p1', nombre: 'Parroquia Ciudad Arce' }}
        extras={EXTRAS}
        elegidas={o.elegidas ?? ['e1']}
        onCambiar={onCambiar}
        onListo={onListo}
        textos={o.textos ?? { titulo: 'Misa dominical · Inmaculada', descripcion: '' }}
        onCambiarTextos={onCambiarTextos}
        onCerrar={jest.fn()}
      />,
    );
  });
  const casillas = () => raiz.container.queryAll((i: TestInstance) => i.props.accessibilityRole === 'checkbox');
  const textos = () => {
    const t: string[] = [];
    const ir = (n: unknown) => {
      if (typeof n === 'string') t.push(n);
      else if (n && typeof n === 'object' && 'children' in n) (n as TestInstance).children.forEach(ir);
    };
    ir(raiz.container);
    return t.join(' | ');
  };
  return { raiz, casillas, textos, onCambiar, onListo, onCambiarTextos };
}

describe('alternar', () => {
  it('suma la que no estaba, quita la que estaba y no toca la lista de entrada', () => {
    const antes = ['e1'];
    expect(alternar(antes, 'e2')).toEqual(['e1', 'e2']);
    expect(alternar(['e1', 'e2'], 'e1')).toEqual(['e2']);
    expect(antes).toEqual(['e1']);
  });
});

describe('ElegirPaginas', () => {
  it('muestra los textos del lienzo y la principal sin casilla', async () => {
    const { casillas, textos } = await mostrar();
    const t = textos();
    expect(t).toContain('Dónde sale en Facebook');
    expect(t).toContain('PÁGINA PRINCIPAL');
    expect(t).toContain('Parroquia Ciudad Arce');
    expect(t).toContain('La elige el coordinador de la parroquia en la plataforma.');
    expect(t).toContain('TAMBIÉN MOSTRAR EN');
    expect(t).toContain('Listo');
    // Una casilla por extra, ninguna para la principal.
    expect(casillas()).toHaveLength(EXTRAS.length);
    expect(t).toContain('Marcada por defecto');
  });

  it('cada casilla es un checkbox con su estado marcado', async () => {
    const { casillas } = await mostrar({ elegidas: ['e1', 'e3'] });
    expect(casillas().map((c) => c.props.accessibilityState)).toEqual([{ checked: true }, { checked: false }, { checked: true }]);
    expect(casillas().map((c) => c.props.accessibilityLabel)).toEqual(['Vicaría Ciudad Arce', 'Sector 3', 'Sector 5']);
  });

  it('tocar una casilla cambia la elección', async () => {
    const onCambiar = jest.fn();
    const { casillas } = await mostrar({ elegidas: ['e1'], onCambiar });
    await act(async () => {
      casillas()[1].props.onClick({});
    });
    expect(onCambiar).toHaveBeenLastCalledWith(['e1', 'e2']);
    await act(async () => {
      casillas()[0].props.onClick({});
    });
    expect(onCambiar).toHaveBeenLastCalledWith([]);
  });

  it('«Listo» cierra la hoja', async () => {
    const onListo = jest.fn();
    const { raiz } = await mostrar({ onListo });
    const listo = raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === 'Listo')[0];
    await act(async () => {
      listo.props.onClick({});
    });
    expect(onListo).toHaveBeenCalledTimes(1);
  });

  it('muestra el título y la descripción; sin descripción dice «Sin descripción»', async () => {
    const con = await mostrar({ textos: { titulo: 'Alborada Sector 8', descripcion: 'Mañanitas y rosario' } });
    expect(con.textos()).toContain('TÍTULO EN FACEBOOK');
    expect(con.textos()).toContain('Alborada Sector 8');
    expect(con.textos()).toContain('DESCRIPCIÓN');
    expect(con.textos()).toContain('Mañanitas y rosario');
    expect(con.textos()).toContain('Lo que cambies aquí vale solo para esta transmisión.');
    const sin = await mostrar();
    expect(sin.textos()).toContain('Sin descripción');
  });

  it('«Cambiar» abre los campos con sus topes y «Listo» los devuelve tal cual', async () => {
    const onCambiarTextos = jest.fn();
    const { raiz } = await mostrar({ textos: { titulo: 'Misa', descripcion: 'Hola' }, onCambiarTextos });
    const cambiar = raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === 'Cambiar el título y la descripción')[0];
    await act(async () => {
      cambiar.props.onClick({});
    });
    const campo = (l: string) => raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === l && typeof i.props.onChangeText === 'function')[0];
    expect(campo('Título').props.value).toBe('Misa');
    expect(campo('Título').props.maxLength).toBe(254);
    expect(campo('Descripción').props.value).toBe('Hola');
    expect(campo('Descripción').props.maxLength).toBe(1000);
    await act(async () => {
      campo('Título').props.onChangeText(' Misa nueva ');
    });
    await act(async () => {
      campo('Descripción').props.onChangeText('');
    });
    const listo = raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === 'Listo con el título y la descripción')[0];
    await act(async () => {
      listo.props.onClick({});
    });
    expect(onCambiarTextos).toHaveBeenCalledWith({ titulo: ' Misa nueva ', descripcion: '' });
  });

  it('las zonas para tocar miden 44 px o más', async () => {
    const { raiz, casillas } = await mostrar();
    const listo = raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === 'Listo')[0];
    const cambiar = raiz.container.queryAll((i: TestInstance) => i.props.accessibilityLabel === 'Cambiar el título y la descripción')[0];
    expect(cambiar).toBeDefined();
    const alto = (i: TestInstance) => {
      const e = ([] as unknown[]).concat(i.props.style).flat(Infinity).filter(Boolean) as { minHeight?: number }[];
      return Math.max(...e.map((s) => s.minHeight ?? 0));
    };
    for (const c of [...casillas(), listo, cambiar]) expect(alto(c)).toBeGreaterThanOrEqual(44);
  });
});
