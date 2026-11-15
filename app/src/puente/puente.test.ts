import {
  SCRIPT_IR_A_EN_VIVO,
  SCRIPT_ESCENA,
  SCRIPT_IR_A_PREPARAR,
  claveEstado,
  esMensajeDelPanel,
  leerMensaje,
  scriptPanel,
  urlPanel,
  urlPanelSiLista,
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
  it('el sondeo lee el estado de la parroquia y lo manda a la app', () => {
    const script = scriptPanel('ciudad-arce');
    expect(script).toContain("localStorage.getItem('pev_ciudad-arce_estado_v1')");
    expect(script).toContain('window.ReactNativeWebView.postMessage');
    expect(script).not.toContain('parroquia_obs_estado_v1');
    expect(script).toContain('300');
    expect(script.trim().endsWith('true;')).toBe(true);
  });

  it('scriptPanel lanza con un slug inválido', () => {
    expect(() => scriptPanel("x');y")).toThrow();
  });

  it('el sondeo manda un mensaje que leerMensaje acepta, y solo cuando cambia', () => {
    const enviados: string[] = [];
    const almacen: Record<string, string> = { 'pev_ciudad-arce_estado_v1': '{"tipo":"horasanta"}' };
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
    new Function('window', 'localStorage', 'setInterval', scriptPanel('ciudad-arce'))(
      ventana,
      ventana.localStorage,
      ventana.setInterval,
    );
    expect(enviados).toHaveLength(1);
    expect(leerMensaje(enviados[0])).toEqual({ tipo: 'estado', json: '{"tipo":"horasanta"}' });
    intervalos[0]();
    expect(enviados).toHaveLength(1);
    almacen['pev_ciudad-arce_estado_v1'] = '{"tipo":"dominical"}';
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
    new Function('window', 'localStorage', 'setInterval', scriptPanel('ciudad-arce'))(
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
    expect(SCRIPT_ESCENA('horarios')).toBe("window.fijarEscenaApp && window.fijarEscenaApp('horarios'); true;");
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

describe('claveEstado', () => {
  it('es la clave del estado de esa parroquia', () => {
    expect(claveEstado('ciudad-arce')).toBe('pev_ciudad-arce_estado_v1');
  });
  it('lanza con un slug inválido', () => {
    expect(() => claveEstado("x');y")).toThrow();
    expect(() => claveEstado('')).toThrow();
  });
});

describe('urlPanel', () => {
  it('es el panel de la parroquia en modo app', () => {
    expect(urlPanel('https://p.app', 'ciudad-arce')).toBe('https://p.app/ciudad-arce/panel.html?modo=app');
  });
});

describe('urlPanelSiLista', () => {
  // El panel no se carga hasta que lo nativo sabe la parroquia (Copias.fijar): antes, Interceptor.kt
  // responde 403 vacío y el WebView muestra «Página web no disponible» sin volver a intentar.
  it('no da dirección mientras la parroquia no quedó fijada en lo nativo', () => {
    expect(urlPanelSiLista('https://p.app', 'ciudad-arce', false)).toBeNull();
  });
  it('da la dirección del panel cuando ya quedó fijada', () => {
    expect(urlPanelSiLista('https://p.app', 'ciudad-arce', true)).toBe('https://p.app/ciudad-arce/panel.html?modo=app');
  });
});

describe('esMensajeDelPanel', () => {
  it('acepta solo el origen exacto de la plataforma', () => {
    expect(esMensajeDelPanel('https://p.app/ciudad-arce/panel.html', 'https://p.app')).toBe(true);
    expect(esMensajeDelPanel('https://p.app/ciudad-arce/panel.html?modo=app', 'https://p.app')).toBe(true);
  });
  it('rechaza los assets, otros orígenes parecidos y la falta de url', () => {
    expect(esMensajeDelPanel('file:///android_asset/x', 'https://p.app')).toBe(false);
    expect(esMensajeDelPanel('https://p.app.evil.com/ciudad-arce/panel.html', 'https://p.app')).toBe(false);
    expect(esMensajeDelPanel('https://p.app@evil.com/', 'https://p.app')).toBe(false);
    expect(esMensajeDelPanel('http://p.app/ciudad-arce/panel.html', 'https://p.app')).toBe(false);
    expect(esMensajeDelPanel('https://p.app:8443/', 'https://p.app')).toBe(false);
    expect(esMensajeDelPanel('', 'https://p.app')).toBe(false);
    expect(esMensajeDelPanel(undefined, 'https://p.app')).toBe(false);
  });
});
