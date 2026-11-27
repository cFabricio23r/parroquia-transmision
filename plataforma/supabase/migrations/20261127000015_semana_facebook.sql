-- Título y descripción del vivo de Facebook en `datos.facebook` (spec facebook-en-vivo-directo,
-- «Cambio del usuario: título y descripción», 2026-11-27). La misma función de antes, con un paso más (3b):
-- cuando la app reescribe un día sin `facebook`, se conserva el que había.

create or replace function public.transmisiones_antes() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  esperada text;
  enviado timestamptz;
  fb jsonb;
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

  -- 3b. La app reescribe `datos` con lo que tiene el panel, que no sabe nada del vivo de Facebook: si no
  -- manda `facebook`, se conserva el que ya había (el del día, o el de su fija o serie si es su primer cambio).
  -- Así ni una APK vieja borra el título y la descripción que escribió el coordinador. La web sí puede quitarlo.
  if new.actualizado_desde = 'app' and not (coalesce(new.datos, '{}'::jsonb) ? 'facebook') then
    if tg_op = 'UPDATE' then
      fb := old.datos -> 'facebook';
    elsif new.origen = 'fija' then
      select f.datos -> 'facebook' into fb from public.transmisiones_fijas f
        where f.id = new.fija_id and f.parroquia_id = new.parroquia_id;
    elsif new.origen = 'serie' then
      select s.datos -> 'facebook' into fb from public.series s
        where s.id = new.serie_id and s.parroquia_id = new.parroquia_id;
    end if;
    if fb is not null then
      new.datos := coalesce(new.datos, '{}'::jsonb) || jsonb_build_object('facebook', fb);
    end if;
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

revoke all on function public.transmisiones_antes() from public, anon, authenticated;
