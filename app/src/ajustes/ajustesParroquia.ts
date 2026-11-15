// Los ajustes efectivos de la parroquia elegida: lo bajado más lo cambiado en este celular.
import { Ajustes, Microfono } from './ajustes';
import { AlmacenAjustes, almacenAjustes } from './almacen';
import {
  AjustesEfectivos,
  aplicarCambioCelular,
  CampoCelular,
  resolverAjustes,
  seguirConLaDelCelular,
  volverALaParroquia,
} from './origen';
import type { ParroquiaApp } from '../sesion/tipos';

export interface AjustesParroquiaApp {
  leerEfectivos(slug: string): Promise<AjustesEfectivos>;
  cambiarEnCelular(slug: string, campo: CampoCelular, valor: string): Promise<AjustesEfectivos>;
  volver(slug: string, campo: CampoCelular): Promise<AjustesEfectivos>;
  seguirConLaDelCelular(slug: string): Promise<AjustesEfectivos>;
  cambiarMicrofono(slug: string, m: Microfono): Promise<AjustesEfectivos>;
}

export function crearAjustesParroquia(a: AlmacenAjustes): AjustesParroquiaApp {
  const leerEfectivos = async (slug: string): Promise<AjustesEfectivos> => {
    const g = await a.leer(slug);
    return resolverAjustes(g.parroquia, g.clave, g.celular, g.microfono);
  };
  return {
    leerEfectivos,
    async cambiarEnCelular(slug, campo, valor) {
      const g = await a.leer(slug);
      const c = aplicarCambioCelular(g.celular, g.parroquia, g.clave, campo, valor);
      await a.guardarCelular(slug, c);
      return resolverAjustes(g.parroquia, g.clave, c, g.microfono);
    },
    async volver(slug, campo) {
      const g = await a.leer(slug);
      const c = volverALaParroquia(g.celular, campo);
      await a.guardarCelular(slug, c);
      return resolverAjustes(g.parroquia, g.clave, c, g.microfono);
    },
    async seguirConLaDelCelular(slug) {
      const g = await a.leer(slug);
      const c = seguirConLaDelCelular(g.celular, g.clave);
      await a.guardarCelular(slug, c);
      return resolverAjustes(g.parroquia, g.clave, c, g.microfono);
    },
    async cambiarMicrofono(slug, m) {
      await a.guardarMicrofono(m);
      return leerEfectivos(slug);
    },
  };
}

export const ajustesParroquia: AjustesParroquiaApp = crearAjustesParroquia(almacenAjustes);

/** Lo que usa el orquestador: rechaza si no hay parroquia elegida. */
export async function leerAjustesDe(p: ParroquiaApp | null): Promise<Ajustes> {
  if (!p) throw new Error('Sin parroquia elegida.');
  return (await ajustesParroquia.leerEfectivos(p.slug)).ajustes;
}
