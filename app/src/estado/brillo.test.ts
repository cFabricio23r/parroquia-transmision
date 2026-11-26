import { BAJO, ESPERA_MS, SISTEMA, crearAtenuador } from './brillo';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function crear() {
  const aplicar = jest.fn<void, [number]>();
  const alCambiar = jest.fn<void, [boolean]>();
  return { aplicar, alCambiar, a: crearAtenuador(aplicar, alCambiar) };
}

describe('crearAtenuador', () => {
  it('activar(true) aplica BAJO a los 30 s, no antes', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    jest.advanceTimersByTime(ESPERA_MS - 1);
    expect(aplicar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(aplicar).toHaveBeenCalledWith(BAJO);
  });

  it('un tocar() a los 20 s reinicia la espera', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    jest.advanceTimersByTime(20_000);
    expect(a.tocar()).toBe(false);
    jest.advanceTimersByTime(ESPERA_MS - 1);
    expect(aplicar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(aplicar).toHaveBeenCalledWith(BAJO);
  });

  it('atenuado, tocar() devuelve true y aplica SISTEMA; sin atenuar devuelve false', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    expect(a.tocar()).toBe(false);
    expect(aplicar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(ESPERA_MS);
    aplicar.mockClear();
    expect(a.tocar()).toBe(true);
    expect(aplicar).toHaveBeenCalledWith(SISTEMA);
    // El toque que despertó ya pasó: el siguiente es un toque normal.
    expect(a.tocar()).toBe(false);
  });

  it('después de despertar vuelve a atenuar a los 30 s', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    jest.advanceTimersByTime(ESPERA_MS);
    a.tocar();
    aplicar.mockClear();
    jest.advanceTimersByTime(ESPERA_MS);
    expect(aplicar).toHaveBeenCalledWith(BAJO);
  });

  it('activar(false) aplica SISTEMA y no vuelve a atenuar', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    jest.advanceTimersByTime(ESPERA_MS);
    aplicar.mockClear();
    a.activar(false);
    expect(aplicar).toHaveBeenCalledWith(SISTEMA);
    aplicar.mockClear();
    jest.advanceTimersByTime(ESPERA_MS * 3);
    expect(aplicar).not.toHaveBeenCalled();
    expect(a.tocar()).toBe(false);
  });

  it('activar(false) con el temporizador corriendo lo cancela', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    jest.advanceTimersByTime(10_000);
    a.activar(false);
    aplicar.mockClear();
    jest.advanceTimersByTime(ESPERA_MS * 2);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('activar(true) dos veces no duplica el temporizador', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    a.activar(true);
    jest.advanceTimersByTime(ESPERA_MS);
    expect(aplicar).toHaveBeenCalledTimes(1);
  });

  it('soltar() cancela el temporizador', () => {
    const { aplicar, a } = crear();
    a.activar(true);
    a.soltar();
    jest.advanceTimersByTime(ESPERA_MS * 2);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('alCambiar avisa true al atenuar y false al despertar o al salir del aire', () => {
    const { alCambiar, a } = crear();
    a.activar(true);
    expect(alCambiar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(ESPERA_MS);
    expect(alCambiar).toHaveBeenLastCalledWith(true);
    a.tocar();
    expect(alCambiar).toHaveBeenLastCalledWith(false);
    jest.advanceTimersByTime(ESPERA_MS);
    expect(alCambiar).toHaveBeenLastCalledWith(true);
    a.activar(false);
    expect(alCambiar).toHaveBeenLastCalledWith(false);
    expect(alCambiar).toHaveBeenCalledTimes(4);
  });

  it('activar(false) sin atenuar no avisa', () => {
    const { alCambiar, a } = crear();
    a.activar(true);
    a.activar(false);
    expect(alCambiar).not.toHaveBeenCalled();
  });
});
