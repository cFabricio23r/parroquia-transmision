// Tablas de Facebook: solo la clave de servicio las toca. Con sesión de coordinador o de admin no se
// ve nada (RLS activado y sin políticas). Todo es aleatorio por corrida: slug y page_id nunca son fijos.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { clienteServicio, crearParroquia, crearUsuario, hacerAdmin, hacerMiembro, sufijo, type UsuarioPrueba } from './ayudas';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';
const TABLAS = ['facebook_conexion', 'facebook_paginas', 'facebook_parroquia', 'facebook_parroquia_extra', 'facebook_vivos'] as const;

type Parroquia = { id: string; slug: string };

let A: Parroquia;
let B: Parroquia;
let coordinador: UsuarioPrueba;
let admin: UsuarioPrueba;
const pageA = `pg-${randomUUID()}`;
const pageB = `pg-${randomUUID()}`;

beforeAll(async () => {
  A = await crearParroquia('fb');
  B = await crearParroquia('fb');
  coordinador = await crearUsuario(`fb-coord-${sufijo()}@prueba.local`, CLAVE);
  admin = await crearUsuario(`fb-admin-${sufijo()}@prueba.local`, CLAVE);
  await hacerMiembro(A.id, coordinador.id);
  await hacerAdmin(admin.id);

  const inserts = [
    servicio.from('facebook_conexion').insert({ parroquia_id: A.id, nombre_facebook: 'Falso', token_usuario: 'TOKEN-FALSO', estado: 'conectado' }),
    servicio.from('facebook_paginas').insert({ parroquia_id: A.id, page_id: pageA, nombre: 'Pagina falsa', token: 'TOKEN-FALSO' }),
    servicio.from('facebook_parroquia').insert({ parroquia_id: A.id, pagina_principal: pageA }),
    servicio.from('facebook_parroquia_extra').insert({ parroquia_id: A.id, page_id: pageB, crosspost: 'falta' }),
    servicio.from('facebook_vivos').insert({ parroquia_id: A.id, vivo_id: `vivo-${randomUUID()}`, page_id: pageA }),
  ];
  for (const r of await Promise.all(inserts)) expect(r.error).toBeNull();
}, 60_000);

describe('facebook: solo clave de servicio', () => {
  for (const tabla of TABLAS) {
    it(`${tabla}: el servicio ve la fila`, async () => {
      const { data, error } = await servicio.from(tabla).select('*').eq('parroquia_id', A.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it(`${tabla}: ni el coordinador ni el admin ven nada`, async () => {
      for (const u of [coordinador, admin]) {
        const { data, error } = await u.cliente.from(tabla).select('*').eq('parroquia_id', A.id);
        if (!error) expect(data).toEqual([]);
        else expect(error.message).toMatch(/permission|denied|permiso/i);
      }
    });
  }
});

describe('facebook: restricciones', () => {
  it('el mismo page_id puede estar en dos parroquias', async () => {
    const dos = await servicio.from('facebook_paginas').insert({ parroquia_id: B.id, page_id: pageA, nombre: 'Misma pagina', token: 'TOKEN-FALSO' });
    expect(dos.error).toBeNull();
  });

  it('la pagina_principal no se puede repetir entre parroquias', async () => {
    const repetida = await servicio.from('facebook_parroquia').insert({ parroquia_id: B.id, pagina_principal: pageA });
    expect(repetida.error?.code).toBe('23505');
  });
});
