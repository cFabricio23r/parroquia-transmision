// Orden de la tira (Tarea 9d): Producción va después de Gracias, igual en Preparar y En vivo.
import { ESCENAS, ESCENAS_PREPARAR } from './TiraEscenas';
import { ESCENAS_VALIDAS } from '../estado/transmision';

describe('tira de escenas', () => {
  it('Producción va última, después de Gracias', () => {
    expect(ESCENAS.map((e) => e.id)).toEqual(['inicio', 'camara', 'portada', 'avisos', 'gracias', 'produccion']);
    expect(ESCENAS[ESCENAS.length - 1].nombre).toBe('Producción');
  });

  it('Preparar y En vivo usan el mismo orden', () => {
    expect(ESCENAS_PREPARAR.map((e) => e.id)).toEqual(ESCENAS.map((e) => e.id));
  });

  it('tiene todas las escenas válidas, sin repetir', () => {
    expect([...ESCENAS.map((e) => e.id)].sort()).toEqual([...ESCENAS_VALIDAS].sort());
  });
});
