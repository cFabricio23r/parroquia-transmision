-- borradores_registrar es la función del disparador de borradores (0001). Es security definer y,
-- como toda función nueva, nació ejecutable por public: el revisor de seguridad de Supabase la
-- marca como llamable por anon y authenticated vía /rest/v1/rpc. Una función que devuelve
-- trigger no se puede llamar fuera de un disparador, pero igual se le quita el permiso:
-- el disparador no lo necesita (corre con los permisos del dueño de la tabla).
revoke all on function public.borradores_registrar() from public, anon, authenticated;
