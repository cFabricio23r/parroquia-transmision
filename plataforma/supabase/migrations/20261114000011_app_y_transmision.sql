-- App y transmisión (etapa 3c): lo que la app Parroquia en vivo baja de la parroquia.
--
-- ajustes_app: una fila por parroquia con el servidor de Facebook Live, la calidad por defecto
-- (cada celular puede cambiarla) y el estilo de la pantalla final.
--
-- claves_transmision: la clave fija de transmisión de la página de la parroquia. La clave vive
-- SOLO acá (spec, «Cambio de regla: la clave pasa por la plataforma»): nunca en config.json, en lo
-- publicado, en Storage ni en el registro. El editor nunca la vuelve a leer: solo lee guardada_en.
--
-- Advertencia honesta: un coordinador de la parroquia, con su sesión, puede leer la clave (la app
-- la baja así); nadie de otra parroquia ni un anónimo. No se cifra (spec, «Datos nuevos», punto 3).

create table public.ajustes_app (
  parroquia_id uuid primary key references public.parroquias on delete cascade,
  servidor text null check (servidor is null or (servidor ~ '^rtmps://[^[:space:]]+$' and char_length(servidor) <= 300)),
  calidad_defecto text not null default '720p' check (calidad_defecto in ('720p', '1080p')),
  estilo_final text not null default 'azul' check (estilo_final in ('claro', 'azul')),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid null references auth.users on delete set null
);

create table public.claves_transmision (
  parroquia_id uuid primary key references public.parroquias on delete cascade,
  clave text not null check (char_length(clave) between 1 and 200 and clave !~ '[[:space:]]'),
  guardada_en timestamptz not null default now(),
  guardada_por uuid null references auth.users on delete set null
);

alter table public.ajustes_app enable row level security;
alter table public.claves_transmision enable row level security;
-- Defensa en profundidad, como en 20261114000008_perfiles.sql: los anónimos ni siquiera tienen permiso.
revoke all on public.ajustes_app from anon;
revoke all on public.claves_transmision from anon;

-- ajustes_app no se borra: se va con la parroquia.
create policy ajustes_app_leer on public.ajustes_app for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy ajustes_app_insertar on public.ajustes_app for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy ajustes_app_actualizar on public.ajustes_app for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());

create policy claves_transmision_leer on public.claves_transmision for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy claves_transmision_insertar on public.claves_transmision for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy claves_transmision_actualizar on public.claves_transmision for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy claves_transmision_borrar on public.claves_transmision for delete to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
