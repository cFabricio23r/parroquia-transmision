/** Una parroquia que la app puede elegir: la lista sale de `public.parroquias`, con la sesión. */
export interface ParroquiaApp {
  id: string;
  slug: string;
  nombre: string;
}

/** La cuenta que entró: el nombre sale de `public.perfiles` y `esAdmin` de `public.administradores`. */
export interface Cuenta {
  usuarioId: string;
  correo: string;
  nombre: string | null;
  esAdmin: boolean;
}
