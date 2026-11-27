-- Facebook en vivo: la conexión de cada parroquia con Facebook y lo que la transmisión necesita.
--
-- facebook_conexion: una fila por parroquia con la cuenta de Facebook que la conectó. El token de
-- usuario se guarda CIFRADO (lo cifra la aplicación, no la base): acá es solo texto.
--
-- facebook_paginas: las páginas que ve la conexión de cada parroquia, con su token (también cifrado).
-- La clave es (parroquia_id, page_id): la misma página (por ejemplo la de la vicaría) puede figurar
-- en varias parroquias.
--
-- facebook_parroquia: la página principal de la parroquia. Una página principal pertenece a una
-- sola parroquia (unique).
--
-- facebook_parroquia_extra: páginas extra a las que se replica la transmisión, y si el crosspost
-- está listo o falta.
--
-- facebook_vivos: los directos en curso o terminados. A lo sumo uno activo por parroquia.
--
-- Estas tablas son SOLO de la clave de servicio: RLS activado y SIN políticas, así que ni un
-- coordinador ni un admin con su sesión ven nada (los tokens no salen nunca al navegador).

create table public.facebook_conexion (
  parroquia_id uuid primary key references public.parroquias on delete cascade,
  nombre_facebook text not null,
  token_usuario text not null,
  estado text not null check (estado in ('conectado', 'reconectar')),
  conectado_por uuid null references auth.users on delete set null,
  conectado_en timestamptz not null default now()
);

create table public.facebook_paginas (
  parroquia_id uuid not null references public.parroquias on delete cascade,
  page_id text not null,
  nombre text not null,
  seguidores integer null,
  token text not null,
  vista_en timestamptz not null default now(),
  primary key (parroquia_id, page_id)
);

create table public.facebook_parroquia (
  parroquia_id uuid primary key references public.parroquias on delete cascade,
  pagina_principal text not null unique,
  actualizado_por uuid null,
  actualizado_en timestamptz null
);

create table public.facebook_parroquia_extra (
  parroquia_id uuid not null references public.parroquias on delete cascade,
  page_id text not null,
  por_defecto boolean not null default false,
  crosspost text not null check (crosspost in ('listo', 'falta')),
  primary key (parroquia_id, page_id)
);

create table public.facebook_vivos (
  id uuid primary key default gen_random_uuid(),
  parroquia_id uuid not null references public.parroquias on delete cascade,
  vivo_id text not null,
  page_id text not null,
  extras text[] not null default '{}',
  empezado_en timestamptz not null default now(),
  terminado_en timestamptz null,
  creado_por uuid null
);

create unique index facebook_vivos_uno_activo on public.facebook_vivos (parroquia_id) where terminado_en is null;

alter table public.facebook_conexion enable row level security;
alter table public.facebook_paginas enable row level security;
alter table public.facebook_parroquia enable row level security;
alter table public.facebook_parroquia_extra enable row level security;
alter table public.facebook_vivos enable row level security;
-- Defensa en profundidad, como en 20261114000008_perfiles.sql: los anónimos ni siquiera tienen permiso.
revoke all on public.facebook_conexion from anon;
revoke all on public.facebook_paginas from anon;
revoke all on public.facebook_parroquia from anon;
revoke all on public.facebook_parroquia_extra from anon;
revoke all on public.facebook_vivos from anon;
-- Sin políticas para authenticated: solo la clave de servicio (que salta RLS) las lee y escribe.
