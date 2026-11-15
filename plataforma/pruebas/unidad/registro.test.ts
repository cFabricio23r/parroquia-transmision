import { describe, expect, it } from 'vitest';
import { ACCIONES_VISIBLES, chipRegistro, fraseRegistro, quienRegistro } from '../../lib/registro';

const persona = (nombres: Record<string, string>) => (id: string) => nombres[id] ?? null;
const sinNadie = () => null;

describe('fraseRegistro (Decisión 16)', () => {
  const P = 'Inmaculada Concepción de María';
  it('una frase por acción', () => {
    expect(fraseRegistro({ accion: 'publicar', detalle: { numero: 4 }, parroquia: P }, sinNadie)).toBe('Publicó Inmaculada Concepción de María · v4');
    expect(fraseRegistro({ accion: 'restaurar', detalle: { numero: 2, nuevo: 5 }, parroquia: P }, sinNadie)).toBe(
      'Volvió a la versión 2 de Inmaculada Concepción de María · v5',
    );
    expect(fraseRegistro({ accion: 'invitar', detalle: { correo: 'maria.lopez@correo.com' }, parroquia: 'San José' }, sinNadie)).toBe(
      'Invitó a maria.lopez@correo.com a San José',
    );
    expect(fraseRegistro({ accion: 'aceptar_invitacion', detalle: { correo: 'x@y', rol: 'coordinador' }, parroquia: 'San José' }, sinNadie)).toBe(
      'Aceptó la invitación a San José',
    );
    expect(fraseRegistro({ accion: 'aceptar_invitacion', detalle: { correo: 'x@y', rol: 'administrador' }, parroquia: null }, sinNadie)).toBe(
      'Aceptó la invitación de administrador',
    );
    expect(fraseRegistro({ accion: 'asignar', detalle: { usuario_id: 'u1' }, parroquia: 'San José' }, persona({ u1: 'Fabricio Ramírez' }))).toBe(
      'Asignó a Fabricio Ramírez a San José',
    );
    expect(fraseRegistro({ accion: 'quitar_acceso', detalle: { usuario_id: 'u1' }, parroquia: 'San José' }, persona({ u1: 'Fabricio Ramírez' }))).toBe(
      'Quitó el acceso de Fabricio Ramírez a San José',
    );
    expect(fraseRegistro({ accion: 'quitar_acceso', detalle: { usuario_id: 'u9' }, parroquia: 'San José' }, sinNadie)).toBe(
      'Quitó el acceso de una cuenta borrada a San José',
    );
    expect(fraseRegistro({ accion: 'anular_invitacion', detalle: { correo: 'p@x' }, parroquia: 'San José' }, sinNadie)).toBe(
      'Anuló la invitación de p@x a San José',
    );
    expect(fraseRegistro({ accion: 'crear_parroquia', detalle: { slug: 's', nombre: 'Santa Ana' }, parroquia: null }, sinNadie)).toBe('Creó Santa Ana');
    expect(fraseRegistro({ accion: 'desactivar', detalle: { slug: 's', nombre: 'Viejo' }, parroquia: 'Santa Lucía' }, sinNadie)).toBe('Desactivó Santa Lucía');
    expect(fraseRegistro({ accion: 'reactivar', detalle: {}, parroquia: 'Santa Lucía' }, sinNadie)).toBe('Reactivó Santa Lucía');
    expect(fraseRegistro({ accion: 'cambiar_visible', detalle: { nombre: 'X', visible: true }, parroquia: 'Santa Lucía' }, sinNadie)).toBe(
      'Mostró Santa Lucía en la app',
    );
    expect(fraseRegistro({ accion: 'cambiar_visible', detalle: { nombre: 'X', visible: false }, parroquia: 'Santa Lucía' }, sinNadie)).toBe(
      'Quitó Santa Lucía de la app',
    );
    expect(fraseRegistro({ accion: 'cambiar_visible', detalle: { nombre: 'X', visible: true }, parroquia: null }, sinNadie)).toBe('Mostró X en la app');
  });
  it('una parroquia borrada sin nombre en el detalle', () => {
    expect(fraseRegistro({ accion: 'desactivar', detalle: {}, parroquia: null }, sinNadie)).toBe('Desactivó una parroquia eliminada');
  });
  it('una acción desconocida se devuelve tal cual', () => {
    expect(fraseRegistro({ accion: 'otra_cosa', detalle: {}, parroquia: 'X' }, sinNadie)).toBe('otra_cosa');
  });
});

describe('chipRegistro', () => {
  it('tipos y tonos', () => {
    expect(chipRegistro('publicar')).toEqual({ texto: 'Publicación', tono: 'verde' });
    expect(chipRegistro('restaurar')).toEqual({ texto: 'Publicación', tono: 'verde' });
    expect(chipRegistro('invitar')).toEqual({ texto: 'Acceso', tono: 'azul' });
    expect(chipRegistro('quitar_acceso')!.tono).toBe('ambar');
    expect(chipRegistro('anular_invitacion')!.tono).toBe('ambar');
    expect(chipRegistro('crear_parroquia')).toEqual({ texto: 'Parroquia', tono: 'gris' });
    expect(chipRegistro('cambiar_visible')).toEqual({ texto: 'Parroquia', tono: 'gris' });
    expect(chipRegistro('guardar_borrador')).toBeNull();
  });
  it('ACCIONES_VISIBLES son las 13 y todas tienen chip', () => {
    expect(ACCIONES_VISIBLES).toHaveLength(13);
    expect(ACCIONES_VISIBLES).toContain('cambiar_visible');
    for (const a of ACCIONES_VISIBLES) expect(chipRegistro(a)).not.toBeNull();
    expect(ACCIONES_VISIBLES).not.toContain('guardar_borrador');
  });
});

describe('App y transmisión (3c)', () => {
  const SJ = 'San José';
  it('frases de la clave y de los ajustes', () => {
    const f = (accion: string, detalle: Record<string, unknown>) => fraseRegistro({ accion, detalle, parroquia: SJ }, sinNadie);
    expect(f('cambiar_clave_transmision', { nombre: 'X', cambio: 'guardar' })).toBe('Guardó la clave de transmisión de San José');
    expect(f('cambiar_clave_transmision', { nombre: 'X', cambio: 'reemplazar' })).toBe('Cambió la clave de transmisión de San José');
    expect(f('cambiar_clave_transmision', { nombre: 'X', cambio: 'quitar' })).toBe('Quitó la clave de transmisión de San José');
    expect(f('cambiar_ajustes_app', { campos: ['servidor', 'estiloFinal'] })).toBe('Cambió los ajustes de la app de San José: servidor y pantalla final');
    expect(f('cambiar_ajustes_app', { campos: ['servidor', 'calidadDefecto', 'estiloFinal'] })).toBe(
      'Cambió los ajustes de la app de San José: servidor, calidad por defecto y pantalla final',
    );
  });
  it('chips grises de Parroquia', () => {
    expect(chipRegistro('cambiar_clave_transmision')).toEqual({ texto: 'Parroquia', tono: 'gris' });
    expect(chipRegistro('cambiar_ajustes_app')).toEqual({ texto: 'Parroquia', tono: 'gris' });
  });
});

describe('quienRegistro (Decisión 17)', () => {
  it('nombre visible, (admin) y raya', () => {
    expect(quienRegistro({ nombre: 'María López', correo: 'm@x', esAdmin: true })).toBe('María López (admin)');
    expect(quienRegistro({ nombre: null, correo: 'm@x', esAdmin: false })).toBe('m@x');
    expect(quienRegistro(null)).toBe('—');
  });
});
