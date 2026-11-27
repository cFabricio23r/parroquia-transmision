import type { ClienteFacebook, Destinos, ResultadoFacebook, VivoCreado } from './cliente';
import { PLAZO_CREAR_MS } from './cliente';
import { chipsFacebook, crearVivoFacebook, extrasElegidos, resumenTira } from './vivo';

const DESTINOS: Destinos = {
  conectado: true,
  principal: { id: 'p1', nombre: 'Principal' },
  extras: [
    { id: 'e1', nombre: 'Uno', porDefecto: true },
    { id: 'e2', nombre: 'Dos', porDefecto: false },
  ],
};
const VIVO: VivoCreado = {
  id: 'v1',
  servidor: 'rtmps://vivo.example:443/rtmp/',
  clave: 'VIVO-PRUEBA-0000',
  principal: { id: 'p1', nombre: 'Principal' },
  extras: [],
};
const MAL = { ok: false, error: { tipo: 'otro' } } as const;

function armar(c: Partial<ClienteFacebook> = {}, elecciones?: () => Promise<string[] | null>) {
  const cliente: ClienteFacebook = {
    destinos: jest.fn(async (): Promise<ResultadoFacebook<Destinos>> => ({ ok: true, valor: DESTINOS })),
    crear: jest.fn(async (): Promise<ResultadoFacebook<VivoCreado>> => ({ ok: true, valor: VIVO })),
    estado: jest.fn(),
    terminar: jest.fn(async (): Promise<ResultadoFacebook<void>> => ({ ok: true, valor: undefined })),
    ...c,
  };
  return { cliente, ...crearVivoFacebook({ cliente, titulo: () => 'Misa dominical · Parroquia', elecciones }) };
}

describe('pedirVivo', () => {
  it('crea el vivo con los extras por defecto y el título, y devuelve servidor, clave e id', async () => {
    const { cliente, pedirVivo } = armar();
    await expect(pedirVivo()).resolves.toEqual({
      servidor: VIVO.servidor,
      clave: VIVO.clave,
      id: 'v1',
      principal: 'Principal',
      extras: [],
    });
    expect(cliente.crear).toHaveBeenCalledWith(['e1'], 'Misa dominical · Parroquia');
  });

  it('devuelve los nombres de las páginas del vivo para mostrarlos', async () => {
    const { pedirVivo } = armar({
      crear: jest.fn(async () => ({
        ok: true as const,
        valor: { ...VIVO, extras: [{ id: 'e1', nombre: 'Uno' }] },
      })),
    });
    await expect(pedirVivo()).resolves.toMatchObject({ principal: 'Principal', extras: ['Uno'] });
  });

  it('con una elección guardada usa esa y no las porDefecto', async () => {
    const { cliente, pedirVivo } = armar({}, async () => ['e2']);
    await pedirVivo();
    expect(cliente.crear).toHaveBeenCalledWith(['e2'], 'Misa dominical · Parroquia');
  });

  it('una elección vacía es «ninguna extra»', async () => {
    const { cliente, pedirVivo } = armar({}, async () => []);
    await pedirVivo();
    expect(cliente.crear).toHaveBeenCalledWith([], 'Misa dominical · Parroquia');
  });

  it('si leer las elecciones falla o da null, usa las porDefecto', async () => {
    const a = armar({}, async () => null);
    await a.pedirVivo();
    expect(a.cliente.crear).toHaveBeenCalledWith(['e1'], expect.any(String));
    const b = armar({}, () => Promise.reject(new Error('x')));
    await b.pedirVivo();
    expect(b.cliente.crear).toHaveBeenCalledWith(['e1'], expect.any(String));
  });

  it('principal null: null y no crea nada', async () => {
    const { cliente, pedirVivo } = armar({
      destinos: jest.fn(async () => ({ ok: true as const, valor: { ...DESTINOS, principal: null } })),
    });
    await expect(pedirVivo()).resolves.toBeNull();
    expect(cliente.crear).not.toHaveBeenCalled();
  });

  it('no conectado: null', async () => {
    const { pedirVivo } = armar({
      destinos: jest.fn(async () => ({ ok: true as const, valor: { ...DESTINOS, conectado: false } })),
    });
    await expect(pedirVivo()).resolves.toBeNull();
  });

  it('destinos falla: {error:true}, nunca bloquea', async () => {
    const { pedirVivo } = armar({ destinos: jest.fn(async () => MAL) });
    await expect(pedirVivo()).resolves.toEqual({ error: true });
  });

  it('crear falla (cualquier tipo): {error:true}', async () => {
    const { pedirVivo } = armar({ crear: jest.fn(async () => ({ ok: false as const, error: { tipo: 'sin-conexion' as const } })) });
    await expect(pedirVivo()).resolves.toEqual({ error: true });
  });
});

describe('tope de 8 s', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('destinos nunca responde: a los 8 s da {error:true}', async () => {
    const { pedirVivo } = armar({ destinos: jest.fn(() => new Promise<never>(() => {})) });
    const r = jest.fn();
    void pedirVivo().then(r);
    jest.advanceTimersByTime(PLAZO_CREAR_MS - 1);
    await Promise.resolve();
    expect(r).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(r).toHaveBeenCalledWith({ error: true });
  });

  it('un crear que llega tarde se descarta y se cierra una vez', async () => {
    let soltar!: (v: ResultadoFacebook<VivoCreado>) => void;
    const { cliente, pedirVivo } = armar({ crear: jest.fn(() => new Promise<ResultadoFacebook<VivoCreado>>((res) => (soltar = res))) });
    const r = jest.fn();
    void pedirVivo().then(r);
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(PLAZO_CREAR_MS);
    await Promise.resolve();
    expect(r).toHaveBeenCalledWith({ error: true });
    soltar({ ok: true, valor: VIVO });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(r).toHaveBeenCalledTimes(1);
    expect(cliente.terminar).toHaveBeenCalledTimes(1);
    expect(cliente.terminar).toHaveBeenCalledWith('v1');
  });
});

describe('terminarVivo', () => {
  it('llama a terminar(id)', async () => {
    const { cliente, terminarVivo } = armar();
    await terminarVivo('v1');
    expect(cliente.terminar).toHaveBeenCalledWith('v1');
  });

  it('rechaza si el cliente dice ok:false, para que el orquestador reintente', async () => {
    const { terminarVivo } = armar({ terminar: jest.fn(async () => MAL) });
    await expect(terminarVivo('v1')).rejects.toThrow();
  });
});

describe('estadoVivo', () => {
  it('devuelve el estado del cliente, o null si no se pudo saber', async () => {
    const valor = { estado: 'activo' as const, extras: [{ id: 'e1', nombre: 'Uno', salio: true }] };
    const ok = armar({ estado: jest.fn(async () => ({ ok: true as const, valor })) });
    await expect(ok.estadoVivo('v1')).resolves.toEqual(valor);
    expect(ok.cliente.estado).toHaveBeenCalledWith('v1');
    const mal = armar({ estado: jest.fn(async () => MAL) });
    await expect(mal.estadoVivo('v1')).resolves.toBeNull();
    const rechaza = armar({ estado: jest.fn(() => Promise.reject(new Error('x'))) });
    await expect(rechaza.estadoVivo('v1')).resolves.toBeNull();
  });
});

describe('extrasElegidos', () => {
  it('sin elección (null) son los marcados por defecto', () => {
    expect(extrasElegidos(DESTINOS, null)).toEqual(['e1']);
  });

  it('con elección, solo las que siguen asignadas, en el orden de la plataforma', () => {
    expect(extrasElegidos(DESTINOS, ['e2', 'e1'])).toEqual(['e1', 'e2']);
    expect(extrasElegidos(DESTINOS, ['e2', 'ya-no-existe'])).toEqual(['e2']);
    expect(extrasElegidos(DESTINOS, [])).toEqual([]);
  });
});

describe('resumenTira', () => {
  it('principal y extras elegidas unidas con « y »', () => {
    const d: Destinos = {
      ...DESTINOS,
      extras: [...DESTINOS.extras, { id: 'e3', nombre: 'Tres', porDefecto: false }],
    };
    expect(resumenTira(d, ['e1', 'e3'])).toEqual({ principal: 'Principal', extras: 'Uno y Tres' });
    expect(resumenTira(d, null)).toEqual({ principal: 'Principal', extras: 'Uno' });
    expect(resumenTira(d, [])).toEqual({ principal: 'Principal', extras: null });
  });

  it('sin conexión o sin principal no hay tira', () => {
    expect(resumenTira({ ...DESTINOS, conectado: false }, null)).toBeNull();
    expect(resumenTira({ ...DESTINOS, principal: null }, null)).toBeNull();
  });
});

describe('chipsFacebook', () => {
  it('antes de revisar: verde con la principal y nada ámbar', () => {
    const v = { principal: 'Ciudad Arce', extras: [{ nombre: 'Vicaría', salio: null }] };
    expect(chipsFacebook(v)).toEqual({ verde: 'En vivo en Ciudad Arce', ambar: [] });
  });

  it('verde con la principal y las que salieron; una ámbar por cada una que no salió', () => {
    const v = {
      principal: 'Ciudad Arce',
      extras: [
        { nombre: 'Vicaría', salio: true },
        { nombre: 'Sector 3', salio: false },
        { nombre: 'Sector 5', salio: true },
      ],
    };
    expect(chipsFacebook(v)).toEqual({
      verde: 'En vivo en Ciudad Arce y Vicaría y Sector 5',
      ambar: ['No salió en Sector 3. Avisa al coordinador.'],
    });
  });

  it('sin vivo: nada', () => {
    expect(chipsFacebook(null)).toEqual({ verde: null, ambar: [] });
  });
});
