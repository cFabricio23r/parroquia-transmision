// Fusión del borrador por bloque (spec, sección 4). Postgres jsonb reordena las claves: por eso la
// igualdad no mira el orden de las claves (Review Focus 1). Puro: lo usa la máquina de guardado.
import { BLOQUES, type Bloque } from './secciones';

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Igualdad profunda sin orden de claves; los arreglos sí en orden; `undefined` cuenta como ausente. */
export function iguales(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => iguales(x, b[i]));
  }
  if (esObjeto(a) && esObjeto(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && iguales(a[k], b[k]));
  }
  return false;
}

const leer = (o: object, b: Bloque) => (o as Record<string, unknown>)[b];

export function bloquesCambiados(antes: object, despues: object): Bloque[] {
  return BLOQUES.filter((b) => !iguales(leer(antes, b), leer(despues, b)));
}

/** Por cada bloque cambiado, el valor local, o `null` si local ya no lo tiene. */
export function cambiosParaEnviar(base: object, local: object): Partial<Record<Bloque, unknown>> {
  const cambios: Partial<Record<Bloque, unknown>> = {};
  for (const b of bloquesCambiados(base, local)) {
    const v = leer(local, b);
    cambios[b] = v === undefined ? null : v;
  }
  return cambios;
}

export interface ResultadoFusion {
  fusionado: Record<string, unknown>;
  conflictos: Bloque[];
  propios: Bloque[];
}

/**
 * Por bloque: si no lo cambié, el remoto; si lo cambié y el remoto sigue como `base`, el mío; si lo
 * cambiamos los dos distinto, conflicto (queda el mío); si lo cambiamos igual, el remoto.
 */
export function fusionarPorBloque(base: object, local: object, remoto: object): ResultadoFusion {
  const fusionado: Record<string, unknown> = { ...(remoto as Record<string, unknown>) };
  const conflictos: Bloque[] = [];
  const propios: Bloque[] = [];
  for (const b of BLOQUES) {
    const vBase = leer(base, b);
    const vLocal = leer(local, b);
    const vRemoto = leer(remoto, b);
    if (iguales(vLocal, vBase)) continue; // no lo cambié: queda el remoto
    if (iguales(vLocal, vRemoto)) continue; // lo cambiamos igual
    if (iguales(vRemoto, vBase)) propios.push(b);
    else conflictos.push(b);
    if (vLocal === undefined) delete fusionado[b];
    else fusionado[b] = vLocal;
  }
  return { fusionado, conflictos, propios };
}
