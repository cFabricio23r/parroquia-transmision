import { crearControlAbrir } from './abrir';

describe('crearControlAbrir', () => {
  it('sin parroquia no corre', () => {
    expect(crearControlAbrir().debeCorrer(null)).toBe(false);
  });

  const nada = () => Promise.resolve();

  it('corre la primera vez y no repite para la misma parroquia en la misma entrada', () => {
    const c = crearControlAbrir();
    expect(c.debeCorrer('p-a')).toBe(true);
    void c.correr('p-a', nada);
    expect(c.debeCorrer('p-a')).toBe(false);
  });

  it('después de salir de lista (cerrar sesión y entrar con otra cuenta) vuelve a correr', () => {
    const c = crearControlAbrir();
    void c.correr('p-a', nada);
    c.olvidar();
    expect(c.debeCorrer('p-a')).toBe(true);
  });

  it('correr marca la parroquia y no repite en la misma entrada', async () => {
    const c = crearControlAbrir();
    const fn = jest.fn(() => Promise.resolve());
    await c.correr('p-a', fn);
    expect(c.debeCorrer('p-a')).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('si la de A sigue en vuelo, la de B espera a que termine y corre la suya', async () => {
    const c = crearControlAbrir();
    const orden: string[] = [];
    let terminarA: () => void = () => undefined;
    const a = c.correr('p-a', () => {
      orden.push('A empieza');
      return new Promise<void>((r) => {
        terminarA = () => {
          orden.push('A termina');
          r();
        };
      });
    });
    c.olvidar();
    const b = c.correr('p-b', async () => {
      orden.push('B empieza');
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(orden).toEqual(['A empieza']);
    terminarA();
    await Promise.all([a, b]);
    expect(orden).toEqual(['A empieza', 'A termina', 'B empieza']);
  });

  it('si una corrida rechaza, la siguiente corre igual', async () => {
    const c = crearControlAbrir();
    await c.correr('p-a', () => Promise.reject(new Error('x'))).catch(() => undefined);
    const fn = jest.fn(() => Promise.resolve());
    await c.correr('p-b', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('con otra parroquia elegida vuelve a correr', () => {
    const c = crearControlAbrir();
    void c.correr('p-a', nada);
    expect(c.debeCorrer('p-b')).toBe(true);
  });
});
