/**
 * Almacén de la sesión en el celular, en expo-secure-store.
 *
 * La sesión va en tres llaves: el token de acceso, el de renovación y `{expiraEn, usuarioId, correo}`.
 * Ninguna lleva los dos tokens juntos. Cada valor se valida al leer: lo que no tiene la forma
 * esperada se toma como «no hay nada». Si el keystore falla al leer, la lectura rechaza:
 * nunca se finge «sin sesión».
 *
 * Nada de acá escribe en `console.*`.
 */
import * as SecureStore from 'expo-secure-store';

import { esSlugValido } from '../plataforma/direcciones';
import type { SesionSupabase } from '../supabase/cliente';
import type { Cuenta, ParroquiaApp } from './tipos';

export const LLAVES = {
  acceso: 'pev_app_acceso_v1',
  renovar: 'pev_app_renovar_v1',
  sesion: 'pev_app_sesion_v1',
  parroquia: 'pev_app_parroquia_v1',
  parroquias: 'pev_app_parroquias_v1',
  cuenta: 'pev_app_cuenta_v1',
} as const;

export interface AlmacenSesion {
  leerSesion(): Promise<SesionSupabase | null>;
  guardarSesion(s: SesionSupabase): Promise<void>;
  borrarSesion(): Promise<void>;
  leerParroquia(): Promise<ParroquiaApp | null>;
  guardarParroquia(p: ParroquiaApp): Promise<void>;
  borrarParroquia(): Promise<void>;
  leerParroquias(): Promise<ParroquiaApp[]>;
  guardarParroquias(l: readonly ParroquiaApp[]): Promise<void>;
  leerCuenta(): Promise<Cuenta | null>;
  guardarCuenta(c: Cuenta): Promise<void>;
  borrarTodo(): Promise<void>;
}

export interface StoreSeguro {
  getItemAsync(llave: string): Promise<string | null>;
  setItemAsync(llave: string, valor: string): Promise<void>;
  deleteItemAsync(llave: string): Promise<void>;
}

function leerJson(texto: string | null): unknown {
  if (texto === null) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function textoNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v !== '';
}

export function comoParroquia(v: unknown): ParroquiaApp | null {
  if (!esObjeto(v)) return null;
  const { id, slug, nombre } = v;
  if (!textoNoVacio(id) || typeof slug !== 'string' || !esSlugValido(slug) || !textoNoVacio(nombre)) return null;
  return { id, slug, nombre };
}

function comoCuenta(v: unknown): Cuenta | null {
  if (!esObjeto(v)) return null;
  const { usuarioId, correo, nombre, esAdmin } = v;
  if (!textoNoVacio(usuarioId) || typeof correo !== 'string' || typeof esAdmin !== 'boolean') return null;
  if (nombre !== null && typeof nombre !== 'string') return null;
  return { usuarioId, correo, nombre, esAdmin };
}

export function crearAlmacen(store: StoreSeguro): AlmacenSesion {
  return {
    async leerSesion() {
      const [acceso, renovar, datos] = await Promise.all([
        store.getItemAsync(LLAVES.acceso),
        store.getItemAsync(LLAVES.renovar),
        store.getItemAsync(LLAVES.sesion),
      ]);
      if (!textoNoVacio(acceso) || !textoNoVacio(renovar)) return null;
      const d = leerJson(datos);
      if (!esObjeto(d)) return null;
      const { expiraEn, usuarioId, correo } = d;
      if (typeof expiraEn !== 'number' || !Number.isFinite(expiraEn)) return null;
      if (!textoNoVacio(usuarioId) || typeof correo !== 'string') return null;
      return { accessToken: acceso, refreshToken: renovar, expiraEn, usuarioId, correo };
    },

    async guardarSesion(s) {
      await store.setItemAsync(LLAVES.acceso, s.accessToken);
      await store.setItemAsync(LLAVES.renovar, s.refreshToken);
      await store.setItemAsync(
        LLAVES.sesion,
        JSON.stringify({ expiraEn: s.expiraEn, usuarioId: s.usuarioId, correo: s.correo }),
      );
    },

    async borrarSesion() {
      await store.deleteItemAsync(LLAVES.acceso);
      await store.deleteItemAsync(LLAVES.renovar);
      await store.deleteItemAsync(LLAVES.sesion);
    },

    async leerParroquia() {
      return comoParroquia(leerJson(await store.getItemAsync(LLAVES.parroquia)));
    },

    async guardarParroquia(p) {
      await store.setItemAsync(LLAVES.parroquia, JSON.stringify({ id: p.id, slug: p.slug, nombre: p.nombre }));
    },

    async borrarParroquia() {
      await store.deleteItemAsync(LLAVES.parroquia);
    },

    async leerParroquias() {
      const l = leerJson(await store.getItemAsync(LLAVES.parroquias));
      if (!Array.isArray(l)) return [];
      return l.map(comoParroquia).filter((p): p is ParroquiaApp => p !== null);
    },

    async guardarParroquias(l) {
      await store.setItemAsync(
        LLAVES.parroquias,
        JSON.stringify(l.map((p) => ({ id: p.id, slug: p.slug, nombre: p.nombre }))),
      );
    },

    async leerCuenta() {
      return comoCuenta(leerJson(await store.getItemAsync(LLAVES.cuenta)));
    },

    async guardarCuenta(c) {
      await store.setItemAsync(
        LLAVES.cuenta,
        JSON.stringify({ usuarioId: c.usuarioId, correo: c.correo, nombre: c.nombre, esAdmin: c.esAdmin }),
      );
    },

    async borrarTodo() {
      for (const llave of Object.values(LLAVES)) await store.deleteItemAsync(llave);
    },
  };
}

/** El de la app, sobre expo-secure-store. */
export const almacenSesion: AlmacenSesion = crearAlmacen({
  getItemAsync: (k) => SecureStore.getItemAsync(k),
  setItemAsync: (k, v) => SecureStore.setItemAsync(k, v),
  deleteItemAsync: (k) => SecureStore.deleteItemAsync(k),
});
