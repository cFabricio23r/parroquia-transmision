-- Seguridad por filas (RLS). Todas las tablas la tienen activada; lo que no
-- tiene política queda cerrado, salvo para service_role (que salta RLS).

alter table public.parroquias enable row level security;
alter table public.administradores enable row level security;
alter table public.miembros enable row level security;
alter table public.invitaciones enable row level security;
alter table public.borradores enable row level security;
alter table public.versiones enable row level security;
alter table public.registro enable row level security;
alter table public.envios_correo enable row level security;

-- Defensa en profundidad: los visitantes anónimos ni siquiera tienen permiso
-- sobre las tablas, y envios_correo es solo del servidor.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public.envios_correo from authenticated;

-- parroquias
create policy parroquias_leer on public.parroquias for select to authenticated
  using (public.es_admin() or public.es_miembro(id));
create policy parroquias_insertar on public.parroquias for insert to authenticated
  with check (public.es_admin());
create policy parroquias_actualizar on public.parroquias for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- miembros
create policy miembros_leer on public.miembros for select to authenticated
  using (public.es_admin() or usuario_id = auth.uid());
create policy miembros_insertar on public.miembros for insert to authenticated
  with check (public.es_admin());
create policy miembros_actualizar on public.miembros for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy miembros_borrar on public.miembros for delete to authenticated
  using (public.es_admin());

-- administradores: solo lectura; escribe únicamente service_role
create policy administradores_leer on public.administradores for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

-- invitaciones: todo solo para administradores
create policy invitaciones_todo on public.invitaciones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- borradores: leer, insertar y actualizar (no borrar)
create policy borradores_leer on public.borradores for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());
create policy borradores_insertar on public.borradores for insert to authenticated
  with check (public.es_miembro(parroquia_id) or public.es_admin());
create policy borradores_actualizar on public.borradores for update to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin())
  with check (public.es_miembro(parroquia_id) or public.es_admin());

-- versiones: solo lectura
create policy versiones_leer on public.versiones for select to authenticated
  using (public.es_miembro(parroquia_id) or public.es_admin());

-- registro: lo lee solo el administrador; escribe el disparador o service_role
create policy registro_leer on public.registro for select to authenticated
  using (public.es_admin());

-- envios_correo: sin políticas. Solo service_role.
