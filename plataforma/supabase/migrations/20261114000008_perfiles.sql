-- Perfiles: el nombre con que se ve a cada persona (encabezado, Mi cuenta, registro de cambios).
-- Una fila por usuario; se borra con el usuario. El nombre lo escribe la propia persona (Mi cuenta)
-- o el servidor al aceptar una invitación (service_role, salta RLS).
create table public.perfiles (
  usuario_id uuid primary key references auth.users on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  -- La escribe el código en cada guardado (sin disparador).
  actualizado_en timestamptz not null default now()
);

alter table public.perfiles enable row level security;
-- Defensa en profundidad, como en 20261108000002_rls.sql: los anónimos ni siquiera tienen permiso.
revoke all on public.perfiles from anon;

-- ¿La persona de la sesión y `otro` coordinan alguna parroquia en común?
-- Es security definer porque la política miembros_leer solo deja ver las filas propias de `miembros`:
-- con los permisos de quien pregunta, la unión con las filas del otro siempre saldría vacía.
-- search_path vacío y nombres completos: no se puede secuestrar con un esquema falso.
create function public.comparte_parroquia(otro uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros a
    join public.miembros b on b.parroquia_id = a.parroquia_id
    where a.usuario_id = auth.uid() and b.usuario_id = otro
  );
$$;

revoke all on function public.comparte_parroquia(uuid) from public, anon;
grant execute on function public.comparte_parroquia(uuid) to authenticated, service_role;

-- Leer: la propia fila, un administrador todas, y un coordinador las de quienes comparten parroquia.
create policy perfiles_leer on public.perfiles for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin() or public.comparte_parroquia(usuario_id));
-- Escribir: solo la propia fila (no se borra: se va con el usuario).
create policy perfiles_insertar on public.perfiles for insert to authenticated
  with check (usuario_id = auth.uid());
create policy perfiles_actualizar on public.perfiles for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
