import type { ClienteFacebook, Destinos, ResultadoFacebook, VivoCreado } from './cliente';
import { PLAZO_CREAR_MS } from './cliente';
import { crearVivoFacebook, extrasElegidos } from './vivo';

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

function armar(c: Partial<ClienteFacebook> = {}) {
  const cliente: ClienteFacebook = {
    destinos: jest.fn(async (): Promise<ResultadoFacebook<Destinos>> => ({ ok: true, valor: DESTINOS })),
    crear: jest.fn(async (): Promise<ResultadoFacebook<VivoCreado>> => ({ ok: true, valor: VIVO })),
    estado: jest.fn(),
    terminar: jest.fn(async (): Promise<ResultadoFacebook<void>> => ({ ok: true, valor: undefined })),
    ...c,
  };
  return { cliente, ...crearVivoFacebook({ cliente, titulo: () => 'Misa dominical · Parroquia' }) };
}

describe('pedirVivo', () => {
  it('crea el vivo con los extras por defecto y el título, y devuelve servidor, clave e id', async () => {
    const { cliente, pedirVivo } = armar();
    await expect(pedirVivo()).resolves.toEqual({ servidor: VIVO.servidor, clave: VIVO.clave, id: 'v1' });
    expect(cliente.crear).toHaveBeenCalledWith(['e1'], 'Misa dominical · Parroquia');
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

describe('extrasElegidos', () => {
  it('son los marcados por defecto', () => {
    expect(extrasElegidos(DESTINOS)).toEqual(['e1']);
  });
});
