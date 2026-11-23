// Misas listas compartidas: la tabla guardadas, sus políticas, el choque panel/app («gana lo último»),
// el borrado que se sincroniza, el tope de 200, usar_guardada y el registro, contra el Supabase LOCAL
// con sesiones reales. Cada prueba crea su propia parroquia con slug al azar.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerMiembro,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';

const hace = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();
const T1 = hace(3);
const T2 = hace(2);
const T3 = hace(1);

let coordinador: UsuarioPrueba;
let ajeno: UsuarioPrueba;

beforeAll(async () => {
  coordinador = await crearUsuario(`gua-a-${sufijo()}@prueba.local`, CLAVE);
  ajeno = await crearUsuario(`gua-b-${sufijo()}@prueba.local`, CLAVE);
}, 60_000);

/** Parroquia nueva (slug al azar) con `coordinador` de miembro. */
async function parroquiaPropia() {
  const p = await crearParroquia('gua');
  await hacerMiembro(p.id, coordinador.id);
  return p;
}

function id(): string {
  return `g${sufijo()}${sufijo()}`.slice(0, 12);
}

function fila(parroquia: string, extra: Record<string, unknown> = {}) {
  return {
    parroquia_id: parroquia,
    id: id(),
    nombre: `Misa ${sufijo()}`,
    tipo: 'dominical',
    datos: {},
    guardada_en: T1,
    usada_en: T1,
    actualizado_en: T1,
    actualizado_desde: 'app',
    borrada_en: null,
    ...extra,
  };
}

const subir = (fila: Record<string, unknown>) =>
  coordinador.cliente.from('guardadas').upsert(fila, { onConflict: 'parroquia_id,id' }).select('*').single();

const leer = async (parroquia: string, idFila: string) =>
  (await servicio.from('guardadas').select('*').eq('parroquia_id', parroquia).eq('id', idFila).single()).data;

describe('RLS', () => {
  it('anon no lee ni escribe', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    expect((await servicio.from('guardadas').insert(f)).error).toBeNull();
    const anon = clienteAnonimo();
    const r = await anon.from('guardadas').select('id');
    expect(r.error === null ? r.data : []).toEqual([]);
    const w = await anon.from('guardadas').insert(fila(p.id));
    expect(w.error).not.toBeNull();
  });

  it('un coordinador de otra parroquia no ve ni escribe las guardadas', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    expect((await servicio.from('guardadas').insert(f)).error).toBeNull();

    const ver = await ajeno.cliente.from('guardadas').select('id').eq('parroquia_id', p.id);
    expect(ver.error).toBeNull();
    expect(ver.data).toEqual([]);

    const ins = await ajeno.cliente.from('guardadas').insert(fila(p.id));
    expect(ins.error?.message).toMatch(/row-level security/);

    const act = await ajeno.cliente
      .from('guardadas')
      .update({ nombre: 'Robada' })
      .eq('parroquia_id', p.id)
      .eq('id', f.id)
      .select('id');
    expect(act.data ?? []).toEqual([]);
    expect((await leer(p.id, f.id))!.nombre).toBe(f.nombre);

    const uso = await ajeno.cliente.rpc('usar_guardada', { p_parroquia: p.id, p_id: f.id, p_cuando: T3 });
    expect(uso.error).toBeNull();
    expect(new Date((await leer(p.id, f.id))!.usada_en).getTime()).toBe(new Date(T1).getTime());
  });
});

describe('el choque panel/app', () => {
  it('gana lo último', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    const nueva = await subir({ ...f, datos: { a: 1 }, actualizado_en: T2 });
    expect(nueva.error).toBeNull();
    const vieja = await subir({ ...f, datos: { a: 0 }, actualizado_en: T1 });
    expect(vieja.error).toBeNull();
    expect(vieja.data!.datos).toEqual({ a: 1 });
    expect((await leer(p.id, f.id))!.datos).toEqual({ a: 1 });
  });

  it('cargar no pisa datos', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    expect((await subir({ ...f, datos: { a: 1 }, actualizado_en: T2 })).error).toBeNull();
    // El upsert viejo (datos de T1) llega con un usada_en más nuevo: los datos no se pisan, el uso sí sube.
    const r = await subir({ ...f, datos: { a: 0 }, actualizado_en: T1, usada_en: T3 });
    expect(r.error).toBeNull();
    const fin = await leer(p.id, f.id);
    expect(fin!.datos).toEqual({ a: 1 });
    expect(new Date(fin!.usada_en).getTime()).toBe(new Date(T3).getTime());
  });

  it('usar_guardada sube usada_en y nunca lo baja', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    expect((await subir(f)).error).toBeNull();
    const usar = (cuando: string) =>
      coordinador.cliente.rpc('usar_guardada', { p_parroquia: p.id, p_id: f.id, p_cuando: cuando });
    expect((await usar(T3)).error).toBeNull();
    expect(new Date((await leer(p.id, f.id))!.usada_en).getTime()).toBe(new Date(T3).getTime());
    expect((await usar(T2)).error).toBeNull();
    expect(new Date((await leer(p.id, f.id))!.usada_en).getTime()).toBe(new Date(T3).getTime());
    // usar no cuenta como edición: actualizado_en no se mueve.
    expect(new Date((await leer(p.id, f.id))!.actualizado_en).getTime()).toBe(new Date(T1).getTime());
  });

  it('la hora del futuro se recorta a now()', async () => {
    const p = await parroquiaPropia();
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    const r = await subir(fila(p.id, { actualizado_en: futuro, usada_en: futuro, guardada_en: futuro }));
    expect(r.error).toBeNull();
    const tope = Date.now() + 60_000;
    expect(new Date(r.data!.actualizado_en).getTime()).toBeLessThanOrEqual(tope);
    expect(new Date(r.data!.usada_en).getTime()).toBeLessThanOrEqual(tope);
    expect(new Date(r.data!.guardada_en).getTime()).toBeLessThanOrEqual(tope);
    const uso = await coordinador.cliente.rpc('usar_guardada', {
      p_parroquia: p.id,
      p_id: r.data!.id,
      p_cuando: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(uso.error).toBeNull();
    expect(new Date((await leer(p.id, r.data!.id))!.usada_en).getTime()).toBeLessThanOrEqual(tope);
  });
});

describe('el borrado', () => {
  it('una edición posterior al borrado la devuelve', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    expect((await subir(f)).error).toBeNull();
    const borrada = await subir({ ...f, borrada_en: T2, actualizado_en: T2 });
    expect(borrada.error).toBeNull();
    expect(borrada.data!.borrada_en).not.toBeNull();
    const editada = await subir({ ...f, datos: { a: 2 }, borrada_en: null, actualizado_en: T3 });
    expect(editada.error).toBeNull();
    const fin = await leer(p.id, f.id);
    expect(fin!.borrada_en).toBeNull();
    expect(fin!.datos).toEqual({ a: 2 });
  });

  it('una copia vieja no resucita', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id);
    expect((await subir(f)).error).toBeNull();
    expect((await subir({ ...f, borrada_en: T2, actualizado_en: T2 })).error).toBeNull();
    const vieja = await subir({ ...f, borrada_en: null, actualizado_en: T1 });
    expect(vieja.error).toBeNull();
    expect((await leer(p.id, f.id))!.borrada_en).not.toBeNull();
  });
});

describe('nombre y datos', () => {
  it('nombre repetido entre activas da 23505; con la otra borrada, se puede', async () => {
    const p = await parroquiaPropia();
    const nombre = `Hora Santa ${sufijo()}`;
    const una = fila(p.id, { nombre });
    expect((await subir(una)).error).toBeNull();
    const otra = fila(p.id, { nombre: `  ${nombre.toUpperCase()} ` });
    const choque = await subir(otra);
    expect(choque.error?.code).toBe('23505');
    // Con la primera borrada, el nombre queda libre.
    expect((await subir({ ...una, borrada_en: T2, actualizado_en: T2 })).error).toBeNull();
    expect((await subir(otra)).error).toBeNull();
  });

  it('datos de 16 KB entran y de 20 KB no', async () => {
    const p = await parroquiaPropia();
    const texto = (n: number) => {
      let s = '';
      while (s.length < n) s += Math.random().toString(36).slice(2);
      return s.slice(0, n);
    };
    const entra = await subir(fila(p.id, { datos: { nota: texto(16_000) } }));
    expect(entra.error).toBeNull();
    const no = await subir(fila(p.id, { datos: { nota: texto(20_000) } }));
    expect(no.error).not.toBeNull();
  });

  it('rechaza id, tipo y datos malos', async () => {
    const p = await parroquiaPropia();
    expect((await subir(fila(p.id, { id: 'ab' }))).error).not.toBeNull();
    expect((await subir(fila(p.id, { id: 'AAAAAAAA' }))).error).not.toBeNull();
    expect((await subir(fila(p.id, { tipo: 'X' }))).error).not.toBeNull();
    expect((await subir(fila(p.id, { datos: [] }))).error).not.toBeNull();
    expect((await subir(fila(p.id, { actualizado_desde: 'web' }))).error).not.toBeNull();
    expect((await subir(fila(p.id, { id: `${id()}-abcd1234` }))).error).toBeNull();
  });
});

describe('el tope', () => {
  it('a las 200 activas no entra otra; con una borrada, sí', async () => {
    const p = await parroquiaPropia();
    const filas = Array.from({ length: 200 }, (_, i) => fila(p.id, { nombre: `Tope ${i}` }));
    expect((await servicio.from('guardadas').insert(filas)).error).toBeNull();
    const sobra = await subir(fila(p.id, { nombre: 'Una de más' }));
    expect(sobra.error?.message).toContain('tope de guardadas');
    // Re-subir una que ya existe no cuenta como nueva.
    expect((await subir({ ...filas[0], datos: { a: 1 }, actualizado_en: T2 })).error).toBeNull();
    // Borrar una libera lugar; resucitarla con tope lleno vuelve a fallar.
    expect((await subir({ ...filas[1], borrada_en: T2, actualizado_en: T2 })).error).toBeNull();
    expect((await subir(fila(p.id, { nombre: 'Ahora sí' }))).error).toBeNull();
    const resucita = await subir({ ...filas[1], borrada_en: null, actualizado_en: T3 });
    expect(resucita.error?.message).toContain('tope de guardadas');
  }, 60_000);
});

describe('registro', () => {
  it('cada cambio deja una fila cambiar_guardadas en registro sin datos', async () => {
    const p = await parroquiaPropia();
    const f = fila(p.id, { datos: { secreto: 'no debe salir' } });
    expect((await subir(f)).error).toBeNull();
    expect((await subir({ ...f, datos: { secreto: 'otro' }, actualizado_en: T2 })).error).toBeNull();
    const r = await servicio
      .from('registro')
      .select('accion, detalle, usuario_id')
      .eq('parroquia_id', p.id)
      .eq('accion', 'cambiar_guardadas');
    const filas = r.data ?? [];
    expect(filas.map((x) => x.detalle.operacion).sort()).toEqual(['insert', 'update']);
    for (const x of filas) {
      expect(x.detalle).toMatchObject({ tabla: 'guardadas', desde: 'app', tipo: 'dominical' });
      expect(x.detalle).not.toHaveProperty('datos');
      expect(JSON.stringify(x.detalle)).not.toContain('secreto');
      expect(x.usuario_id).toBe(coordinador.id);
    }
  });
});
