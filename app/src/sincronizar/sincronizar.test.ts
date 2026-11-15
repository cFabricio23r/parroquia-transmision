import type { SesionApp } from '../sesion/sesion';
import type { ParroquiaApp } from '../sesion/tipos';
import type { ClienteSupabase } from '../supabase/cliente';
import {
  crearLimpiezas,
  crearSincronizador,
  limpiezas,
  sincronizador,
  type ContextoSincronizar,
} from './sincronizar';

const PARROQUIA: ParroquiaApp = { id: 'p-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };

function base(o: { enVivo?: () => boolean; sigueElegida?: () => boolean } = {}): Omit<ContextoSincronizar, 'momento'> {
  return {
    parroquia: PARROQUIA,
    sesion: {} as SesionApp,
    cliente: {} as ClienteSupabase,
    enVivo: o.enVivo ?? (() => false),
    sigueElegida: o.sigueElegida ?? (() => true),
  };
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('la app tiene un sincronizador y unas limpiezas', () => {
  expect(typeof sincronizador.sincronizar).toBe('function');
  expect(typeof limpiezas.limpiar).toBe('function');
});

describe('sincronizador', () => {
  it('corre las tareas del momento en orden y en serie, con el contexto', async () => {
    const s = crearSincronizador();
    const pasos: string[] = [];
    let soltar!: () => void;
    const espera = new Promise<void>((r) => (soltar = r));
    s.registrarTarea('a', ['abrir'], async (c) => {
      pasos.push('a:empieza:' + c.momento + ':' + c.parroquia.slug);
      await espera;
      pasos.push('a:termina');
    });
    s.registrarTarea('b', ['abrir', 'antes-de-iniciar'], async () => {
      pasos.push('b');
    });
    const p = s.sincronizar('abrir', base());
    await Promise.resolve();
    await Promise.resolve();
    expect(pasos).toEqual(['a:empieza:abrir:ciudad-arce']);
    soltar();
    expect(await p).toEqual({ a: 'ok', b: 'ok' });
    expect(pasos).toEqual(['a:empieza:abrir:ciudad-arce', 'a:termina', 'b']);
  });

  it('una tarea de otro momento no corre', async () => {
    const s = crearSincronizador();
    const fin = jest.fn(async () => {});
    s.registrarTarea('fin', ['al-terminar'], fin);
    expect(await s.sincronizar('abrir', base())).toEqual({});
    expect(fin).not.toHaveBeenCalled();
    expect(await s.sincronizar('al-terminar', base())).toEqual({ fin: 'ok' });
  });

  it('en vivo todas quedan saltadas', async () => {
    const s = crearSincronizador();
    const t = jest.fn(async () => {});
    s.registrarTarea('a', ['abrir'], t);
    s.registrarTarea('b', ['abrir'], t);
    expect(await s.sincronizar('abrir', base({ enVivo: () => true }))).toEqual({ a: 'saltada', b: 'saltada' });
    expect(t).not.toHaveBeenCalled();
  });

  it('si sale al aire después de la primera, la segunda queda saltada', async () => {
    const s = crearSincronizador();
    let vivo = false;
    s.registrarTarea('a', ['abrir'], async () => {
      vivo = true;
    });
    const b = jest.fn(async () => {});
    s.registrarTarea('b', ['abrir'], b);
    expect(await s.sincronizar('abrir', base({ enVivo: () => vivo }))).toEqual({ a: 'ok', b: 'saltada' });
    expect(b).not.toHaveBeenCalled();
  });

  it('si la parroquia deja de estar elegida después de la primera, la segunda queda saltada', async () => {
    const s = crearSincronizador();
    let elegida = true;
    s.registrarTarea('a', ['abrir'], async () => {
      elegida = false;
    });
    s.registrarTarea('b', ['abrir'], async () => {});
    expect(await s.sincronizar('abrir', base({ sigueElegida: () => elegida }))).toEqual({ a: 'ok', b: 'saltada' });
  });

  it('una tarea que lanza queda en fallo, sin el texto del error, y las siguientes corren', async () => {
    const s = crearSincronizador();
    s.registrarTarea('x', ['abrir'], async () => {
      throw new Error('TOKEN-ACCESO-FALSO-1111');
    });
    const y = jest.fn(async () => {});
    s.registrarTarea('y', ['abrir'], y);
    await expect(s.sincronizar('abrir', base())).resolves.toEqual({ x: 'fallo', y: 'ok' });
    expect(y).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('sincronizar: x falló');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('TOKEN-ACCESO-FALSO-1111');
  });

  it('una tarea que lanza algo que no es Error también queda en fallo', async () => {
    const s = crearSincronizador();
    s.registrarTarea('x', ['abrir'], () => {
      throw 'TOKEN-ACCESO-FALSO-1111';
    });
    await expect(s.sincronizar('abrir', base())).resolves.toEqual({ x: 'fallo' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('TOKEN-ACCESO-FALSO-1111');
  });

  it('dos sincronizar del mismo momento en vuelo devuelven la misma promesa', async () => {
    const s = crearSincronizador();
    let soltar!: () => void;
    const espera = new Promise<void>((r) => (soltar = r));
    const t = jest.fn(() => espera);
    s.registrarTarea('a', ['abrir'], t);
    const p1 = s.sincronizar('abrir', base());
    const p2 = s.sincronizar('abrir', base());
    expect(p2).toBe(p1);
    soltar();
    await p1;
    expect(t).toHaveBeenCalledTimes(1);
    const p3 = s.sincronizar('abrir', base());
    expect(p3).not.toBe(p1);
    await p3;
    expect(t).toHaveBeenCalledTimes(2);
  });

  it('la función que devuelve registrarTarea la quita', async () => {
    const s = crearSincronizador();
    const t = jest.fn(async () => {});
    const quitar = s.registrarTarea('a', ['abrir'], t);
    quitar();
    expect(await s.sincronizar('abrir', base())).toEqual({});
    expect(t).not.toHaveBeenCalled();
  });
});

describe('limpiezas', () => {
  it('limpiar todo llama a todas con el alcance', async () => {
    const l = crearLimpiezas();
    const a = jest.fn(async () => {});
    const b = jest.fn(async () => {});
    l.registrar('a', a);
    l.registrar('b', b);
    expect(await l.limpiar({ tipo: 'todo' })).toEqual({ a: 'ok', b: 'ok' });
    expect(a).toHaveBeenCalledWith({ tipo: 'todo' });
    expect(b).toHaveBeenCalledWith({ tipo: 'todo' });
    await l.limpiar({ tipo: 'parroquia', parroquia: PARROQUIA });
    expect(a).toHaveBeenLastCalledWith({ tipo: 'parroquia', parroquia: PARROQUIA });
  });

  it('una que lanza queda en fallo y las demás corren igual', async () => {
    const l = crearLimpiezas();
    l.registrar('a', async () => {
      throw new Error('TOKEN-ACCESO-FALSO-1111');
    });
    const b = jest.fn(async () => {});
    l.registrar('b', b);
    await expect(l.limpiar({ tipo: 'todo' })).resolves.toEqual({ a: 'fallo', b: 'ok' });
    expect(b).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('TOKEN-ACCESO-FALSO-1111');
  });

  it('la función que devuelve registrar la quita', async () => {
    const l = crearLimpiezas();
    const a = jest.fn(async () => {});
    l.registrar('a', a)();
    expect(await l.limpiar({ tipo: 'todo' })).toEqual({});
    expect(a).not.toHaveBeenCalled();
  });
});
