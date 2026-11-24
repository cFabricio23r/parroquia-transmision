-- Misas listas compartidas.
--
-- guardadas: las transmisiones guardadas («misas listas») que se comparten entre el panel de OBS en
-- la PC y la app del celular. Una fila por guardada y parroquia; el id lo crea el aparato que la guarda
-- (hasta 24 letras y números, y un sufijo opcional), por eso la clave primaria es (parroquia_id, id).
--
-- Choque panel/app: gana lo último que se guardó (actualizado_en). Cada aparato manda la hora en que
-- hizo el cambio (puede haberse hecho sin red), recortada a now() para que un reloj adelantado no gane
-- para siempre. Si lo que llega es más viejo que lo guardado, el update no cambia nada (return old),
-- salvo usada_en, que solo sube.
--
-- Borrar es un update: borrada_en = actualizado_en = la hora del borrado. Una edición posterior manda
-- borrada_en = null con un actualizado_en mayor y gana por la misma regla; una copia vieja no resucita.
--
-- registro: cada cambio queda anotado (accion 'cambiar_guardadas'), venga del panel o de la app, sin
-- los datos.

create table public.guardadas (
  parroquia_id uuid not null references public.parroquias on delete cascade,
  id text not null check (id ~ '^[a-z0-9]{4,24}(-[a-z0-9]{4,12})?$'),
  nombre text not null check (char_length(nombre) between 1 and 80),
  tipo text not null check (tipo ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tipo) between 2 and 40),
  datos jsonb not null default '{}' check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 16384),
  guardada_en timestamptz not null,
  usada_en timestamptz not null,
  actualizado_en timestamptz not null,
  actualizado_desde text not null default 'panel' check (actualizado_desde in ('app', 'panel')),
  actualizado_por uuid null,
  borrada_en timestamptz null,
  primary key (parroquia_id, id)
);

-- Dos guardadas activas de la misma parroquia no pueden llamarse igual (sin importar mayúsculas ni
-- espacios de los bordes). Las borradas no cuentan.
create unique index guardadas_nombre_activo on public.guardadas (parroquia_id, lower(btrim(nombre))) where borrada_en is null;

alter table public.guardadas enable row level security;
revoke all on public.guardadas from anon;

create policy guardadas_leer on public.guardadas for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy guardadas_insertar on public.guardadas for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy guardadas_actualizar on public.guardadas for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy guardadas_borrar on public.guardadas for delete to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());

-- Antes de guardar: lo que no cambia, las horas, quién gana y el tope de 200.
create function public.guardadas_antes() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  -- 1. En un update no cambian la parroquia ni el id.
  if tg_op = 'UPDATE' then
    if new.parroquia_id is distinct from old.parroquia_id or new.id is distinct from old.id then
      raise exception 'no se puede cambiar la parroquia ni el id de una guardada';
    end if;
  end if;

  -- 2. Quién la cambió, y las horas que manda el aparato, nunca en el futuro.
  new.actualizado_por := auth.uid();
  new.actualizado_en := least(coalesce(new.actualizado_en, now()), now());
  new.usada_en := least(coalesce(new.usada_en, now()), now());
  new.guardada_en := least(coalesce(new.guardada_en, now()), now());
  if new.borrada_en is not null then
    new.borrada_en := least(new.borrada_en, now());
  end if;

  -- 3. Usar una guardada solo sube usada_en, nunca lo baja.
  if tg_op = 'UPDATE' then
    new.usada_en := greatest(old.usada_en, new.usada_en);
  end if;

  -- 4. Si lo que llega es más viejo que lo guardado, gana lo guardado (con el usada_en más alto).
  if tg_op = 'UPDATE' and new.actualizado_en < old.actualizado_en then
    old.usada_en := new.usada_en;
    return old;
  end if;

  -- 5. Al borrar, el aparato manda borrada_en y actualizado_en iguales: la fila queda con la hora del
  --    borrado. Una edición posterior manda borrada_en = null con un actualizado_en mayor y gana por la
  --    regla 4; una copia vieja (actualizado_en menor) no la resucita.
  if new.borrada_en is not null and new.actualizado_en < new.borrada_en then
    new.actualizado_en := new.borrada_en;
  end if;

  -- 6. Tope: 200 activas por parroquia. Cuenta a las otras (volver a subir una que ya existe no suma).
  if new.borrada_en is null
     and (tg_op = 'INSERT' or old.borrada_en is not null)
     and (select count(*) from public.guardadas g
          where g.parroquia_id = new.parroquia_id and g.borrada_en is null and g.id <> new.id) >= 200 then
    raise exception 'tope de guardadas' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger guardadas_antes
  before insert or update on public.guardadas
  for each row execute function public.guardadas_antes();

-- Marca una guardada como usada. Solo sube usada_en, y respeta RLS (security invoker).
create function public.usar_guardada(p_parroquia uuid, p_id text, p_cuando timestamptz) returns void
language sql security invoker set search_path = ''
as $$
  update public.guardadas
     set usada_en = greatest(usada_en, least(p_cuando, now()))
   where parroquia_id = p_parroquia and id = p_id;
$$;

-- Después de cada cambio: una fila en registro, sin los datos.
create function public.guardadas_registrar() returns trigger
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
  detalle := jsonb_build_object(
    'tabla', tg_table_name,
    'operacion', lower(tg_op),
    'desde', fila -> 'actualizado_desde',
    'tipo', fila -> 'tipo'
  );
  insert into public.registro (parroquia_id, usuario_id, accion, detalle)
  values ((fila ->> 'parroquia_id')::uuid, auth.uid(), 'cambiar_guardadas', detalle);
  return null;
end;
$$;

create trigger guardadas_registro
  after insert or update or delete on public.guardadas
  for each row execute function public.guardadas_registrar();

revoke all on function public.guardadas_antes() from public, anon, authenticated;
revoke all on function public.guardadas_registrar() from public, anon, authenticated;
revoke all on function public.usar_guardada(uuid, text, timestamptz) from public, anon;
grant execute on function public.usar_guardada(uuid, text, timestamptz) to authenticated;
