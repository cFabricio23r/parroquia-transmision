// Quién está en la sesión: id, correo, nombre (de `perfiles`) y si es administrador.
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirAdmin } from './admin';
import { leerNombre } from './perfiles';

export interface UsuarioActual {
  id: string;
  correo: string;
  nombre: string | null;
  esAdmin: boolean;
}

export async function usuarioActual(sesion: SupabaseClient): Promise<UsuarioActual | null> {
  const { data } = await sesion.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const [nombre, admin] = await Promise.all([leerNombre(sesion, u.id), exigirAdmin(sesion)]);
  return { id: u.id, correo: u.email ?? '', nombre, esAdmin: admin === u.id };
}
