import { crearGuardia, guardiaEnVivo } from './guardia';

describe('guardia en vivo', () => {
  it('empieza fuera del vivo', () => {
    expect(crearGuardia().enVivo()).toBe(false);
    expect(guardiaEnVivo.enVivo()).toBe(false);
  });

  it('fijar cambia lo que dice enVivo', () => {
    const g = crearGuardia();
    g.fijar(true);
    expect(g.enVivo()).toBe(true);
    g.fijar(false);
    expect(g.enVivo()).toBe(false);
  });

  it('alTerminar fuera del vivo llama a fn enseguida', () => {
    const g = crearGuardia();
    const fn = jest.fn();
    g.alTerminar(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('en vivo la guarda y la llama una sola vez al terminar', () => {
    const g = crearGuardia();
    g.fijar(true);
    const fn = jest.fn();
    g.alTerminar(fn);
    expect(fn).not.toHaveBeenCalled();
    g.fijar(true);
    expect(fn).not.toHaveBeenCalled();
    g.fijar(false);
    expect(fn).toHaveBeenCalledTimes(1);
    g.fijar(false);
    g.fijar(true);
    g.fijar(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('la función que devuelve alTerminar la cancela', () => {
    const g = crearGuardia();
    g.fijar(true);
    const fn = jest.fn();
    const cancelar = g.alTerminar(fn);
    cancelar();
    g.fijar(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('una que lanza no corta a las demás', () => {
    const g = crearGuardia();
    g.fijar(true);
    const otra = jest.fn();
    g.alTerminar(() => {
      throw new Error('x');
    });
    g.alTerminar(otra);
    g.fijar(false);
    expect(otra).toHaveBeenCalledTimes(1);
  });
});
