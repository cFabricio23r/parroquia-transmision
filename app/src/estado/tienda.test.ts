import { crearTienda } from './tienda';
import { ESTADO_INICIAL, type EstadoTransmision } from './transmision';

describe('crearTienda', () => {
  it('empieza en el estado inicial', () => {
    const t = crearTienda(() => {});
    expect(t.obtener()).toBe(ESTADO_INICIAL);
  });

  it('despachar aplica el reducer y avisa a los oyentes', () => {
    const t = crearTienda(() => {});
    const cb = jest.fn();
    t.suscribir(cb);
    t.despachar({ tipo: 'iniciar' });
    expect(t.obtener().fase).toBe('iniciando');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('si el evento no cambia nada, no avisa', () => {
    const t = crearTienda(() => {});
    const cb = jest.fn();
    t.suscribir(cb);
    t.despachar({ tipo: 'tic' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('dejar de escuchar quita al oyente', () => {
    const t = crearTienda(() => {});
    const cb = jest.fn();
    const quitar = t.suscribir(cb);
    quitar();
    t.despachar({ tipo: 'iniciar' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('llama a alCortar una vez cuando debeCortar da true, con el estado nuevo', () => {
    const cortes: EstadoTransmision[] = [];
    const t = crearTienda((d) => cortes.push(d));
    t.despachar({ tipo: 'iniciar' });
    t.despachar({ tipo: 'conectado' });
    t.despachar({ tipo: 'terminar_con_gracias' });
    for (let i = 0; i < 9; i++) t.despachar({ tipo: 'tic' });
    expect(cortes).toHaveLength(0);
    t.despachar({ tipo: 'tic' });
    expect(cortes).toHaveLength(1);
    expect(cortes[0].fase).toBe('terminando');
    expect(cortes[0].cuentaFinal).toBe(0);
    // Más tics y un terminar ahora no vuelven a cortar.
    t.despachar({ tipo: 'tic' });
    t.despachar({ tipo: 'terminar_ahora' });
    expect(cortes).toHaveLength(1);
  });

  it('ve cada paso aunque se despachen varios seguidos (no se pierde un corte)', () => {
    const cortes: EstadoTransmision[] = [];
    const t = crearTienda((d) => cortes.push(d));
    t.despachar({ tipo: 'iniciar' });
    t.despachar({ tipo: 'conectado' });
    // Un corte y en seguida otro evento, en el mismo turno.
    t.despachar({ tipo: 'cortado', mensaje: 'Se cortó.' });
    t.despachar({ tipo: 'iniciar' });
    expect(cortes).toHaveLength(1);
    expect(cortes[0].fase).toBe('preparando');
    expect(t.obtener().fase).toBe('iniciando');
  });

  it('el estado ya está actualizado cuando se llama a alCortar', () => {
    let visto: EstadoTransmision | null = null;
    const t = crearTienda(() => {
      visto = t.obtener();
    });
    t.despachar({ tipo: 'iniciar' });
    t.despachar({ tipo: 'terminar_ahora' });
    expect(visto).not.toBeNull();
    expect(visto!.fase).toBe('preparando');
  });

  it('un evento despachado desde alCortar se aplica después del corte', () => {
    const t = crearTienda((d) => {
      if (d.fase === 'terminando') t.despachar({ tipo: 'terminado' });
    });
    t.despachar({ tipo: 'iniciar' });
    t.despachar({ tipo: 'conectado' });
    t.despachar({ tipo: 'terminar_ahora' });
    expect(t.obtener().fase).toBe('terminado');
  });
});
