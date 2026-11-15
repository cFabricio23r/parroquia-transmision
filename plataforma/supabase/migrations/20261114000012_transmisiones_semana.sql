-- Transmisiones de la semana (etapa 3b).
--
-- transmisiones_fijas: lo que se repite cada semana («Hora Santa, todos los jueves a las 18:00»).
-- series: una tanda de días seguidos (una novena, una prenovena), desde inicio, durante dias días.
-- transmisiones: SOLO los días que alguien tocó (editado o saltado) y las transmisiones sueltas
--   («una sola vez»). Los días sin tocar de una fija o de una serie NO se guardan: se generan al
--   leer la semana (vicaria/semana.js, armarSemana). Por eso borrar una fija o una serie borra en
--   cascada sus días editados.
--
-- La clave del día identifica el día sin importar quién lo guarde: 'fija:<fija_id>:<AAAA-MM-DD>',
-- 'serie:<serie_id>:<AAAA-MM-DD>' o 'unica:<id>'. El disparador transmisiones_antes la revisa.
--
-- Choque web/app: gana lo último que se guardó. La web guarda con now(); la app manda la hora del
-- celular en que se hizo el cambio (puede haberse hecho sin red), recortada a now() para que un
-- reloj adelantado no gane para siempre. Si lo que manda la app es más viejo que lo guardado, el
-- update no cambia nada (return old) y la app recibe lo que hay.
--
-- registro: cada cambio de las tres tablas queda anotado (accion 'cambiar_semana'), venga de la web
-- o de la app, sin los datos.

create table public.transmisiones_fijas (
  id uuid primary key default gen_random_uuid(),
  parroquia_id uuid not null references public.parroquias on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tipo text not null check (tipo ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tipo) between 2 and 40),
  datos jsonb not null default '{}' check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 8192),
  activa boolean not null default true,
  creada_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, parroquia_id)
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  parroquia_id uuid not null references public.parroquias on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  tipo text not null check (tipo ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tipo) between 2 and 40),
  inicio date not null,
  dias int not null check (dias between 1 and 60),
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  datos jsonb not null default '{}' check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 8192),
  creada_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, parroquia_id)
);

create table public.transmisiones (
  id uuid primary key default gen_random_uuid(),
  parroquia_id uuid not null references public.parroquias on delete cascade,
  clave text not null,
  fecha date not null,
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tipo text not null check (tipo ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tipo) between 2 and 40),
  datos jsonb not null default '{}' check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 8192),
  origen text not null check (origen in ('fija', 'serie', 'unica')),
  fija_id uuid null,
  serie_id uuid null,
  saltada boolean not null default false,
  editada boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_desde text not null default 'web' check (actualizado_desde in ('web', 'app')),
  actualizado_por uuid null,
  unique (parroquia_id, clave),
  check ((origen = 'fija') = (fija_id is not null)),
  check ((origen = 'serie') = (serie_id is not null)),
  foreign key (fija_id, parroquia_id) references public.transmisiones_fijas (id, parroquia_id) on delete cascade,
  foreign key (serie_id, parroquia_id) references public.series (id, parroquia_id) on delete cascade
);

create index on public.transmisiones (parroquia_id, fecha);

alter table public.transmisiones_fijas enable row level security;
alter table public.series enable row level security;
alter table public.transmisiones enable row level security;
revoke all on public.transmisiones_fijas from anon;
revoke all on public.series from anon;
revoke all on public.transmisiones from anon;

create policy transmisiones_fijas_leer on public.transmisiones_fijas for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy transmisiones_fijas_insertar on public.transmisiones_fijas for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy transmisiones_fijas_actualizar on public.transmisiones_fijas for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy transmisiones_fijas_borrar on public.transmisiones_fijas for delete to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());

create policy series_leer on public.series for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy series_insertar on public.series for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy series_actualizar on public.series for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy series_borrar on public.series for delete to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());

create policy transmisiones_leer on public.transmisiones for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy transmisiones_insertar on public.transmisiones for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy transmisiones_actualizar on public.transmisiones for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy transmisiones_borrar on public.transmisiones for delete to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());

-- Antes de guardar un día: lo que no cambia, la clave, la regla de la app y quién gana.
create function public.transmisiones_antes() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  esperada text;
  enviado timestamptz;
begin
  -- 1. En un update no cambian la parroquia, la clave ni el origen del día.
  if tg_op = 'UPDATE' then
    if new.parroquia_id is distinct from old.parroquia_id
       or new.clave is distinct from old.clave
       or new.fecha is distinct from old.fecha
       or new.origen is distinct from old.origen
       or new.fija_id is distinct from old.fija_id
       or new.serie_id is distinct from old.serie_id then
      raise exception 'no se puede cambiar el día ni el origen de una transmisión';
    end if;
  end if;

  -- 2. La clave tiene que ser la de su origen, su id y su fecha.
  esperada := case new.origen
    when 'fija' then 'fija:' || new.fija_id::text || ':' || to_char(new.fecha, 'YYYY-MM-DD')
    when 'serie' then 'serie:' || new.serie_id::text || ':' || to_char(new.fecha, 'YYYY-MM-DD')
    when 'unica' then 'unica:' || new.id::text
  end;
  if new.clave is null then
    new.clave := esperada;
  end if;
  if esperada is null or new.clave is distinct from esperada then
    raise exception 'clave de día inválida';
  end if;

  -- 3. La app no crea transmisiones sueltas: solo edita días.
  if tg_op = 'INSERT' and new.origen = 'unica' and new.actualizado_desde = 'app' then
    raise exception 'la app no crea transmisiones sueltas';
  end if;

  -- 4. La hora del cambio: la web, ahora; la app, la del celular, nunca en el futuro.
  new.actualizado_por := auth.uid();
  if new.actualizado_desde = 'app' then
    enviado := case when tg_op = 'UPDATE' and new.actualizado_en is not distinct from old.actualizado_en
                    then now() else new.actualizado_en end;
    new.actualizado_en := least(coalesce(enviado, now()), now());
  else
    new.actualizado_en := now();
  end if;

  -- 5. Si lo de la app es más viejo que lo guardado, gana lo guardado.
  if tg_op = 'UPDATE' and new.actualizado_desde = 'app' and new.actualizado_en < old.actualizado_en then
    return old;
  end if;
  return new;
end;
$$;

create trigger transmisiones_antes
  before insert or update on public.transmisiones
  for each row execute function public.transmisiones_antes();

create function public.semana_tocar() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger transmisiones_fijas_tocar
  before update on public.transmisiones_fijas
  for each row execute function public.semana_tocar();
create trigger series_tocar
  before update on public.series
  for each row execute function public.semana_tocar();

-- Después de cada cambio: una fila en registro, sin los datos.
create function public.semana_registrar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  fila jsonb;
  detalle jsonb;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return null;
  end if;
  fila := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  detalle := jsonb_build_object('tabla', tg_table_name, 'operacion', lower(tg_op));
  if fila ? 'actualizado_desde' then
    detalle := detalle || jsonb_build_object('desde', fila -> 'actualizado_desde');
  end if;
  if fila ? 'fecha' then
    detalle := detalle || jsonb_build_object('fecha', fila -> 'fecha');
  end if;
  if fila ? 'tipo' then
    detalle := detalle || jsonb_build_object('tipo', fila -> 'tipo');
  end if;
  insert into public.registro (parroquia_id, usuario_id, accion, detalle)
  values ((fila ->> 'parroquia_id')::uuid, auth.uid(), 'cambiar_semana', detalle);
  return null;
end;
$$;

create trigger transmisiones_fijas_registro
  after insert or update or delete on public.transmisiones_fijas
  for each row execute function public.semana_registrar();
create trigger series_registro
  after insert or update or delete on public.series
  for each row execute function public.semana_registrar();
create trigger transmisiones_registro
  after insert or update or delete on public.transmisiones
  for each row execute function public.semana_registrar();

revoke all on function public.transmisiones_antes() from public, anon, authenticated;
revoke all on function public.semana_tocar() from public, anon, authenticated;
revoke all on function public.semana_registrar() from public, anon, authenticated;
