import {
  ESCENAS_VALIDAS,
  ESTADO_INICIAL,
  debeCortar,
  reducir,
  type EstadoTransmision,
  type Evento,
} from './transmision';

// Aplica una lista de eventos y devuelve el estado final.
function aplicar(e: EstadoTransmision, ...evs: Evento[]): EstadoTransmision {
  return evs.reduce(reducir, e);
}

// Aplica eventos y cuenta cuántas veces debeCortar dio true en el camino.
function cortesEn(e: EstadoTransmision, evs: Evento[]): { final: EstadoTransmision; cortes: number } {
  let cortes = 0;
  let actual = e;
  for (const ev of evs) {
    const sig = reducir(actual, ev);
    if (debeCortar(actual, sig)) cortes++;
    actual = sig;
  }
  return { final: actual, cortes };
}

const tics = (n: number): Evento[] => Array.from({ length: n }, () => ({ tipo: 'tic' }));
const enVivo = (): EstadoTransmision => aplicar(ESTADO_INICIAL, { tipo: 'iniciar' }, { tipo: 'conectado' });

describe('estado inicial', () => {
  it('arranca preparando, en la escena inicio, sin tiempo ni error', () => {
    expect(ESTADO_INICIAL).toEqual({
      fase: 'preparando', escena: 'inicio', segundos: 0, cuentaFinal: null, error: null,
    });
  });
});

describe('inicio de la transmisión', () => {
  it('iniciar pasa a iniciando', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'iniciar' }).fase).toBe('iniciando');
  });
  it('conectado pasa a en_vivo y la escena sigue en inicio', () => {
    const s = enVivo();
    expect(s.fase).toBe('en_vivo');
    expect(s.escena).toBe('inicio');
  });
  it('cortado en iniciando (clave rechazada) vuelve a preparando con el mensaje', () => {
    const s = aplicar(ESTADO_INICIAL, { tipo: 'iniciar' }, { tipo: 'cortado', mensaje: 'Clave rechazada' });
    expect(s.fase).toBe('preparando');
    expect(s.error).toBe('Clave rechazada');
  });
  it('iniciar de nuevo limpia el error anterior', () => {
    const s = aplicar(
      ESTADO_INICIAL, { tipo: 'iniciar' }, { tipo: 'cortado', mensaje: 'x' }, { tipo: 'iniciar' },
    );
    expect(s.fase).toBe('iniciando');
    expect(s.error).toBeNull();
  });
  it('cortado en iniciando pide cortar una sola vez (el nativo ya arrancó y hay que liberarlo)', () => {
    const { final, cortes } = cortesEn(ESTADO_INICIAL, [
      { tipo: 'iniciar' }, { tipo: 'cortado', mensaje: 'x' }, { tipo: 'cortado', mensaje: 'y' }, ...tics(3),
    ]);
    expect(cortes).toBe(1);
    expect(final.fase).toBe('preparando');
    expect(final.error).toBe('x');
  });
  it.each([{ tipo: 'terminar_ahora' }, { tipo: 'terminar_con_gracias' }] as Evento[])(
    '$tipo en iniciando cancela: vuelve a preparando sin error y corta una sola vez', (ev) => {
      const { final, cortes } = cortesEn(ESTADO_INICIAL, [
        { tipo: 'iniciar' }, ev, ev, ...tics(3),
      ]);
      expect(cortes).toBe(1);
      expect(final.fase).toBe('preparando');
      expect(final.error).toBeNull();
      expect(final.cuentaFinal).toBeNull();
    },
  );
});

describe('tic', () => {
  it('en en_vivo suma 1 a segundos', () => {
    expect(aplicar(enVivo(), { tipo: 'tic' }, { tipo: 'tic' }).segundos).toBe(2);
  });
  it('en preparando no suma', () => {
    const s = reducir(ESTADO_INICIAL, { tipo: 'tic' });
    expect(s.segundos).toBe(0);
    expect(s).toBe(ESTADO_INICIAL);
  });
  it('en iniciando no suma', () => {
    const a = reducir(ESTADO_INICIAL, { tipo: 'iniciar' });
    expect(reducir(a, { tipo: 'tic' })).toBe(a);
  });
  it('en reconectando sigue sumando (la emisión sigue contando como al aire)', () => {
    const s = aplicar(enVivo(), { tipo: 'tic' }, { tipo: 'reconectando' }, { tipo: 'tic' });
    expect(s.fase).toBe('reconectando');
    expect(s.segundos).toBe(2);
  });
});

describe('escena', () => {
  it('cambia en en_vivo', () => {
    expect(reducir(enVivo(), { tipo: 'escena', escena: 'avisos' }).escena).toBe('avisos');
  });
  it('cambia en reconectando', () => {
    const r = reducir(enVivo(), { tipo: 'reconectando' });
    expect(reducir(r, { tipo: 'escena', escena: 'camara' }).escena).toBe('camara');
  });
  it('no cambia en preparando, iniciando ni terminando', () => {
    const ev: Evento = { tipo: 'escena', escena: 'portada' };
    expect(reducir(ESTADO_INICIAL, ev)).toBe(ESTADO_INICIAL);
    const ini = reducir(ESTADO_INICIAL, { tipo: 'iniciar' });
    expect(reducir(ini, ev)).toBe(ini);
    const ter = reducir(enVivo(), { tipo: 'terminar_con_gracias' });
    expect(reducir(ter, ev)).toBe(ter);
  });
  it('Producción es una escena válida y se puede elegir al aire (Tarea 9d)', () => {
    expect(ESCENAS_VALIDAS).toEqual(['camara', 'inicio', 'portada', 'avisos', 'gracias', 'produccion']);
    expect(reducir(enVivo(), { tipo: 'escena', escena: 'produccion' }).escena).toBe('produccion');
  });
  it('terminar con gracias sigue pasando a Gracias, también desde Producción', () => {
    const s = reducir(enVivo(), { tipo: 'escena', escena: 'produccion' });
    expect(reducir(s, { tipo: 'terminar_con_gracias' }).escena).toBe('gracias');
  });
  it('la misma escena devuelve el mismo objeto', () => {
    const s = enVivo();
    expect(reducir(s, { tipo: 'escena', escena: 'inicio' })).toBe(s);
  });
});

describe('reconexión', () => {
  it('reconectando pasa a reconectando y conectado vuelve a en_vivo sin reiniciar segundos', () => {
    const s = aplicar(enVivo(), ...tics(5), { tipo: 'reconectando' });
    expect(s.fase).toBe('reconectando');
    const v = reducir(s, { tipo: 'conectado' });
    expect(v.fase).toBe('en_vivo');
    expect(v.segundos).toBe(5);
  });
  it('reconectando fuera de en_vivo no hace nada', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'reconectando' })).toBe(ESTADO_INICIAL);
  });
  it('conectado en preparando no hace nada', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'conectado' })).toBe(ESTADO_INICIAL);
  });
});

describe('cortado estando al aire (se agotaron los reintentos)', () => {
  it.each(['en_vivo', 'reconectando'] as const)('en %s vuelve a preparando con el error y pide cortar', (fase) => {
    const antes = fase === 'en_vivo'
      ? aplicar(enVivo(), ...tics(3), { tipo: 'escena', escena: 'avisos' })
      : aplicar(enVivo(), ...tics(3), { tipo: 'reconectando' });
    const despues = reducir(antes, { tipo: 'cortado', mensaje: 'Sin señal' });
    expect(despues.fase).toBe('preparando');
    expect(despues.error).toBe('Sin señal');
    expect(despues.cuentaFinal).toBeNull();
    expect(debeCortar(antes, despues)).toBe(true);
  });
  it('en preparando no hace nada', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'cortado', mensaje: 'x' })).toBe(ESTADO_INICIAL);
  });
  it('en terminando se comporta como terminar_ahora: corta una sola vez', () => {
    const { final, cortes } = cortesEn(enVivo(), [
      { tipo: 'terminar_con_gracias' }, ...tics(3), { tipo: 'cortado', mensaje: 'x' }, ...tics(20),
    ]);
    expect(cortes).toBe(1);
    expect(final.fase).toBe('terminando');
    expect(final.cuentaFinal).toBeNull();
  });
  it('en terminando sin cuenta (ya cortado) no vuelve a cortar', () => {
    const { cortes } = cortesEn(enVivo(), [
      { tipo: 'terminar_ahora' }, { tipo: 'cortado', mensaje: 'x' }, { tipo: 'tic' },
    ]);
    expect(cortes).toBe(1);
  });
});

describe('terminar con gracias', () => {
  const conGracias = () => reducir(enVivo(), { tipo: 'terminar_con_gracias' });

  it('deja escena gracias, cuentaFinal 10 y fase terminando', () => {
    const s = conGracias();
    expect(s.escena).toBe('gracias');
    expect(s.cuentaFinal).toBe(10);
    expect(s.fase).toBe('terminando');
  });
  it('desde reconectando también funciona', () => {
    const r = reducir(enVivo(), { tipo: 'reconectando' });
    expect(reducir(r, { tipo: 'terminar_con_gracias' }).fase).toBe('terminando');
  });
  it('10 tic llevan la cuenta a 0 y debeCortar da true una sola vez', () => {
    const { final, cortes } = cortesEn(conGracias(), tics(10));
    expect(final.cuentaFinal).toBe(0);
    expect(cortes).toBe(1);
  });
  it('tic de más después de llegar a 0 no vuelve a cortar ni baja de 0', () => {
    const { final, cortes } = cortesEn(conGracias(), tics(15));
    expect(final.cuentaFinal).toBe(0);
    expect(cortes).toBe(1);
  });
  it('el primer tic no corta (9 restantes)', () => {
    const a = conGracias();
    const b = reducir(a, { tipo: 'tic' });
    expect(b.cuentaFinal).toBe(9);
    expect(debeCortar(a, b)).toBe(false);
  });
  it('los segundos siguen sumando durante la cuenta', () => {
    const base = aplicar(enVivo(), ...tics(4));
    expect(aplicar(base, { tipo: 'terminar_con_gracias' }, ...tics(3)).segundos).toBe(7);
  });
  it('repetir terminar_con_gracias no reinicia la cuenta', () => {
    const s = aplicar(conGracias(), ...tics(4));
    expect(reducir(s, { tipo: 'terminar_con_gracias' })).toBe(s);
  });
  it('no hace nada fuera del aire', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'terminar_con_gracias' })).toBe(ESTADO_INICIAL);
  });
});

describe('seguir', () => {
  it('durante la cuenta vuelve a en_vivo, sin cuenta, y la escena sigue en gracias', () => {
    const s = aplicar(enVivo(), { tipo: 'terminar_con_gracias' }, ...tics(3), { tipo: 'seguir' });
    expect(s.fase).toBe('en_vivo');
    expect(s.cuentaFinal).toBeNull();
    expect(s.escena).toBe('gracias');
  });
  it('no corta en el paso', () => {
    const a = aplicar(enVivo(), { tipo: 'terminar_con_gracias' }, ...tics(3));
    expect(debeCortar(a, reducir(a, { tipo: 'seguir' }))).toBe(false);
  });
  it('si el corte ya salió (sin cuenta) no revive la transmisión', () => {
    const a = reducir(enVivo(), { tipo: 'terminar_ahora' });
    expect(reducir(a, { tipo: 'seguir' })).toBe(a);
  });
  it('fuera de terminando no hace nada', () => {
    const s = enVivo();
    expect(reducir(s, { tipo: 'seguir' })).toBe(s);
  });
});

describe('terminar ahora', () => {
  it('desde en_vivo pasa a terminando sin cuenta y pide cortar', () => {
    const a = enVivo();
    const b = reducir(a, { tipo: 'terminar_ahora' });
    expect(b.fase).toBe('terminando');
    expect(b.cuentaFinal).toBeNull();
    expect(debeCortar(a, b)).toBe(true);
  });
  it('durante la cuenta pide cortar y los tic siguientes no cortan de nuevo', () => {
    const { final, cortes } = cortesEn(enVivo(), [
      { tipo: 'terminar_con_gracias' }, ...tics(4), { tipo: 'terminar_ahora' }, ...tics(20),
    ]);
    expect(cortes).toBe(1);
    expect(final.fase).toBe('terminando');
    expect(final.cuentaFinal).toBeNull();
  });
  it('después de que debeCortar ya salió, otro terminar_ahora no corta de nuevo', () => {
    const { cortes } = cortesEn(enVivo(), [
      { tipo: 'terminar_ahora' }, { tipo: 'terminar_ahora' }, { tipo: 'tic' },
    ]);
    expect(cortes).toBe(1);
  });
  it('después de llegar la cuenta a 0, terminar_ahora no corta de nuevo', () => {
    const { cortes } = cortesEn(enVivo(), [
      { tipo: 'terminar_con_gracias' }, ...tics(10), { tipo: 'terminar_ahora' }, ...tics(3),
    ]);
    expect(cortes).toBe(1);
  });
  it('desde reconectando también termina y corta', () => {
    const a = reducir(enVivo(), { tipo: 'reconectando' });
    const b = reducir(a, { tipo: 'terminar_ahora' });
    expect(b.fase).toBe('terminando');
    expect(debeCortar(a, b)).toBe(true);
  });
  it('fuera del aire no hace nada', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'terminar_ahora' })).toBe(ESTADO_INICIAL);
  });
});

describe('señal que se cae mientras termina (punto 2 del plan)', () => {
  it('reconectando durante la cuenta no la cancela ni la reinicia, y corta una sola vez', () => {
    const { final, cortes } = cortesEn(enVivo(), [
      { tipo: 'terminar_con_gracias' }, ...tics(3),
      { tipo: 'reconectando' },
      ...tics(7),
    ]);
    expect(final.cuentaFinal).toBe(0);
    expect(final.fase).toBe('terminando');
    expect(cortes).toBe(1);
  });
  it('reconectando y conectado durante la cuenta no cambian el estado', () => {
    const t = aplicar(enVivo(), { tipo: 'terminar_con_gracias' }, ...tics(3));
    expect(reducir(t, { tipo: 'reconectando' })).toBe(t);
    expect(reducir(t, { tipo: 'conectado' })).toBe(t);
  });
  it('terminar_ahora con la señal caída también corta una sola vez', () => {
    const { cortes } = cortesEn(enVivo(), [
      { tipo: 'reconectando' }, { tipo: 'terminar_ahora' }, { tipo: 'reconectando' }, ...tics(5),
    ]);
    expect(cortes).toBe(1);
  });
});

describe('terminado', () => {
  it.each(['preparando', 'iniciando', 'en_vivo', 'reconectando', 'terminando'] as const)(
    'desde %s pasa a terminado', (fase) => {
      const base: Record<string, EstadoTransmision> = {
        preparando: ESTADO_INICIAL,
        iniciando: reducir(ESTADO_INICIAL, { tipo: 'iniciar' }),
        en_vivo: enVivo(),
        reconectando: reducir(enVivo(), { tipo: 'reconectando' }),
        terminando: reducir(enVivo(), { tipo: 'terminar_con_gracias' }),
      };
      const s = reducir(base[fase], { tipo: 'terminado' });
      expect(s.fase).toBe('terminado');
      expect(s.cuentaFinal).toBeNull();
      expect(debeCortar(base[fase], s)).toBe(false);
    },
  );
  it('desde terminado devuelve el mismo objeto', () => {
    const t = reducir(enVivo(), { tipo: 'terminado' });
    expect(reducir(t, { tipo: 'terminado' })).toBe(t);
  });
  it('en terminado todo lo demás se ignora', () => {
    const t = reducir(enVivo(), { tipo: 'terminado' });
    for (const ev of [{ tipo: 'tic' }, { tipo: 'conectado' }, { tipo: 'reconectando' }, { tipo: 'seguir' },
      { tipo: 'terminar_ahora' }, { tipo: 'escena', escena: 'avisos' }] as Evento[]) {
      expect(reducir(t, ev)).toBe(t);
    }
  });
});

describe('pureza', () => {
  it('no muta la entrada ni el estado inicial', () => {
    const entrada = Object.freeze({ ...enVivo() });
    const evs: Evento[] = [
      { tipo: 'tic' }, { tipo: 'escena', escena: 'gracias' }, { tipo: 'reconectando' },
      { tipo: 'terminar_con_gracias' }, { tipo: 'terminar_ahora' }, { tipo: 'cortado', mensaje: 'x' },
      { tipo: 'terminado' }, { tipo: 'seguir' }, { tipo: 'iniciar' }, { tipo: 'conectado' },
    ];
    const copia = { ...entrada };
    for (const ev of evs) {
      expect(() => reducir(entrada, ev)).not.toThrow();
      expect(entrada).toEqual(copia);
    }
    expect(ESTADO_INICIAL).toEqual({
      fase: 'preparando', escena: 'inicio', segundos: 0, cuentaFinal: null, error: null,
    });
  });
  it('devuelve un objeto nuevo cuando algo cambia', () => {
    const s = enVivo();
    expect(reducir(s, { tipo: 'tic' })).not.toBe(s);
  });
});

describe('debeCortar', () => {
  it('es false cuando no cambia nada', () => {
    const s = enVivo();
    expect(debeCortar(s, s)).toBe(false);
  });
  it('es false en un tic normal en vivo', () => {
    const s = enVivo();
    expect(debeCortar(s, reducir(s, { tipo: 'tic' }))).toBe(false);
  });
});

describe('volver a transmitir después de terminar (Tarea 8)', () => {
  it('iniciar desde terminado arranca de cero: iniciando, escena inicio, sin tiempo ni error', () => {
    const t = aplicar(enVivo(), ...tics(5), { tipo: 'terminar_con_gracias' }, ...tics(10), { tipo: 'terminado' });
    expect(t.fase).toBe('terminado');
    const s = reducir(t, { tipo: 'iniciar' });
    expect(s).toEqual({ ...ESTADO_INICIAL, fase: 'iniciando' });
    expect(debeCortar(t, s)).toBe(false);
  });
});

describe('cortado en preparando (review N2 de la Tarea 6)', () => {
  it('se ignora: mismo objeto y sin corte', () => {
    expect(reducir(ESTADO_INICIAL, { tipo: 'cortado', mensaje: 'x' })).toBe(ESTADO_INICIAL);
  });
  it('un segundo cortado después del primero no corta dos veces', () => {
    const { final, cortes } = cortesEn(enVivo(), [
      { tipo: 'cortado', mensaje: 'Facebook no respondió.' },
      { tipo: 'cortado', mensaje: 'No se pudo volver a preparar la cámara.' },
    ]);
    expect(cortes).toBe(1);
    expect(final.fase).toBe('preparando');
    // Queda el primer mensaje: el segundo se ignora entero.
    expect(final.error).toBe('Facebook no respondió.');
  });
});
