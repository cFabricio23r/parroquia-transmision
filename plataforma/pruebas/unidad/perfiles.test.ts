import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardarNombre, MAX_NOMBRE, validarNombre } from '../../lib/perfiles';

describe('validarNombre', () => {
  it('recorta y colapsa los espacios', () => {
    expect(validarNombre('  Fabricio   Ramírez ')).toEqual({ nombre: 'Fabricio Ramírez' });
  });
  it('solo espacios: «Escribe tu nombre.»', () => {
    expect(validarNombre('   ')).toEqual({ error: 'Escribe tu nombre.' });
    expect(validarNombre('')).toEqual({ error: 'Escribe tu nombre.' });
  });
  it('81 caracteres: error de largo; 80 se aceptan', () => {
    expect(MAX_NOMBRE).toBe(80);
    expect(validarNombre('a'.repeat(81))).toEqual({ error: 'El nombre puede tener hasta 80 caracteres.' });
    expect(validarNombre('a'.repeat(80))).toEqual({ nombre: 'a'.repeat(80) });
  });
  it('tildes y emoji se guardan tal cual', () => {
    expect(validarNombre('José 🙏')).toEqual({ nombre: 'José 🙏' });
    expect(validarNombre('María José 🙏')).toEqual({ nombre: 'María José 🙏' });
  });
  it('el largo se cuenta como Postgres (puntos de código), no en unidades UTF-16', () => {
    // 80 emoji son 160 unidades UTF-16 pero 80 caracteres para char_length.
    expect(validarNombre('🙏'.repeat(80))).toEqual({ nombre: '🙏'.repeat(80) });
    expect('error' in validarNombre('🙏'.repeat(81))).toBe(true);
  });
});

describe('guardarNombre', () => {
  function falso(error: unknown = null, usuario: { id: string } | null = { id: 'u1' }) {
    const upsert = vi.fn().mockResolvedValue({ error });
    const from = vi.fn().mockReturnValue({ upsert });
    const cliente = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario } }) }, from } as unknown as SupabaseClient;
    return { cliente, upsert, from };
  }
  it('valida antes de tocar la base', async () => {
    const f = falso();
    expect(await guardarNombre(f.cliente, '  ')).toEqual({ error: 'Escribe tu nombre.' });
    expect(f.from).not.toHaveBeenCalled();
  });
  it('hace upsert de la fila propia con la fecha', async () => {
    const f = falso();
    expect(await guardarNombre(f.cliente, ' Ana  María ')).toEqual({});
    expect(f.from).toHaveBeenCalledWith('perfiles');
    const [fila, opciones] = f.upsert.mock.calls[0];
    expect(fila.usuario_id).toBe('u1');
    expect(fila.nombre).toBe('Ana María');
    expect(typeof fila.actualizado_en).toBe('string');
    expect(opciones).toEqual({ onConflict: 'usuario_id' });
  });
  it('un fallo de la base da el mensaje genérico; sin sesión, el de sesión vencida', async () => {
    expect(await guardarNombre(falso({ message: 'x' }).cliente, 'Ana')).toEqual({ error: 'No se pudo guardar. Intenta de nuevo' });
    expect(await guardarNombre(falso(null, null).cliente, 'Ana')).toEqual({ error: 'Tu sesión venció. Entra de nuevo' });
  });
});
