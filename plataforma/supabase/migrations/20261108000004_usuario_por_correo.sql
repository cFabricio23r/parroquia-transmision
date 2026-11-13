-- Busca una cuenta por correo. El API de administración de Auth no tiene una
-- búsqueda directa (solo listUsers, que pagina), así que se lee auth.users aquí.
-- Solo la puede llamar service_role: nunca anon ni authenticated.
create function public.usuario_id_por_correo(p_correo text) returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_correo) limit 1;
$$;

revoke all on function public.usuario_id_por_correo(text) from public, anon, authenticated;
grant execute on function public.usuario_id_por_correo(text) to service_role;
