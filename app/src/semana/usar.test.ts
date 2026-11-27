/**
 * @jest-environment node
 */
// «Usar esta», «Editar» y el seguimiento (Tarea 13 del plan 3b): Review Focus 2.
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

import type { Pendiente } from './almacen';
import { SEMANA, TIPOS_COMUNES, type TipoCampos } from './nucleo';
import type { ItemApp } from './pendientes';
import { crearSeguimiento, scriptEditar, scriptUsar } from './usar';

const RAIZ = path.resolve(__dirname, '..', '..', '..', 'vicaria');
const CLAVE = 'pev_ciudad-arce_estado_v1';

// Copia mínima de pruebas/vicaria/cargar.js, con la página en /ciudad-arce/panel.html.
function cargar(archivos: string[], almacen: Record<string, string>) {
  const datos: Record<string, string> = { ...almacen };
  const eventos: unknown[] = [];
  const contexto = vm.createContext({
    localStorage: {
      getItem: (k: string) => (k in datos ? datos[k] : null),
      setItem: (k: string, v: string) => {
        datos[k] = String(v);
      },
      removeItem: (k: string) => {
        delete datos[k];
      },
    },
    BroadcastChannel: class {
      onmessage = null;
      postMessage() {}
      close() {}
    },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
    window: { innerWidth: 1920, innerHeight: 1080, addEventListener() {}, dispatchEvent: (e: unknown) => { eventos.push(e); return true; } },
    StorageEvent: class { type: string; key?: string; constructor(t: string, i?: { key?: string }) { this.type = t; this.key = i?.key; } },
    location: { pathname: '/ciudad-arce/panel.html', search: '' },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    console: { log() {}, info() {}, warn() {}, error() {} },
  });
  const fuentes = archivos.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'));
  vm.runInContext(fuentes.join('\n'), contexto, { filename: archivos.join('+') });
  return { contexto, datos, eventos };
}

const tipo = (clave: string): TipoCampos => {
  const t = TIPOS_COMUNES.find((x) => x.clave === clave);
  if (!t) throw new Error('falta el tipo ' + clave);
  return t;
};

describe('scriptUsar en el panel real', () => {
  function previo() {
    const { contexto, datos, eventos } = cargar(['parroquia.js', 'tipos.js', 'comun.js'], {});
    const base = vm.runInContext('normalizarEstado({})', contexto) as Record<string, unknown>;
    contexto.__previo = { ...base, tipo: 'dominical', lectura2: 'Rm 8', avisos: [{ t: 'Aviso de prueba' }], rotulo: 'persona' };
    const estado = vm.runInContext('normalizarEstado(__previo)', contexto) as Record<string, unknown>;
    expect(JSON.stringify(estado.avisos)).toContain('Aviso de prueba');
    datos[CLAVE] = JSON.stringify(estado);
    return { contexto, datos, estado, eventos };
  }

  it('cambia el tipo y los datos, y deja lo de la parroquia', () => {
    const { contexto, datos, estado } = previo();
    const script = scriptUsar('ciudad-arce', SEMANA.parcheDePanel(
      { tipo: 'novena', datos: { dia: 3, celebrante: 'P. Ana' } }, tipo('novena'),
    ));
    vm.runInContext(script, contexto);
    const s = JSON.parse(datos[CLAVE]);
    expect(s).toMatchObject({
      tipo: 'novena', novenaDia: 3, celebrante: 'P. Ana', lectura2: '', rotulo: 'ninguno', rotuloHasta: 0,
    });
    expect(s.avisos).toEqual(estado.avisos);
  });

  it('avisa con un StorageEvent sintético de la misma clave, para que el panel lo tome en el acto', () => {
    const { contexto, eventos } = previo();
    const script = scriptUsar('ciudad-arce', SEMANA.parcheDePanel({ tipo: 'novena', datos: {} }, tipo('novena')));
    vm.runInContext(script, contexto);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ type: 'storage', key: CLAVE });
  });

  it('no marca ultimoPropio', () => {
    const { contexto } = previo();
    const script = scriptUsar('ciudad-arce', SEMANA.parcheDePanel({ tipo: 'novena', datos: {} }, tipo('novena')));
    expect(script).not.toContain('guardarEstado');
    vm.runInContext(script, contexto);
    expect(vm.runInContext('ultimoPropio', contexto)).toBeNull();
  });

  it('no deja pasar claves de más', () => {
    const { contexto, datos } = previo();
    const parche = SEMANA.parcheDePanel({ tipo: 'novena', datos: { dia: 1 } }, tipo('novena'));
    const malo = { ...parche, poner: { ...parche.poner, clave: 'FB-PRUEBA-MARCA-1111' } };
    const script = scriptUsar('ciudad-arce', malo);
    expect(script).not.toContain('FB-PRUEBA-MARCA-1111');
    vm.runInContext(script, contexto);
    expect(datos[CLAVE]).not.toContain('FB-PRUEBA-MARCA-1111');
  });

  it('un slug malo lanza', () => {
    expect(() => scriptUsar("x');y", { limpiar: [], poner: { tipo: 'novena' } })).toThrow();
  });

  it('scriptEditar suma el salto a Preparar y al primer campo que falta', () => {
    const parche = SEMANA.parcheDePanel({ tipo: 'novena', datos: {} }, tipo('novena'));
    const s = scriptEditar('ciudad-arce', parche);
    expect(s).toContain('localStorage.setItem');
    expect(s).toContain('setTimeout(');
    expect(s).toContain('450');
    expect(s).toContain('tab-preparar');
    expect(s).toContain('continuar');
    expect(s).toContain('#revision a');
  });
});

describe('el seguimiento', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const AHORA = new Date('2026-11-19T16:00:00.000Z');
  const ITEM: ItemApp = {
    clave: 'fija:f1:2026-11-19', fecha: '2026-11-19', hora: '18:00', tipo: 'novena',
    datos: { dia: 3, celebrante: 'P. Ana' }, origen: 'fija', fijaId: 'f1', serieId: null, serie: null,
    diaSemanaFija: 4, id: null, saltada: false, editada: false, actualizadoEn: null, actualizadoDesde: null,
    pendiente: false, rechazado: false,
  };
  const estado = (extra: Record<string, unknown>) => JSON.stringify({ tipo: 'novena', novenaDia: 3, celebrante: 'P. Ana', ...extra });

  function nuevo() {
    const guardados: Pendiente[] = [];
    const s = crearSeguimiento({ guardar: async (p) => void guardados.push(p), ahora: () => AHORA });
    return { s, guardados };
  }

  it('el estado viejo después de «Usar esta» no suelta ni guarda', () => {
    const { s, guardados } = nuevo();
    s.usar(ITEM, tipo('novena'));
    s.alEstado(JSON.stringify({ tipo: 'dominical', celebrante: 'P. Viejo' }));
    s.alEstado(estado({ celebrante: 'P. Viejo' }));
    jest.advanceTimersByTime(2000);
    expect(s.enUso()).toBe(ITEM.clave);
    expect(guardados).toHaveLength(0);
  });

  it('ya aplicado, un cambio se guarda 1500 ms después del último, una vez', () => {
    const { s, guardados } = nuevo();
    s.usar(ITEM, tipo('novena'));
    s.alEstado(estado({}));
    s.alEstado(estado({ celebrante: 'P. Lu' }));
    jest.advanceTimersByTime(1000);
    s.alEstado(estado({ celebrante: 'P. Luis' }));
    jest.advanceTimersByTime(1499);
    expect(guardados).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({
      clave: ITEM.clave, origen: 'fija', fijaId: 'f1', serieId: null, fecha: '2026-11-19', hora: '18:00', tipo: 'novena',
      editadoEn: AHORA.toISOString(), rechazado: false,
    });
    expect(guardados[0].datos).toEqual(
      SEMANA.datosDeEstado({ tipo: 'novena', novenaDia: 3, celebrante: 'P. Luis' }, tipo('novena')),
    );
  });

  it('otro tipo, ya aplicado, suelta sin guardar', () => {
    const { s, guardados } = nuevo();
    s.usar(ITEM, tipo('novena'));
    s.alEstado(estado({}));
    s.alEstado(JSON.stringify({ tipo: 'dominical', celebrante: 'P. Otro' }));
    jest.advanceTimersByTime(5000);
    expect(s.enUso()).toBeNull();
    expect(guardados).toHaveLength(0);
  });

  it('si el estado aplicado no llega en 3000 ms, suelta', () => {
    const { s } = nuevo();
    s.usar(ITEM, tipo('novena'));
    jest.advanceTimersByTime(3000);
    expect(s.enUso()).toBeNull();
  });

  it('soltar cancela lo que estaba por guardar, y un json roto se ignora', () => {
    const { s, guardados } = nuevo();
    s.usar(ITEM, tipo('novena'));
    s.alEstado('{roto');
    s.alEstado(estado({}));
    s.alEstado(estado({ celebrante: 'P. Luis' }));
    s.soltar();
    jest.advanceTimersByTime(5000);
    expect(guardados).toHaveLength(0);
    expect(s.enUso()).toBeNull();
  });
});
