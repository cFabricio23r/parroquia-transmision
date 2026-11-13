-- Buckets de Storage.
--   borradores: privado. Ruta <parroquia_id>/<archivo>.
--   publicado:  público para leer. Solo service_role escribe (sin políticas de escritura).

insert into storage.buckets (id, name, public)
values ('borradores', 'borradores', false), ('publicado', 'publicado', true)
on conflict (id) do update set public = excluded.public;

-- Quién puede tocar la carpeta <parroquia_id>/ del bucket borradores: un
-- miembro de esa parroquia o un administrador. Si la primera carpeta no es un
-- uuid, se niega en vez de dar error de conversión.
create function public.puede_usar_borrador(ruta text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_admin() or (
    case when (storage.foldername(ruta))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then public.es_miembro(((storage.foldername(ruta))[1])::uuid)
         else false end
  );
$$;
revoke all on function public.puede_usar_borrador(text) from public, anon;
grant execute on function public.puede_usar_borrador(text) to authenticated, service_role;

create policy borradores_leer on storage.objects for select to authenticated
  using (bucket_id = 'borradores' and public.puede_usar_borrador(name));
create policy borradores_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'borradores' and public.puede_usar_borrador(name));
create policy borradores_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'borradores' and public.puede_usar_borrador(name))
  with check (bucket_id = 'borradores' and public.puede_usar_borrador(name));
create policy borradores_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'borradores' and public.puede_usar_borrador(name));

-- publicado: lectura y listado para todos (la Tarea 9 lo lista con la llave
-- publicable). Sin políticas de insert/update/delete: solo service_role escribe.
create policy publicado_leer on storage.objects for select to anon, authenticated
  using (bucket_id = 'publicado');
