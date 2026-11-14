-- Desactivar parroquias (plan 5 del rediseño). Desactivar no borra nada: los archivos quedan en el
-- bucket `publicado` y los miembros, el borrador y las versiones en la base. Reactivar no copia nada.

-- Momento en que se desactivó; null = activa.
alter table public.parroquias add column desactivada_en timestamptz;

-- Un miembro de una parroquia desactivada deja de ser miembro para todo lo que depende de esta
-- función: parroquias_leer, las políticas de borradores, versiones_leer y puede_usar_borrador
-- (el Storage de borradores). El administrador no depende de ella y sigue viendo todo.
-- `create or replace` conserva los permisos (sin anon, como en 20261108000001_esquema.sql).
create or replace function public.es_miembro(p uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros m
    join public.parroquias pa on pa.id = m.parroquia_id
    where m.parroquia_id = p and m.usuario_id = auth.uid() and pa.desactivada_en is null
  );
$$;

-- Los slugs de las parroquias activas, para el build (herramientas/descargar-publicado.mjs), que
-- solo tiene la llave publicable. Es security definer y la puede llamar anon a propósito: devuelve
-- solo slugs, que ya son públicos en la dirección de cada pantalla.
create function public.slugs_activos() returns setof text
language sql stable security definer set search_path = ''
as $$
  select slug from public.parroquias where desactivada_en is null order by slug
$$;

revoke all on function public.slugs_activos() from public;
grant execute on function public.slugs_activos() to anon, authenticated, service_role;
