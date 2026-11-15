/**
 * @jest-environment node
 */
// El almacén de la semana y de los pendientes (Tarea 11 del plan 3b).
import { crearAlmacenSemana, type CacheSemana, type NativoDatos, type Pendiente } from './almacen';

function nativoFalso() {
  const archivos = new Map<string, string>();
  const n = {
    archivos,
    leerDatosApp: jest.fn(async (nombre: string) => archivos.get(nombre) ?? null),
    guardarDatosApp: jest.fn(async (nombre: string, texto: string) => {
      archivos.set(nombre, texto);
    }),
    borrarDatosApp: jest.fn(async (prefijo: string) => {
      // Como DatosApp.kt: con «-» al final es un prefijo; sin él, el nombre exacto.
      for (const k of [...archivos.keys()]) {
        if (prefijo.endsWith('-') ? k.startsWith(prefijo) : k === prefijo) archivos.delete(k);
      }
    }),
  };
  return n;
}

const CACHE: CacheSemana = {
  version: 1,
  parroquiaId: 'p1',
  desde: '2026-11-16',
  hasta: '2026-11-29',
  bajadaEn: '2026-11-19T16:00:00.000Z',
  fijas: [],
  series: [],
  transmisiones: [],
  tipos: null,
};

function pendiente(clave: string, extra: Partial<Pendiente> = {}): Pendiente {
  return {
    clave,
    fecha: '2026-11-19',
    hora: '18:00',
    tipo: 'dominical',
    origen: 'fija',
    fijaId: 'f1',
    serieId: null,
    datos: { celebrante: 'P. Ana' },
    editadoEn: '2026-11-19T16:00:00.000Z',
    rechazado: false,
    ...extra,
  };
}

test('guardar y leer la cache da lo mismo', async () => {
  const n = nativoFalso();
  const a = crearAlmacenSemana(n as NativoDatos);
  await a.guardarCache('ciudad-arce', CACHE);
  expect(n.archivos.has('semana-ciudad-arce')).toBe(true);
  await expect(a.leerCache('ciudad-arce')).resolves.toEqual(CACHE);
});

test('una cache rota, de otra versión o sin fijas da null', async () => {
  const n = nativoFalso();
  const a = crearAlmacenSemana(n as NativoDatos);
  n.archivos.set('semana-ciudad-arce', '{roto');
  await expect(a.leerCache('ciudad-arce')).resolves.toBeNull();
  n.archivos.set('semana-ciudad-arce', JSON.stringify({ ...CACHE, version: 2 }));
  await expect(a.leerCache('ciudad-arce')).resolves.toBeNull();
  const { fijas: _f, ...sinFijas } = CACHE;
  n.archivos.set('semana-ciudad-arce', JSON.stringify(sinFijas));
  await expect(a.leerCache('ciudad-arce')).resolves.toBeNull();
});

test('un nativo que rechaza al leer da null y avisa sin el contenido', async () => {
  const n = nativoFalso();
  n.leerDatosApp.mockRejectedValueOnce(new Error('contenido-secreto'));
  const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const a = crearAlmacenSemana(n as NativoDatos);
  await expect(a.leerCache('ciudad-arce')).resolves.toBeNull();
  expect(aviso).toHaveBeenCalledWith('semana: no se pudo leer');
  expect(JSON.stringify(aviso.mock.calls)).not.toContain('contenido-secreto');
  aviso.mockRestore();
});

test('pendientes: uno por clave, rechazar, quitar y datos limpios', async () => {
  const n = nativoFalso();
  const a = crearAlmacenSemana(n as NativoDatos);
  await a.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
  await a.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19', { datos: { celebrante: 'P. Luis' } }));
  let lista = await a.leerPendientes('ciudad-arce');
  expect(lista).toHaveLength(1);
  expect(lista[0].datos).toEqual({ celebrante: 'P. Luis' });

  await a.marcarRechazado('ciudad-arce', 'fija:f1:2026-11-19');
  lista = await a.leerPendientes('ciudad-arce');
  expect(lista[0].rechazado).toBe(true);

  await a.quitarPendiente('ciudad-arce', 'fija:f1:2026-11-19');
  await expect(a.leerPendientes('ciudad-arce')).resolves.toEqual([]);

  await a.guardarPendiente(
    'ciudad-arce',
    pendiente('fija:f1:2026-11-20', { datos: { celebrante: 'P. Ana', clave: 'FB-PRUEBA-MARCA-1111' } as never }),
  );
  lista = await a.leerPendientes('ciudad-arce');
  expect(lista[0].datos).toEqual({ celebrante: 'P. Ana' });
  expect(n.archivos.get('pendientes-ciudad-arce')).not.toContain('FB-PRUEBA-MARCA-1111');
});

test('borrar una parroquia y borrar todo', async () => {
  const n = nativoFalso();
  const a = crearAlmacenSemana(n as NativoDatos);
  await a.guardarCache('ciudad-arce', CACHE);
  await a.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
  await a.guardarCache('ciudad-arce-norte', CACHE);
  await a.borrar('ciudad-arce');
  expect([...n.archivos.keys()]).toEqual(['semana-ciudad-arce-norte']);
  await a.borrarTodo();
  expect(n.borrarDatosApp).toHaveBeenCalledWith('semana-');
  expect(n.borrarDatosApp).toHaveBeenCalledWith('pendientes-');
});
