/**
 * @jest-environment node
 */
// El puente de las misas listas entre la app y su panel (Tarea 6, decisión R4).
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

import { leerMensaje } from '../puente/puente';
import { GUARDADAS, type FilaGuardada, type Guardada, type PendienteGuardada } from './nucleo';
import {
  claveGuardadas,
  claveGuardadasPendientes,
  crearCanalGuardadas,
  scriptGuardadas,
  scriptPonerGuardadas,
} from './puente';

const SLUG = 'ciudad-arce';
const CL = 'pev_ciudad-arce_guardadas_v1';
const CP = 'pev_ciudad-arce_guardadas_pendientes_v1';
const VICARIA = path.resolve(__dirname, '..', '..', '..', 'vicaria');

/** Corre un script inyectado con un WebView falso: su localStorage es `almacen`. */
function correrEnPanel(
  script: string,
  almacen: Record<string, string>,
  o: { conNucleo?: boolean; pintar?: () => void } = {},
): void {
  const ventana = {
    localStorage: {
      getItem: (k: string) => (k in almacen ? almacen[k] : null),
      setItem: (k: string, v: string) => {
        almacen[k] = String(v);
      },
    },
    pintarGuardadas: o.pintar,
  };
  new Function('window', 'GUARDADAS', script)(ventana, o.conNucleo === false ? undefined : GUARDADAS);
}

function guardada(id: string, nombre: string, actualizadoEn: number, extra: Partial<Guardada> = {}): Guardada {
  return { id, nombre, tipo: 'dominical', guardadaEn: actualizadoEn, usadaEn: actualizadoEn, actualizadoEn, datos: { a: id }, ...extra };
}
function fila(g: Guardada): FilaGuardada {
  return GUARDADAS.aFila(g, 'panel', 'p1');
}

describe('claves (decisión R4)', () => {
  it('son las de guardadas.js del panel', () => {
    expect(claveGuardadas(SLUG)).toBe(CL);
    expect(claveGuardadasPendientes(SLUG)).toBe(CP);
  });

  it('coinciden con claveDe de vicaria/parroquia.js y las constantes de guardadas.js', () => {
    const codigo = ['parroquia.js', 'guardadas-nucleo.js', 'guardadas.js']
      .map((n) => fs.readFileSync(path.join(VICARIA, n), 'utf8'))
      .join('\n;\n');
    const contexto = vm.createContext({
      location: { pathname: '/ciudad-arce/panel.html', search: '?modo=app' },
      window: {},
      module: undefined,
      localStorage: { getItem: () => null, setItem: () => undefined },
    });
    (contexto as { window: unknown }).window = contexto;
    vm.runInContext(
      codigo +
        '\nthis.salida = { g: CLAVE_GUARDADAS, p: CLAVE_PENDIENTES, dg: claveDe("guardadas_v1"), dp: claveDe("guardadas_pendientes_v1") };',
      contexto,
    );
    const s = (contexto as { salida: Record<string, string> }).salida;
    expect(s.g).toBe(claveGuardadas(SLUG));
    expect(s.dg).toBe(claveGuardadas(SLUG));
    expect(s.p).toBe(claveGuardadasPendientes(SLUG));
    expect(s.dp).toBe(claveGuardadasPendientes(SLUG));
  });

  it('lanzan con un slug inválido, como claveEstado', () => {
    expect(() => claveGuardadas("x');y")).toThrow();
    expect(() => claveGuardadasPendientes('A')).toThrow();
    expect(() => scriptGuardadas("x');y")).toThrow();
    expect(() => scriptPonerGuardadas("x');y", [], { hechos: [], rechazados: [] })).toThrow();
  });
});

describe('scriptGuardadas', () => {
  function sondear(almacen: Record<string, string>) {
    const enviados: string[] = [];
    const intervalos: Array<() => void> = [];
    const ventana = {
      ReactNativeWebView: { postMessage: (m: string) => enviados.push(m) },
      localStorage: { getItem: (k: string) => (k in almacen ? almacen[k] : null) },
    };
    new Function('window', 'setInterval', scriptGuardadas(SLUG))(ventana, (cb: () => void) => {
      intervalos.push(cb);
      return 1;
    });
    return { enviados, intervalos };
  }

  it('scriptGuardadas no lleva tokens ni otra clave que las dos de guardadas', () => {
    const script = scriptGuardadas(SLUG);
    const claves = [...new Set(script.match(/pev_[a-z0-9_-]+/g))].sort();
    expect(claves).toEqual([CL, CP].sort());
    expect(script).not.toMatch(/token|bearer|apikey|sb_|sesion|authorization|estado_v1/i);
    expect(script).toContain('1000');
    expect(script.trim().endsWith('true;')).toBe(true);
  });

  it('manda {tipo:guardadas, lista, pendientes} que leerMensaje acepta, y solo cuando cambia', () => {
    const g = guardada('abcd-111111', 'Misa', 10);
    const almacen: Record<string, string> = { [CL]: JSON.stringify([g]), [CP]: JSON.stringify([{ op: 'guardar', id: g.id, cuando: 10 }]) };
    const { enviados, intervalos } = sondear(almacen);
    expect(enviados).toHaveLength(1);
    expect(leerMensaje(enviados[0])).toEqual({ tipo: 'guardadas', lista: [g], pendientes: [{ op: 'guardar', id: g.id, cuando: 10 }] });
    intervalos[0]();
    expect(enviados).toHaveLength(1);
    almacen[CP] = '[]';
    intervalos[0]();
    expect(enviados).toHaveLength(2);
    expect(leerMensaje(enviados[1])).toEqual({ tipo: 'guardadas', lista: [g], pendientes: [] });
  });

  it('lo ilegible llega como lista vacía', () => {
    const { enviados } = sondear({ [CL]: '{roto', [CP]: '{"no":"lista"}' });
    expect(leerMensaje(enviados[0])).toEqual({ tipo: 'guardadas', lista: [], pendientes: [] });
  });
});

describe('leerMensaje con guardadas', () => {
  it('leerMensaje acepta guardadas y rechaza listas que no son arreglos', () => {
    expect(leerMensaje('{"tipo":"guardadas","lista":[],"pendientes":[]}')).toEqual({ tipo: 'guardadas', lista: [], pendientes: [] });
    expect(leerMensaje('{"tipo":"guardadas","lista":{},"pendientes":[]}')).toBeNull();
    expect(leerMensaje('{"tipo":"guardadas","lista":[],"pendientes":"[]"}')).toBeNull();
    expect(leerMensaje('{"tipo":"guardadas","lista":[]}')).toBeNull();
    expect(leerMensaje('{"tipo":"guardadas","pendientes":[]}')).toBeNull();
  });

  it('deja afuera las entradas rotas', () => {
    const m = leerMensaje(
      JSON.stringify({
        tipo: 'guardadas',
        lista: [{ id: 'a', nombre: 'A', datos: {} }, { id: 'b' }],
        pendientes: [{ op: 'guardar', id: 'a', cuando: 1 }, { op: 'x', id: 'a', cuando: 1 }],
        token: 'nada',
      }),
    );
    expect(m).toEqual({
      tipo: 'guardadas',
      lista: [{ id: 'a', nombre: 'A', datos: {}, actualizadoEn: 0 }],
      pendientes: [{ op: 'guardar', id: 'a', cuando: 1 }],
    });
  });
});

describe('scriptPonerGuardadas', () => {
  const A = guardada('aaaa-111111', 'A', 100);
  const B = guardada('bbbb-222222', 'B', 200);

  it('saca solo lo confirmado, hasta su cuando, y conserva lo demás (también rechazado)', () => {
    const pendientes: PendienteGuardada[] = [
      { op: 'guardar', id: A.id, cuando: 150 },       // se editó otra vez mientras subía: queda
      { op: 'usar', id: B.id, cuando: 10 },           // confirmado (hasta 20)
      { op: 'usar', id: B.id, cuando: 30 },           // posterior: queda
      { op: 'borrar', id: 'cccc-333333', cuando: 5, rechazado: true },
      { op: 'guardar', id: 'dddd-444444', cuando: 7 }, // se rechaza ahora
    ];
    const almacen: Record<string, string> = { [CL]: JSON.stringify([A, B]), [CP]: JSON.stringify(pendientes) };
    correrEnPanel(
      scriptPonerGuardadas(SLUG, null, {
        hechos: [{ op: 'guardar', id: A.id, cuando: 100 }, { op: 'usar', id: B.id, cuando: 20 }],
        rechazados: [{ op: 'guardar', id: 'dddd-444444', cuando: 7 }],
      }),
      almacen,
    );
    expect(JSON.parse(almacen[CP])).toEqual([
      { op: 'guardar', id: A.id, cuando: 150 },
      { op: 'usar', id: B.id, cuando: 30 },
      { op: 'borrar', id: 'cccc-333333', cuando: 5, rechazado: true },
      { op: 'guardar', id: 'dddd-444444', cuando: 7, rechazado: true },
    ]);
    // Sin nube, la lista no se toca.
    expect(JSON.parse(almacen[CL])).toEqual([A, B]);
  });

  it('fusiona con la lista que el panel tiene ahora: lo guardado durante la sincronización no se pierde', () => {
    const C = guardada('cccc-333333', 'C', 300);
    const nube = [fila(A), fila({ ...B, nombre: 'B nube', actualizadoEn: 250 })];
    // El panel guardó C mientras la app subía A.
    const almacen: Record<string, string> = {
      [CL]: JSON.stringify([A, B, C, { id: 'rota' }]),
      [CP]: JSON.stringify([{ op: 'guardar', id: A.id, cuando: 100 }, { op: 'guardar', id: C.id, cuando: 300 }]),
    };
    let pintadas = 0;
    correrEnPanel(scriptPonerGuardadas(SLUG, nube, { hechos: [{ op: 'guardar', id: A.id, cuando: 100 }], rechazados: [] }), almacen, {
      pintar: () => pintadas++,
    });
    const lista = JSON.parse(almacen[CL]) as Array<Guardada & { id: string }>;
    expect(lista.find((g) => g.id === 'rota')).toEqual({ id: 'rota' });   // las rotas se conservan
    expect(lista.find((g) => g.id === C.id)).toEqual(C);
    expect(lista.find((g) => g.id === B.id)!.nombre).toBe('B nube');
    expect(lista.find((g) => g.id === A.id)!.nombre).toBe('A');
    expect(JSON.parse(almacen[CP])).toEqual([{ op: 'guardar', id: C.id, cuando: 300 }]);
    expect(pintadas).toBe(1);
  });

  it('sin el núcleo en el panel, no toca la lista (solo la cola)', () => {
    const almacen: Record<string, string> = { [CL]: JSON.stringify([A]), [CP]: JSON.stringify([{ op: 'guardar', id: A.id, cuando: 100 }]) };
    correrEnPanel(scriptPonerGuardadas(SLUG, [fila(B)], { hechos: [{ op: 'guardar', id: A.id, cuando: 100 }], rechazados: [] }), almacen, {
      conNucleo: false,
    });
    expect(JSON.parse(almacen[CL])).toEqual([A]);
    expect(JSON.parse(almacen[CP])).toEqual([]);
  });

  it('una lista ilegible en el panel no se pisa', () => {
    const almacen: Record<string, string> = { [CL]: '{roto', [CP]: '[]' };
    correrEnPanel(scriptPonerGuardadas(SLUG, [fila(B)], { hechos: [], rechazados: [] }), almacen);
    expect(almacen[CL]).toBe('{roto');
  });

  it('si solo cambió la cola (una rechazada), repinta: el panel muestra el aviso y la fila', () => {
    for (const nube of [null, [fila(A)]]) {
      const almacen: Record<string, string> = {
        [CL]: JSON.stringify([GUARDADAS.deFila(fila(A))]),
        [CP]: JSON.stringify([{ op: 'guardar', id: A.id, cuando: 7 }]),
      };
      let pintadas = 0;
      correrEnPanel(scriptPonerGuardadas(SLUG, nube, { hechos: [], rechazados: [{ op: 'guardar', id: A.id, cuando: 7 }] }), almacen, {
        pintar: () => pintadas++,
      });
      expect(JSON.parse(almacen[CP])).toEqual([{ op: 'guardar', id: A.id, cuando: 7, rechazado: true }]);
      expect(pintadas).toBe(1);
    }
  });

  it('si nada cambió no escribe ni repinta', () => {
    const almacen: Record<string, string> = { [CL]: JSON.stringify([GUARDADAS.deFila(fila(A))]), [CP]: '[]' };
    const antes = { ...almacen };
    let pintadas = 0;
    correrEnPanel(scriptPonerGuardadas(SLUG, [fila(A)], { hechos: [], rechazados: [] }), almacen, { pintar: () => pintadas++ });
    expect(almacen).toEqual(antes);
    expect(pintadas).toBe(0);
  });

  it('no deja salir del texto un nombre con comillas o separadores de línea', () => {
    const raro = guardada('eeee-555555', "x'); alert(1); ('\u2028</script>", 400);
    const script = scriptPonerGuardadas(SLUG, [fila(raro)], { hechos: [], rechazados: [] });
    expect(script).not.toContain('\u2028');
    const almacen: Record<string, string> = { [CL]: '[]', [CP]: '[]' };
    correrEnPanel(script, almacen);
    expect(JSON.parse(almacen[CL])[0].nombre).toBe(raro.nombre);
  });
});

describe('canal', () => {
  it('guarda el último mensaje por parroquia, avisa y entrega los scripts a la vista conectada', () => {
    const canal = crearCanalGuardadas();
    const avisos: string[] = [];
    canal.alMensaje((slug) => avisos.push(slug));
    expect(canal.ultimo(SLUG)).toBeNull();
    expect(canal.inyectar(SLUG, 'true;')).toBe(false);
    canal.recibir(SLUG, { tipo: 'guardadas', lista: [], pendientes: [] });
    expect(canal.ultimo(SLUG)).toEqual({ tipo: 'guardadas', lista: [], pendientes: [] });
    expect(avisos).toEqual([SLUG]);
    const scripts: string[] = [];
    const soltar = canal.conectar(SLUG, (s) => scripts.push(s));
    expect(canal.inyectar('otra', 'x;')).toBe(false);
    expect(canal.inyectar(SLUG, 'true;')).toBe(true);
    expect(scripts).toEqual(['true;']);
    soltar();
    expect(canal.inyectar(SLUG, 'true;')).toBe(false);
    canal.olvidar(SLUG);
    expect(canal.ultimo(SLUG)).toBeNull();
  });
});
