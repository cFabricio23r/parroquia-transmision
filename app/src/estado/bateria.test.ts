import { leerBateria } from './bateria';

// Constantes de android.os.BatteryManager (javap sobre android-36/android.jar, 2026-11-16):
// UNKNOWN 1, CHARGING 2, DISCHARGING 3, NOT_CHARGING 4, FULL 5.
const base = { nivel: 70, escala: 100, estado: 3, enchufe: 0 };

describe('leerBateria (Tarea 9h)', () => {
  it('nivel sobre escala, de 0 a 1', () => {
    expect(leerBateria(base).nivel).toBe(0.7);
    expect(leerBateria({ ...base, nivel: 69 }).nivel).toBe(0.69);
  });

  it('escala distinta de 100', () => {
    expect(leerBateria({ ...base, nivel: 50, escala: 200 }).nivel).toBe(0.25);
  });

  it('nivel -1, escala -1 o escala 0 dan null', () => {
    expect(leerBateria({ ...base, nivel: -1 }).nivel).toBeNull();
    expect(leerBateria({ ...base, escala: -1 }).nivel).toBeNull();
    expect(leerBateria({ ...base, escala: 0 }).nivel).toBeNull();
  });

  it('sin datos del nativo da todo null', () => {
    expect(leerBateria(null)).toEqual({ nivel: null, cargando: null });
  });

  it('cargando o llena: cargando true', () => {
    expect(leerBateria({ ...base, estado: 2, enchufe: 1 }).cargando).toBe(true);
    expect(leerBateria({ ...base, estado: 5, enchufe: 2 }).cargando).toBe(true);
  });

  it('descargando: cargando false', () => {
    expect(leerBateria({ ...base, estado: 3 }).cargando).toBe(false);
  });

  it('sin cargar: false si está desenchufado, null si está enchufado (carga pausada)', () => {
    expect(leerBateria({ ...base, estado: 4, enchufe: 0 }).cargando).toBe(false);
    expect(leerBateria({ ...base, estado: 4, enchufe: 1 }).cargando).toBeNull();
  });

  it('estado desconocido: cargando null', () => {
    expect(leerBateria({ ...base, estado: 1 }).cargando).toBeNull();
    expect(leerBateria({ ...base, estado: -1 }).cargando).toBeNull();
  });
});
