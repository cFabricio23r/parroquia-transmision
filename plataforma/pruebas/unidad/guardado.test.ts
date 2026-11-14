import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  crearGuardador,
  ESPERA_GUARDADO_MS,
  type DepsGuardador,
  type InstantaneaGuardado,
  type RespuestaHttp,
} from '../../lib/editor/guardado';

type Cuerpo = { cambios: Record<string, unknown>; actualizadoEn: string };
type Pendiente = { cuerpo: Cuerpo; resolver: (r: RespuestaHttp) => void; rechazar: (e: unknown) => void };

function falsas(opciones: { auto?: (c: Cuerpo) => RespuestaHttp; leer?: () => RespuestaHttp } = {}) {
  const envios: Pendiente[] = [];
  const estados: InstantaneaGuardado[] = [];
  const deps: DepsGuardador = {
    guardar: (c) =>
      new Promise((resolver, rechazar) => {
        const p = { cuerpo: c as Cuerpo, resolver, rechazar };
        envios.push(p);
        if (opciones.auto) resolver(opciones.auto(p.cuerpo));
      }),
    leer: async () => (opciones.leer ? opciones.leer() : { estado: 500, cuerpo: {} }),
    programar: (fn, ms) => setTimeout(fn, ms),
    cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    alCambiar: (i) => estados.push(i),
  };
  return { deps, envios, estados };
}

const inicial = { config: { nombre: 'N', lugar: 'L', avisos: [{ texto: 'a' }] }, actualizadoEn: 't1', errores: [] as string[] };
const ok = (t: string): RespuestaHttp => ({ estado: 200, cuerpo: { actualizadoEn: t, errores: [] } });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('guardado automático', () => {
  it('espera 800 ms después del último cambio', async () => {
    const f = falsas();
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    expect(g.instantanea().estado).toBe('pendiente');
    await vi.advanceTimersByTimeAsync(799);
    expect(f.envios).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.envios).toHaveLength(1);
    expect(f.envios[0].cuerpo).toEqual({ cambios: { lugar: 'A' }, actualizadoEn: 't1' });
    expect(g.instantanea().estado).toBe('guardando');
    expect(ESPERA_GUARDADO_MS).toBe(800);
    expect(f.estados.length).toBeGreaterThan(0);
  });

  it('dos cambios seguidos salen en un solo PUT', async () => {
    const f = falsas();
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(500);
    g.cambiar('nombre', 'B');
    await vi.advanceTimersByTimeAsync(799);
    expect(f.envios).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.envios).toHaveLength(1);
    expect(f.envios[0].cuerpo.cambios).toEqual({ nombre: 'B', lugar: 'A' });
  });

  it('con 200 queda guardado con el actualizadoEn y los errores nuevos', async () => {
    const f = falsas({ auto: () => ({ estado: 200, cuerpo: { actualizadoEn: 't2', errores: ['e'] } }) });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    const i = g.instantanea();
    expect(i.estado).toBe('guardado');
    expect(i.actualizadoEn).toBe('t2');
    expect(i.errores).toEqual(['e']);
    expect(g.hayCambiosSinGuardar()).toBe(false);
  });

  it('lo escrito mientras un PUT está en vuelo sale en el siguiente', async () => {
    const f = falsas();
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    g.cambiar('nombre', 'B');
    f.envios[0].resolver(ok('t2'));
    await vi.advanceTimersByTimeAsync(0);
    expect(g.instantanea().estado).toBe('pendiente');
    expect(g.hayCambiosSinGuardar()).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(f.envios).toHaveLength(2);
    expect(f.envios[1].cuerpo).toEqual({ cambios: { nombre: 'B' }, actualizadoEn: 't2' });
  });

  const fallos: [string, RespuestaHttp | null, string][] = [
    ['401', { estado: 401, cuerpo: {} }, 'sesion-cerrada'],
    ['503', { estado: 503, cuerpo: {} }, 'sin-conexion'],
    ['rechazo', null, 'sin-conexion'],
  ];
  for (const [caso, respuesta, estado] of fallos) {
    it(`${caso} deja ${estado}, conserva lo escrito y reintenta en el siguiente cambio`, async () => {
      const f = falsas();
      const g = crearGuardador(inicial, f.deps);
      g.cambiar('lugar', 'A');
      await vi.advanceTimersByTimeAsync(800);
      if (respuesta) f.envios[0].resolver(respuesta);
      else f.envios[0].rechazar(new TypeError('red'));
      await vi.advanceTimersByTimeAsync(0);
      expect(g.instantanea().estado).toBe(estado);
      expect(g.instantanea().local.lugar).toBe('A');
      g.cambiar('nombre', 'B');
      await vi.advanceTimersByTimeAsync(800);
      expect(f.envios).toHaveLength(2);
      expect(f.envios[1].cuerpo.cambios).toEqual({ nombre: 'B', lugar: 'A' });
    });
  }

  it('422 deja rechazado con los errores de forma', async () => {
    const f = falsas({ auto: () => ({ estado: 422, cuerpo: { error: 'x', errores: ['x'] } }) });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    expect(g.instantanea().estado).toBe('rechazado');
    expect(g.instantanea().erroresForma).toEqual(['x']);
  });

  it('403 y otros errores dejan error con el mensaje', async () => {
    const f = falsas({ auto: () => ({ estado: 403, cuerpo: { error: 'Sin permiso' } }) });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    expect(g.instantanea()).toMatchObject({ estado: 'error', mensaje: 'Sin permiso' });
    const f2 = falsas({ auto: () => ({ estado: 500, cuerpo: {} }) });
    const g2 = crearGuardador(inicial, f2.deps);
    g2.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    expect(g2.instantanea()).toMatchObject({ estado: 'error', mensaje: 'No se pudo guardar. Intenta de nuevo.' });
  });

  it('409 con otro bloque cambiado se fusiona y se reenvía solo', async () => {
    const remoto = { config: { lugar: 'L', avisos: [{ texto: 'a' }], nombre: 'Otro nombre' }, actualizadoEn: 't3' };
    let n = 0;
    const f = falsas({
      auto: () => (n++ === 0 ? { estado: 409, cuerpo: { error: 'c' } } : ok('t4')),
      leer: () => ({ estado: 200, cuerpo: remoto }),
    });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.envios).toHaveLength(2);
    expect(f.envios[1].cuerpo).toEqual({ cambios: { lugar: 'A' }, actualizadoEn: 't3' });
    const i = g.instantanea();
    expect(i.estado).toBe('guardado');
    expect(i.local).toMatchObject({ lugar: 'A', nombre: 'Otro nombre' });
  });

  it('409 con el mismo bloque distinto queda en conflicto y no envía más', async () => {
    const remoto = { config: { nombre: 'N', lugar: 'L', avisos: [{ texto: 'suyo' }] }, actualizadoEn: 't3' };
    const f = falsas({ auto: () => ({ estado: 409, cuerpo: {} }), leer: () => ({ estado: 200, cuerpo: remoto }) });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('avisos', [{ texto: 'mío' }]);
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    expect(g.instantanea().estado).toBe('conflicto');
    expect(g.instantanea().conflictos).toEqual(['avisos']);
    g.cambiar('lugar', 'Otro');
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.envios).toHaveLength(1);
    expect(g.instantanea().estado).toBe('conflicto');
  });

  it('«Usar lo mío» envía lo propio con el actualizadoEn remoto', async () => {
    const remoto = { config: { nombre: 'N', lugar: 'L', avisos: [{ texto: 'suyo' }] }, actualizadoEn: 't3' };
    let n = 0;
    const f = falsas({
      auto: () => (n++ === 0 ? { estado: 409, cuerpo: {} } : ok('t4')),
      leer: () => ({ estado: 200, cuerpo: remoto }),
    });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('avisos', [{ texto: 'mío' }]);
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    g.usarLoMio();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.envios[1].cuerpo).toEqual({ cambios: { avisos: [{ texto: 'mío' }] }, actualizadoEn: 't3' });
    expect(g.instantanea().estado).toBe('guardado');
  });

  it('«Ver lo suyo» deja en local lo remoto', async () => {
    const remoto = { config: { nombre: 'N', lugar: 'L', avisos: [{ texto: 'suyo' }] }, actualizadoEn: 't3' };
    const f = falsas({ auto: () => ({ estado: 409, cuerpo: {} }), leer: () => ({ estado: 200, cuerpo: remoto }) });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('avisos', [{ texto: 'mío' }]);
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    g.verLoSuyo();
    await vi.advanceTimersByTimeAsync(0);
    expect(g.instantanea().local.avisos).toEqual([{ texto: 'suyo' }]);
    expect(g.instantanea().estado).toBe('guardado');
    expect(g.instantanea().actualizadoEn).toBe('t3');
    expect(f.envios).toHaveLength(1);
  });

  it('guardarYa envía sin esperar y resuelve guardado', async () => {
    const f = falsas({ auto: () => ok('t2') });
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    const r = g.guardarYa();
    await vi.advanceTimersByTimeAsync(0);
    expect(await r).toBe('guardado');
    expect(f.envios).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.envios).toHaveLength(1);
  });

  it('guardarYa con un PUT en vuelo espera y vuelve a enviar lo nuevo', async () => {
    const f = falsas();
    const g = crearGuardador(inicial, f.deps);
    g.cambiar('lugar', 'A');
    await vi.advanceTimersByTimeAsync(800);
    g.cambiar('nombre', 'B');
    const r = g.guardarYa();
    f.envios[0].resolver(ok('t2'));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.envios).toHaveLength(2);
    f.envios[1].resolver(ok('t3'));
    expect(await r).toBe('guardado');
  });

  it('cambiarVarios con undefined quita el bloque', async () => {
    const f = falsas({ auto: () => ok('t2') });
    const g = crearGuardador(inicial, f.deps);
    g.cambiarVarios({ avisos: undefined, lugar: 'X' });
    await vi.advanceTimersByTimeAsync(800);
    expect(f.envios[0].cuerpo.cambios).toEqual({ lugar: 'X', avisos: null });
    expect('avisos' in g.instantanea().local).toBe(false);
  });
});
