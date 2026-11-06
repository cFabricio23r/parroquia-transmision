import {
  SCRIPT_ANTES_DE_CARGAR,
  SCRIPT_IR_A_EN_VIVO,
  SCRIPT_PANEL,
  SCRIPT_ESCENA,
  SCRIPT_IR_A_PREPARAR,
  esDelPanel,
  leerMensaje,
} from './puente';

describe('leerMensaje', () => {
  it('lee un mensaje de estado bien formado', () => {
    expect(leerMensaje('{"tipo":"estado","json":"{}"}')).toEqual({ tipo: 'estado', json: '{}' });
  });

  it('da null ante texto que no es JSON', () => {
    expect(leerMensaje('hola')).toBeNull();
  });

  it('da null ante otro tipo de mensaje', () => {
    expect(leerMensaje('{"tipo":"otro"}')).toBeNull();
  });

  it('da null si json no es un texto', () => {
    expect(leerMensaje('{"tipo":"estado","json":5}')).toBeNull();
  });

  it('da null ante JSON que no es un objeto', () => {
    expect(leerMensaje('null')).toBeNull();
    expect(leerMensaje('"estado"')).toBeNull();
    expect(leerMensaje('[1,2]')).toBeNull();
    expect(leerMensaje('')).toBeNull();
  });

  it('no deja pasar campos de más', () => {
    expect(leerMensaje('{"tipo":"estado","json":"{}","extra":1}')).toEqual({ tipo: 'estado', json: '{}' });
  });
});

describe('scripts del panel', () => {
  it('antes de cargar marca el modo app', () => {
    expect(SCRIPT_ANTES_DE_CARGAR).toContain('window.modoApp = true');
    expect(SCRIPT_ANTES_DE_CARGAR.trim().endsWith('true;')).toBe(true);
  });

  it('el sondeo lee el estado del panel y lo manda a la app', () => {
    expect(SCRIPT_PANEL).toContain('parroquia_obs_estado_v1');
    expect(SCRIPT_PANEL).toContain('ReactNativeWebView.postMessage');
    expect(SCRIPT_PANEL).toContain('300');
    expect(SCRIPT_PANEL.trim().endsWith('true;')).toBe(true);
  });

  it('el sondeo manda un mensaje que leerMensaje acepta, y solo cuando cambia', () => {
    const enviados: string[] = [];
    const almacen: Record<string, string> = { parroquia_obs_estado_v1: '{"tipo":"horasanta"}' };
    const intervalos: Array<() => void> = [];
    const ventana = {
      ReactNativeWebView: { postMessage: (m: string) => enviados.push(m) },
      localStorage: { getItem: (k: string) => (k in almacen ? almacen[k] : null) },
      setInterval: (cb: () => void) => {
        intervalos.push(cb);
        return 1;
      },
    };
    // Se corre el script con una ventana falsa.
    new Function('window', 'localStorage', 'setInterval', SCRIPT_PANEL)(
      ventana,
      ventana.localStorage,
      ventana.setInterval,
    );
    expect(enviados).toHaveLength(1);
    expect(leerMensaje(enviados[0])).toEqual({ tipo: 'estado', json: '{"tipo":"horasanta"}' });
    intervalos[0]();
    expect(enviados).toHaveLength(1);
    almacen.parroquia_obs_estado_v1 = '{"tipo":"dominical"}';
    intervalos[0]();
    expect(enviados).toHaveLength(2);
    expect(leerMensaje(enviados[1])).toEqual({ tipo: 'estado', json: '{"tipo":"dominical"}' });
  });

  it('el sondeo no manda nada si todavía no hay estado guardado', () => {
    const enviados: string[] = [];
    const ventana = {
      ReactNativeWebView: { postMessage: (m: string) => enviados.push(m) },
      localStorage: { getItem: () => null },
      setInterval: () => 1,
    };
    new Function('window', 'localStorage', 'setInterval', SCRIPT_PANEL)(
      ventana,
      ventana.localStorage,
      ventana.setInterval,
    );
    expect(enviados).toHaveLength(0);
  });

  it('ir a En vivo toca la pestaña tab-vivo', () => {
    expect(SCRIPT_IR_A_EN_VIVO).toContain('tab-vivo');
    expect(SCRIPT_IR_A_EN_VIVO).toContain('click()');
    expect(SCRIPT_IR_A_EN_VIVO.trim().endsWith('true;')).toBe(true);
  });

  it('la escena avisa al panel con fijarEscenaApp', () => {
    expect(SCRIPT_ESCENA('camara')).toContain("fijarEscenaApp('camara')");
    expect(SCRIPT_ESCENA('gracias')).toContain("fijarEscenaApp('gracias')");
    expect(SCRIPT_ESCENA('produccion')).toContain("fijarEscenaApp('produccion')");
    expect(SCRIPT_ESCENA('inicio').trim().endsWith('true;')).toBe(true);
  });

  it('una escena desconocida no inyecta nada', () => {
    expect(SCRIPT_ESCENA("x'); alert(1); ('" as never)).not.toContain('fijarEscenaApp');
  });
});

describe('volver a Preparar (review M9 de la Tarea 8)', () => {
  it('toca la pestaña tab-preparar', () => {
    expect(SCRIPT_IR_A_PREPARAR).toContain('tab-preparar');
    expect(SCRIPT_IR_A_PREPARAR).toContain('click()');
    expect(SCRIPT_IR_A_PREPARAR.trim().endsWith('true;')).toBe(true);
  });
  it('hace click en el botón con ese id, y no falla si no existe', () => {
    const click = jest.fn();
    const documento = { getElementById: (id: string) => (id === 'tab-preparar' ? { click } : null) };
    new Function('document', SCRIPT_IR_A_PREPARAR)(documento);
    expect(click).toHaveBeenCalledTimes(1);
    expect(() => new Function('document', SCRIPT_IR_A_PREPARAR)({ getElementById: () => null })).not.toThrow();
  });
});

describe('esDelPanel (review M2 de la Tarea 8)', () => {
  it('acepta mensajes de páginas de la app', () => {
    expect(esDelPanel('file:///android_asset/obs/panel.html?modo=app')).toBe(true);
  });
  it('rechaza cualquier otro origen o la falta de url', () => {
    expect(esDelPanel('https://example.com/')).toBe(false);
    expect(esDelPanel('file:///sdcard/panel.html')).toBe(false);
    expect(esDelPanel('')).toBe(false);
    expect(esDelPanel(undefined)).toBe(false);
  });
});
