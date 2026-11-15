// Transmisiones de la semana (etapa 3b): las tablas transmisiones_fijas, series y transmisiones,
// sus políticas, sus check, la clave del día, el choque web/app y el registro, contra el Supabase
// LOCAL con sesiones reales.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerAdmin,
  hacerMiembro,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';
import {
  aplicarOperacion,
  leerOperacion,
  leerSemana,
  MENSAJE_NO_EXISTE_TRANSMISION,
  type DatosSemana,
  type OperacionSemana,
} from '../../lib/semana-editor';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';
const TABLAS = ['transmisiones_fijas', 'series', 'transmisiones'] as const;

type Parroquia = { id: string; slug: string };

let A: Parroquia;
let B: Parroquia;
let a: UsuarioPrueba;
let b: UsuarioPrueba;
let x: UsuarioPrueba;
let fijaA: string;
let fijaB: string;

async function crearFija(parroquia: string, dia = 4): Promise<string> {
  const { data, error } = await servicio
    .from('transmisiones_fijas')
    .insert({ parroquia_id: parroquia, dia_semana: dia, hora: '18:00', tipo: 'horasanta', datos: {} })
    .select('id')
    .single();
  if (error || !data) throw new Error(`no se pudo crear la fija: ${error?.message}`);
  return data.id as string;
}

function filaDia(fija: string, fecha: string, extra: Record<string, unknown> = {}) {
  return {
    parroquia_id: A.id,
    clave: `fija:${fija}:${fecha}`,
    fecha,
    hora: '18:00',
    tipo: 'horasanta',
    datos: {},
    origen: 'fija',
    fija_id: fija,
    editada: true,
    ...extra,
  };
}

beforeAll(async () => {
  A = await crearParroquia('sem');
  B = await crearParroquia('sem');
  a = await crearUsuario(`sem-a-${sufijo()}@prueba.local`, CLAVE);
  b = await crearUsuario(`sem-b-${sufijo()}@prueba.local`, CLAVE);
  x = await crearUsuario(`sem-x-${sufijo()}@prueba.local`, CLAVE);
  await hacerMiembro(A.id, a.id);
  await hacerMiembro(B.id, b.id);
  await hacerAdmin(x.id);
  fijaA = await crearFija(A.id);
  fijaB = await crearFija(B.id);
  const s = await servicio
    .from('series')
    .insert({ parroquia_id: A.id, nombre: 'Prenovena', tipo: 'prenovena', inicio: '2026-11-15', dias: 9, hora: '19:00' });
  expect(s.error).toBeNull();
  const t = await servicio.from('transmisiones').insert(filaDia(fijaA, '2026-11-26', { actualizado_desde: 'web' }));
  expect(t.error).toBeNull();
}, 60_000);

describe('RLS', () => {
  it('otra parroquia no lee ni escribe', async () => {
    for (const t of TABLAS) {
      const r = await b.cliente.from(t).select('id').eq('parroquia_id', A.id);
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
    }
    const r = await b.cliente
      .from('transmisiones_fijas')
      .insert({ parroquia_id: A.id, dia_semana: 1, hora: '08:00', tipo: 'dominical' });
    expect(r.error?.message).toMatch(/row-level security/);
  });

  it('el admin lee las dos', async () => {
    const r = await x.cliente.from('transmisiones_fijas').select('id').in('parroquia_id', [A.id, B.id]);
    expect((r.data ?? []).map((f) => f.id).sort()).toEqual([fijaA, fijaB].sort());
  });

  it('un anónimo no lee ninguna', async () => {
    for (const t of TABLAS) {
      const r = await clienteAnonimo().from(t).select('id');
      expect(r.data ?? []).toEqual([]);
    }
  });
});

describe('otra parroquia y la clave (Review Focus 5)', () => {
  it('no apunta a la fija de otra parroquia', async () => {
    const r = await a.cliente.from('transmisiones').insert(filaDia(fijaB, '2026-11-19', { actualizado_desde: 'web' }));
    expect(r.error).not.toBeNull();
    expect(r.error?.code).toBe('23503');
  });

  it('una clave que no cuadra se rechaza', async () => {
    const r = await a.cliente
      .from('transmisiones')
      .insert(filaDia(fijaA, '2026-11-19', { clave: `fija:${fijaA}:2026-11-20`, actualizado_desde: 'web' }));
    expect(r.error?.message).toContain('clave de día inválida');
  });
});

describe('el choque web/app', () => {
  it('gana lo último que se guardó', async () => {
    const fecha = '2026-11-19';
    const web = await a.cliente
      .from('transmisiones')
      .insert(filaDia(fijaA, fecha, { datos: { celebrante: 'Web' }, actualizado_desde: 'web' }))
      .select('actualizado_en')
      .single();
    expect(web.error).toBeNull();
    const enWeb = new Date(web.data!.actualizado_en as string).getTime();

    const vieja = await a.cliente
      .from('transmisiones')
      .upsert(
        filaDia(fijaA, fecha, {
          datos: { celebrante: 'App vieja' },
          actualizado_desde: 'app',
          actualizado_en: new Date(enWeb - 3_600_000).toISOString(),
        }),
        { onConflict: 'parroquia_id,clave' },
      )
      .select('datos')
      .single();
    expect(vieja.error).toBeNull();
    expect(vieja.data!.datos).toEqual({ celebrante: 'Web' });

    const nueva = await a.cliente
      .from('transmisiones')
      .upsert(
        filaDia(fijaA, fecha, {
          datos: { celebrante: 'App nueva' },
          actualizado_desde: 'app',
          actualizado_en: new Date(enWeb + 500).toISOString(),
        }),
        { onConflict: 'parroquia_id,clave' },
      )
      .select('datos, actualizado_desde')
      .single();
    expect(nueva.error).toBeNull();
    expect(nueva.data).toEqual({ datos: { celebrante: 'App nueva' }, actualizado_desde: 'app' });
  });

  it('el reloj adelantado del celular se recorta a now() (Review Focus 1)', async () => {
    const fecha = '2026-12-03';
    const r = await a.cliente
      .from('transmisiones')
      .upsert(
        filaDia(fijaA, fecha, {
          datos: { celebrante: 'Futuro' },
          actualizado_desde: 'app',
          actualizado_en: new Date(Date.now() + 86_400_000).toISOString(),
        }),
        { onConflict: 'parroquia_id,clave' },
      )
      .select('actualizado_en')
      .single();
    expect(r.error).toBeNull();
    expect(new Date(r.data!.actualizado_en as string).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);

    const web = await a.cliente
      .from('transmisiones')
      .update({ datos: { celebrante: 'Web después' }, actualizado_desde: 'web' })
      .eq('parroquia_id', A.id)
      .eq('clave', `fija:${fijaA}:${fecha}`)
      .select('datos')
      .single();
    expect(web.data!.datos).toEqual({ celebrante: 'Web después' });
  });

  it('desde la app no se crea una única', async () => {
    const id = crypto.randomUUID();
    const r = await a.cliente.from('transmisiones').insert({
      id,
      parroquia_id: A.id,
      clave: `unica:${id}`,
      fecha: '2026-11-18',
      hora: '10:00',
      tipo: 'dominical',
      datos: {},
      origen: 'unica',
      actualizado_desde: 'app',
    });
    expect(r.error).not.toBeNull();
  });
});

describe('registro', () => {
  it('anota el cambio de la web sin datos, y no el upsert perdedor de la app', async () => {
    const fecha = '2026-12-10';
    const clave = `fija:${fijaA}:${fecha}`;
    expect(
      (await a.cliente.from('transmisiones').insert(filaDia(fijaA, fecha, { actualizado_desde: 'web' }))).error,
    ).toBeNull();
    const antes = new Date().toISOString();
    const u = await a.cliente
      .from('transmisiones')
      .update({ datos: { celebrante: 'P. Ana' }, actualizado_desde: 'web' })
      .eq('parroquia_id', A.id)
      .eq('clave', clave);
    expect(u.error).toBeNull();

    const filas = async () =>
      (
        await servicio
          .from('registro')
          .select('accion, detalle, usuario_id')
          .eq('parroquia_id', A.id)
          .eq('accion', 'cambiar_semana')
          .gte('en', new Date(Date.parse(antes) - 60_000).toISOString())
      ).data ?? [];
    const despuesWeb = await filas();
    const update = despuesWeb.filter((f) => f.detalle.operacion === 'update' && f.detalle.fecha === fecha);
    expect(update.length).toBe(1);
    expect(update[0].detalle.tabla).toBe('transmisiones');
    expect(update[0].detalle.desde).toBe('web');
    expect(update[0].detalle).not.toHaveProperty('datos');
    expect(update[0].usuario_id).toBe(a.id);

    const perdedor = await a.cliente.from('transmisiones').upsert(
      filaDia(fijaA, fecha, {
        datos: { celebrante: 'Vieja' },
        actualizado_desde: 'app',
        actualizado_en: new Date(Date.now() - 86_400_000).toISOString(),
      }),
      { onConflict: 'parroquia_id,clave' },
    );
    expect(perdedor.error).toBeNull();
    expect((await filas()).length).toBe(despuesWeb.length);
  });
});

describe('cascada', () => {
  it('borrar la fija borra sus días', async () => {
    const f = await crearFija(A.id, 2);
    expect((await servicio.from('transmisiones').insert(filaDia(f, '2026-11-17', { actualizado_desde: 'web' }))).error).toBeNull();
    expect((await a.cliente.from('transmisiones_fijas').delete().eq('id', f)).error).toBeNull();
    const r = await servicio.from('transmisiones').select('id').eq('fija_id', f);
    expect(r.data).toEqual([]);
  });
});

describe('checks', () => {
  it('rechaza hora, días y datos malos', async () => {
    const fija = (extra: Record<string, unknown>) =>
      a.cliente
        .from('transmisiones_fijas')
        .insert({ parroquia_id: A.id, dia_semana: 1, hora: '08:00', tipo: 'dominical', ...extra });
    expect((await fija({ hora: '24:00' })).error).not.toBeNull();
    expect((await fija({ datos: [] })).error).not.toBeNull();
    let grande = '';
    while (grande.length < 9000) grande += Math.random().toString(36).slice(2);
    expect((await fija({ datos: { celebrante: grande } })).error).not.toBeNull();
    const serie = await a.cliente
      .from('series')
      .insert({ parroquia_id: A.id, nombre: 'X', tipo: 'novena', inicio: '2026-11-15', dias: 0, hora: '19:00' });
    expect(serie.error).not.toBeNull();
  });
});

describe('la API del editor (leerSemana / aplicarOperacion)', () => {
  const LUNES = '2026-11-16';
  const JUEVES = '2026-11-19';

  async function fijaConMarca(marca: string) {
    const r = await leerSemana(a.cliente, A.slug, LUNES);
    expect(r.estado).toBe(200);
    const d = r.cuerpo as DatosSemana;
    return { d, fija: d.fijas.find((f) => (f.datos as Record<string, unknown>).celebrante === marca)! };
  }
  const filaDe = async (clave: string) =>
    (await servicio.from('transmisiones').select('*').eq('parroquia_id', A.id).eq('clave', clave).maybeSingle()).data;

  it('crea, edita, salta y restaura días de una fija', async () => {
    const marca = `Ana-${sufijo()}`;
    const op = (o: unknown) => aplicarOperacion(a.cliente, A.slug, leerOperacion(o) as OperacionSemana);
    expect((await op({ op: 'crear-fija', dia_semana: 4, hora: '18:00', tipo: 'horasanta', datos: { celebrante: marca } })).estado).toBe(200);
    const { fija } = await fijaConMarca(marca);
    expect(fija).toMatchObject({ dia_semana: 4, hora: '18:00', tipo: 'horasanta', activa: true });

    const clave = `fija:${fija.id}:${JUEVES}`;
    const editado = { celebrante: marca, lectura1: 'Juan 1' };
    expect((await op({ op: 'editar-dia', clave, hora: '18:00', tipo: 'horasanta', datos: editado })).estado).toBe(200);
    expect(await filaDe(clave)).toMatchObject({ editada: true, saltada: false, actualizado_desde: 'web', datos: editado });

    expect((await op({ op: 'cambiar-fija', id: fija.id, dia_semana: 4, hora: '17:00', tipo: 'horasanta', datos: { celebrante: marca }, activa: true })).estado).toBe(200);
    expect(await filaDe(clave)).toMatchObject({ hora: '18:00', datos: editado });

    expect((await op({ op: 'saltar-dia', clave, hora: '17:00', tipo: 'horasanta', datos: {} })).estado).toBe(200);
    expect(await filaDe(clave)).toMatchObject({ saltada: true, editada: true, datos: editado });
    expect((await op({ op: 'restaurar-dia', clave })).estado).toBe(200);
    expect(await filaDe(clave)).toMatchObject({ saltada: false, editada: true, datos: editado });

    const otra = `fija:${fija.id}:2026-11-26`;
    expect((await op({ op: 'saltar-dia', clave: otra, hora: '17:00', tipo: 'horasanta', datos: { celebrante: marca } })).estado).toBe(200);
    expect(await filaDe(otra)).toMatchObject({ saltada: true, editada: false });
    expect((await op({ op: 'restaurar-dia', clave: otra })).estado).toBe(200);
    expect(await filaDe(otra)).toBeNull();

    const sem = await leerSemana(a.cliente, A.slug, LUNES);
    expect((sem.cuerpo as DatosSemana).transmisiones.some((t) => t.clave === clave)).toBe(true);
  });

  it('crea y borra una suelta', async () => {
    const op = (o: unknown) => aplicarOperacion(a.cliente, A.slug, leerOperacion(o) as OperacionSemana);
    const marca = `Suelta-${sufijo()}`;
    expect((await op({ op: 'crear-unica', fecha: '2026-11-20', hora: '10:00', tipo: 'evento', datos: { evento: marca } })).estado).toBe(200);
    const d = (await leerSemana(a.cliente, A.slug, LUNES)).cuerpo as DatosSemana;
    const u = d.transmisiones.find((t) => (t.datos as Record<string, unknown>).evento === marca)!;
    expect(u).toMatchObject({ origen: 'unica', clave: `unica:${u.id}`, actualizado_desde: 'web' });
    expect((await op({ op: 'borrar-unica', id: u.id })).estado).toBe(200);
    expect(await filaDe(u.clave)).toBeNull();
  });

  it('otra parroquia recibe 403 y nada cambia; un id que no existe da 404', async () => {
    const antes = (await servicio.from('transmisiones_fijas').select('id').eq('parroquia_id', A.id)).data!.length;
    const r = await aplicarOperacion(b.cliente, A.slug, leerOperacion({ op: 'crear-fija', dia_semana: 1, hora: '08:00', tipo: 'dominical', datos: {} }) as OperacionSemana);
    expect(r.estado).toBe(403);
    expect((await leerSemana(b.cliente, A.slug, LUNES)).estado).toBe(403);
    expect((await servicio.from('transmisiones_fijas').select('id').eq('parroquia_id', A.id)).data!.length).toBe(antes);

    const no = await aplicarOperacion(a.cliente, A.slug, { op: 'borrar-fija', id: '00000000-0000-4000-8000-000000000000' });
    expect(no).toEqual({ estado: 404, cuerpo: { error: MENSAJE_NO_EXISTE_TRANSMISION } });
    expect((await leerSemana(a.cliente, A.slug, '2026-11-17')).estado).toBe(400);
  });
});
