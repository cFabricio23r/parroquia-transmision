// Tests de la cola de escenas: una transición a la vez y, mientras corre, solo la última pedida.
import { crearColaEscenas } from './escenas';

type Pendiente = { escena: string; fin: () => void; falla: (e: Error) => void };

function armar(inicial: 'camara' | 'inicio' | null = 'camara') {
  const llamadas: Pendiente[] = [];
  const ejecutar = jest.fn(
    (escena: string) =>
      new Promise<void>((fin, falla) => {
        llamadas.push({ escena, fin: () => fin(), falla });
      }),
  );
  const cola = crearColaEscenas(ejecutar, inicial);
  return { cola, ejecutar, llamadas };
}

// Deja correr las promesas encadenadas.
const vaciar = () => new Promise((r) => setTimeout(r, 0));

describe('crearColaEscenas', () => {
  it('pide una transición y resuelve cuando termina', async () => {
    const { cola, ejecutar, llamadas } = armar();
    let listo = false;
    const p = cola.pedir('inicio').then(() => (listo = true));
    await vaciar();
    expect(ejecutar).toHaveBeenCalledWith('inicio');
    expect(listo).toBe(false);
    llamadas[0].fin();
    await p;
    expect(listo).toBe(true);
    expect(cola.actual()).toBe('inicio');
  });

  it('pedir la escena que ya se ve no hace transición', async () => {
    const { cola, ejecutar } = armar('camara');
    await cola.pedir('camara');
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('tres pedidos rápidos: corre el primero y después solo el último', async () => {
    const { cola, ejecutar, llamadas } = armar();
    const p1 = cola.pedir('inicio');
    const p2 = cola.pedir('portada');
    const p3 = cola.pedir('gracias');
    await vaciar();
    expect(ejecutar).toHaveBeenCalledTimes(1);
    llamadas[0].fin();
    await vaciar();
    expect(ejecutar).toHaveBeenCalledTimes(2);
    expect(ejecutar).toHaveBeenLastCalledWith('gracias');
    llamadas[1].fin();
    await Promise.all([p1, p2, p3]);
    expect(ejecutar.mock.calls.map((c) => c[0])).toEqual(['inicio', 'gracias']);
    expect(cola.actual()).toBe('gracias');
  });

  it('los pedidos reemplazados resuelven cuando termina la última transición', async () => {
    const { cola, llamadas } = armar();
    const hechos: string[] = [];
    cola.pedir('inicio').then(() => hechos.push('inicio'));
    cola.pedir('portada').then(() => hechos.push('portada'));
    cola.pedir('avisos').then(() => hechos.push('avisos'));
    await vaciar();
    llamadas[0].fin();
    await vaciar();
    // «inicio» terminó; «portada» fue reemplazada por «avisos», que todavía corre.
    expect(hechos).toEqual(['inicio']);
    llamadas[1].fin();
    await vaciar();
    expect(hechos.sort()).toEqual(['avisos', 'inicio', 'portada']);
  });

  it('si el pendiente es la escena a la que ya va la transición, no hay otra', async () => {
    const { cola, ejecutar, llamadas } = armar();
    const p1 = cola.pedir('inicio');
    const p2 = cola.pedir('portada');
    const p3 = cola.pedir('inicio');
    await vaciar();
    llamadas[0].fin();
    await Promise.all([p1, p2, p3]);
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(cola.actual()).toBe('inicio');
  });

  it('una falla rechaza a quien esperaba esa transición y sigue con el pendiente', async () => {
    const { cola, ejecutar, llamadas } = armar();
    const p1 = cola.pedir('inicio');
    const p2 = cola.pedir('gracias');
    await vaciar();
    llamadas[0].falla(new Error('nativo'));
    await expect(p1).rejects.toThrow('nativo');
    await vaciar();
    expect(ejecutar).toHaveBeenLastCalledWith('gracias');
    llamadas[1].fin();
    await expect(p2).resolves.toBeUndefined();
    expect(cola.actual()).toBe('gracias');
  });

  it('tras una falla la escena actual no cambia', async () => {
    const { cola, llamadas } = armar('camara');
    const p = cola.pedir('inicio');
    await vaciar();
    llamadas[0].falla(new Error('x'));
    await expect(p).rejects.toThrow();
    expect(cola.actual()).toBe('camara');
  });

  it('sin escena inicial conocida, el primer pedido siempre va al nativo', async () => {
    // Tras recargar el JS, el nativo puede seguir mostrando otra escena.
    const { cola, ejecutar, llamadas } = armar(null);
    expect(cola.actual()).toBeNull();
    const p = cola.pedir('camara');
    await vaciar();
    expect(ejecutar).toHaveBeenCalledWith('camara');
    llamadas[0].fin();
    await p;
    expect(cola.actual()).toBe('camara');
  });

  it('después de terminar, un pedido nuevo corre enseguida', async () => {
    const { cola, ejecutar, llamadas } = armar();
    const p1 = cola.pedir('inicio');
    await vaciar();
    llamadas[0].fin();
    await p1;
    const p2 = cola.pedir('camara');
    await vaciar();
    expect(ejecutar).toHaveBeenLastCalledWith('camara');
    llamadas[1].fin();
    await p2;
    expect(cola.actual()).toBe('camara');
  });

  it('si ejecutar lanza de forma síncrona, ese pedido rechaza y la cola sigue (review I1)', async () => {
    const llamadas: Array<{ escena: string; fin: () => void }> = [];
    let primera = true;
    const ejecutar = jest.fn((escena: string) => {
      if (primera) {
        primera = false;
        throw new TypeError('not a function');
      }
      return new Promise<void>((fin) => llamadas.push({ escena, fin: () => fin() }));
    });
    const cola = crearColaEscenas(ejecutar, 'camara');
    await expect(cola.pedir('inicio')).rejects.toThrow('not a function');
    const p2 = cola.pedir('gracias');
    await vaciar();
    expect(ejecutar).toHaveBeenLastCalledWith('gracias');
    llamadas[0].fin();
    await expect(p2).resolves.toBeUndefined();
    expect(cola.actual()).toBe('gracias');
  });

  it('un throw síncrono al encadenar el pendiente no deja esperas colgadas', async () => {
    const llamadas: Array<() => void> = [];
    let n = 0;
    const ejecutar = jest.fn((_escena: string) => {
      n++;
      if (n === 2) throw new Error('sync');
      return new Promise<void>((fin) => llamadas.push(() => fin()));
    });
    const cola = crearColaEscenas(ejecutar, 'camara');
    const p1 = cola.pedir('inicio');
    const p2 = cola.pedir('gracias');
    await vaciar();
    llamadas[0]();
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).rejects.toThrow('sync');
    expect(cola.actual()).toBe('inicio');
  });

  it('una falla en la transición que absorbió pedidos rechaza a todos', async () => {
    const { cola, ejecutar, llamadas } = armar();
    const p1 = cola.pedir('inicio');
    const p2 = cola.pedir('portada');
    const p3 = cola.pedir('inicio');
    await vaciar();
    llamadas[0].falla(new Error('nativo'));
    await expect(p1).rejects.toThrow('nativo');
    await expect(p2).rejects.toThrow('nativo');
    await expect(p3).rejects.toThrow('nativo');
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(cola.actual()).toBe('camara');
  });

  it('una falla con el pendiente igual a la escena actual resuelve el pendiente sin llamar al nativo', async () => {
    const { cola, ejecutar, llamadas } = armar('camara');
    const p1 = cola.pedir('inicio');
    const p2 = cola.pedir('camara');
    await vaciar();
    llamadas[0].falla(new Error('nativo'));
    await expect(p1).rejects.toThrow('nativo');
    await expect(p2).resolves.toBeUndefined();
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(cola.actual()).toBe('camara');
  });
});
