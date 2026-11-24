/**
 * Cuándo corre el momento 'abrir': una vez por cada entrada a `lista` con una parroquia.
 *
 * Antes corría una vez por proceso, pero cerrar sesión borra lo bajado (ajustes, clave, copias y
 * semana) y, al entrar con otra cuenta o elegir otra parroquia sin matar la app, nada lo volvía a
 * bajar. Se recuerda para qué parroquia corrió; al salir de `lista` se olvida.
 *
 * Las corridas van en fila: el sincronizador devuelve la misma promesa a dos 'abrir' seguidos, así
 * que si la de A sigue en vuelo cuando se entra en B, la de B se la habría tragado (y las tareas de A
 * se saltan porque A ya no es la elegida). `correr` espera a que termine la anterior.
 */
export interface ControlAbrir {
  debeCorrer(parroquiaId: string | null): boolean;
  /** Marca la parroquia y corre `fn` cuando termina la corrida anterior. */
  correr(parroquiaId: string, fn: () => Promise<unknown>): Promise<unknown>;
  olvidar(): void;
}

export function crearControlAbrir(): ControlAbrir {
  let corrioPara: string | null = null;
  let anterior: Promise<unknown> = Promise.resolve();
  return {
    debeCorrer: (id) => id !== null && id !== corrioPara,
    correr(id, fn) {
      corrioPara = id;
      const p = anterior.catch(() => undefined).then(fn);
      anterior = p;
      return p;
    },
    olvidar: () => {
      corrioPara = null;
    },
  };
}
