import { crearLimpiezas } from '../sincronizar/sincronizar';
import { crearElecciones, llaveElecciones, registrarElecciones, type NativoElecciones } from './elecciones';

function nativoFalso() {
  const archivos = new Map<string, string>();
  const n = {
    archivos,
    leerDatosApp: jest.fn(async (nombre: string) => archivos.get(nombre) ?? null),
    guardarDatosApp: jest.fn(async (nombre: string, texto: string) => {
      archivos.set(nombre, texto);
    }),
    borrarDatosApp: jest.fn(async (prefijo: string) => {
      for (const k of [...archivos.keys()]) {
        if (prefijo.endsWith('-') ? k.startsWith(prefijo) : k === prefijo) archivos.delete(k);
      }
    }),
  };
  return n;
}

describe('elecciones', () => {
  it('sin nada guardado, leer da null (se usan las porDefecto)', async () => {
    const e = crearElecciones(nativoFalso() as NativoElecciones);
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
  });

  it('guarda y lee por slug, sin mezclar parroquias', async () => {
    const e = crearElecciones(nativoFalso() as NativoElecciones);
    await e.guardarElecciones('ciudad-arce', ['p1', 'p2']);
    await e.guardarElecciones('san-jose', []);
    await expect(e.leerElecciones('ciudad-arce')).resolves.toEqual(['p1', 'p2']);
    // Una lista vacía es una elección (ninguna extra), no «sin elegir».
    await expect(e.leerElecciones('san-jose')).resolves.toEqual([]);
    await expect(e.leerElecciones('otra')).resolves.toBeNull();
  });

  it('la llave lleva la versión y el slug', () => {
    expect(llaveElecciones('ciudad-arce')).toContain('ciudad-arce');
    expect(llaveElecciones('ciudad-arce')).toContain('v1');
  });

  it('un archivo roto o con otra forma da null', async () => {
    const n = nativoFalso();
    const e = crearElecciones(n as NativoElecciones);
    n.archivos.set(llaveElecciones('ciudad-arce'), '{roto');
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
    n.archivos.set(llaveElecciones('ciudad-arce'), JSON.stringify({ ids: 'x' }));
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
    n.archivos.set(llaveElecciones('ciudad-arce'), JSON.stringify([1, 2]));
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
  });

  it('un nativo que rechaza al leer da null', async () => {
    const n = nativoFalso();
    n.leerDatosApp.mockRejectedValueOnce(new Error('x'));
    const e = crearElecciones(n as NativoElecciones);
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
  });

  it('un slug inválido no toca el almacén', async () => {
    const n = nativoFalso();
    const e = crearElecciones(n as NativoElecciones);
    await expect(e.guardarElecciones('../x', ['a'])).rejects.toThrow();
    await expect(e.leerElecciones('../x')).resolves.toBeNull();
    expect(n.guardarDatosApp).not.toHaveBeenCalled();
  });

  it('borrarElecciones borra las de todas las parroquias', async () => {
    const n = nativoFalso();
    const e = crearElecciones(n as NativoElecciones);
    await e.guardarElecciones('ciudad-arce', ['p1']);
    await e.guardarElecciones('san-jose', ['p2']);
    n.archivos.set('semana-ciudad-arce', 'no tocar');
    await e.borrarElecciones();
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
    await expect(e.leerElecciones('san-jose')).resolves.toBeNull();
    expect(n.archivos.get('semana-ciudad-arce')).toBe('no tocar');
  });

  it('borrarEleccionesDe borra solo la de esa parroquia', async () => {
    const e = crearElecciones(nativoFalso() as NativoElecciones);
    await e.guardarElecciones('ciudad-arce', ['p1']);
    await e.guardarElecciones('san-jose', ['p2']);
    await e.borrarEleccionesDe('ciudad-arce');
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
    await expect(e.leerElecciones('san-jose')).resolves.toEqual(['p2']);
  });
});

describe('registrarElecciones (limpieza de cuentas)', () => {
  const PARROQUIA = { id: 'p-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };

  it('limpiar todo borra las elecciones de todas las parroquias', async () => {
    const e = crearElecciones(nativoFalso() as NativoElecciones);
    await e.guardarElecciones('ciudad-arce', ['p1']);
    await e.guardarElecciones('san-jose', ['p2']);
    const l = crearLimpiezas();
    registrarElecciones(l, e);
    await expect(l.limpiar({ tipo: 'todo' })).resolves.toEqual({ elecciones: 'ok' });
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
    await expect(e.leerElecciones('san-jose')).resolves.toBeNull();
  });

  it('limpiar una parroquia borra solo la suya', async () => {
    const e = crearElecciones(nativoFalso() as NativoElecciones);
    await e.guardarElecciones('ciudad-arce', ['p1']);
    await e.guardarElecciones('san-jose', ['p2']);
    const l = crearLimpiezas();
    registrarElecciones(l, e);
    await l.limpiar({ tipo: 'parroquia', parroquia: PARROQUIA });
    await expect(e.leerElecciones('ciudad-arce')).resolves.toBeNull();
    await expect(e.leerElecciones('san-jose')).resolves.toEqual(['p2']);
  });
});
