-- Esquema de la plataforma multiparroquia (Etapa 2a).
-- Las políticas de acceso (RLS) están en 20261108000002_rls.sql.

create table public.parroquias (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  nombre text not null,
  creada_en timestamptz default now(),
  creada_por uuid references auth.users,
  -- Último número entregado por reservar_version (ver más abajo). Se agrega a
  -- lo pedido para que dos llamadas simultáneas nunca reciban el mismo número.
  ultima_version int not null default 0
);

create table public.administradores (
  usuario_id uuid primary key references auth.users on delete cascade
);

create table public.miembros (
  parroquia_id uuid references public.parroquias on delete cascade,
  usuario_id uuid references auth.users on delete cascade,
  rol text not null default 'coordinador' check (rol = 'coordinador'),
  primary key (parroquia_id, usuario_id)
);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  correo text not null,
  rol text not null check (rol in ('coordinador', 'administrador')),
  parroquia_id uuid null references public.parroquias on delete cascade,
  token_hash text unique not null,
  vence_en timestamptz not null,
  usada_en timestamptz,
  anulada_en timestamptz,
  creada_por uuid,
  creada_en timestamptz default now(),
  -- Un coordinador siempre se invita a una parroquia; un administrador, a ninguna
  check ((rol = 'coordinador') = (parroquia_id is not null))
);

create table public.borradores (
  parroquia_id uuid primary key references public.parroquias on delete cascade,
  config jsonb not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid
);

create table public.versiones (
  id uuid primary key default gen_random_uuid(),
  parroquia_id uuid references public.parroquias on delete cascade,
  numero int not null,
  config jsonb not null,
  publicada_en timestamptz default now(),
  publicada_por uuid,
  origen_numero int null,
  unique (parroquia_id, numero)
);

create table public.registro (
  id bigserial primary key,
  parroquia_id uuid null,
  usuario_id uuid null,
  accion text not null,
  detalle jsonb not null default '{}',
  en timestamptz default now()
);

create table public.envios_correo (
  id bigserial primary key,
  correo text not null,
  tipo text not null,
  en timestamptz default now()
);

-- Funciones de seguridad. security definer + search_path vacío + nombres
-- completos: no se pueden secuestrar con un esquema falso.

create function public.es_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.administradores where usuario_id = auth.uid());
$$;

create function public.es_miembro(p uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros where parroquia_id = p and usuario_id = auth.uid()
  );
$$;

-- Entrega el siguiente número de versión de una parroquia. Bloquea la fila de
-- la parroquia mientras actualiza el contador, así que llamadas simultáneas
-- reciben números distintos. Toma el mayor entre el contador y max(numero)+1,
-- por si alguien insertó versiones sin pasar por aquí.
create function public.reservar_version(p uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  n int;
begin
  update public.parroquias
     set ultima_version = greatest(
           ultima_version,
           coalesce((select max(v.numero) from public.versiones v where v.parroquia_id = p), 0)
         ) + 1
   where id = p
   returning ultima_version into n;
  if n is null then
    raise exception 'la parroquia % no existe', p;
  end if;
  return n;
end;
$$;

revoke all on function public.reservar_version(uuid) from public, anon, authenticated;
grant execute on function public.reservar_version(uuid) to service_role;

revoke all on function public.es_admin() from public, anon;
revoke all on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_admin() to authenticated, service_role;
grant execute on function public.es_miembro(uuid) to authenticated, service_role;

-- Disparador: cada vez que se guarda el borrador queda una fila en `registro`
-- con quién lo guardó y qué claves de primer nivel de `config` cambiaron.
create function public.borradores_registrar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  campos text[];
begin
  select coalesce(array_agg(k order by k), '{}')
    into campos
    from (
      select k
        from jsonb_object_keys(coalesce(old.config, '{}'::jsonb) || coalesce(new.config, '{}'::jsonb)) as k
       where (old.config -> k) is distinct from (new.config -> k)
    ) cambiadas;
  insert into public.registro (parroquia_id, usuario_id, accion, detalle)
  values (new.parroquia_id, auth.uid(), 'guardar_borrador', jsonb_build_object('campos', to_jsonb(campos)));
  return new;
end;
$$;

create trigger borradores_registro
  after update on public.borradores
  for each row execute function public.borradores_registrar();
