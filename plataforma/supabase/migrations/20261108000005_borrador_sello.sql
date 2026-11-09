-- El borrador lo sella el servidor: nadie decide su propia fecha de cambio.
-- El editor usa actualizado_en como candado para detectar guardados simultáneos (409),
-- así que no puede venir del navegador.

-- config siempre es un objeto JSON (no un arreglo, texto ni null JSON).
alter table public.borradores
  add constraint borradores_config_objeto check (jsonb_typeof(config) = 'object');

create function public.borradores_sellar() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

-- before update: sin cambios en `config` también se sella (cada guardado cuenta).
create trigger borradores_sello
  before update on public.borradores
  for each row execute function public.borradores_sellar();
