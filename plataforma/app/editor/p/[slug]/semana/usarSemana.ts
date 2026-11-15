'use client';
// Lee la semana y aplica operaciones con GET/POST /editor/api/[slug]/semana (sin borrador). Después de
// cada operación vuelve a leer: lo que se ve es lo que devolvió la base.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DatosSemana, OperacionSemana } from '../../../../../lib/semana-editor';

export const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo';
export const MENSAJE_SIN_LEER = 'No se pudo leer la semana. Recarga la página.';

export function usarSemana(slug: string, lunes: string) {
  const [datos, setDatos] = useState<DatosSemana | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const ultima = useRef(0);
  const base = `/editor/api/${encodeURIComponent(slug)}/semana`;

  const leer = useCallback(async () => {
    const n = ++ultima.current;
    setCargando(true);
    try {
      const r = await fetch(`${base}?lunes=${encodeURIComponent(lunes)}`, { cache: 'no-store' });
      const c = (await r.json().catch(() => ({}))) as DatosSemana & { error?: string };
      if (n !== ultima.current) return;
      if (!r.ok) {
        setError(c.error ?? MENSAJE_SIN_LEER);
        return;
      }
      setDatos(c);
      setError(null);
    } catch {
      if (n === ultima.current) setError(MENSAJE_SIN_CONEXION);
    } finally {
      if (n === ultima.current) setCargando(false);
    }
  }, [base, lunes]);

  useEffect(() => {
    void leer();
  }, [leer]);

  const operar = useCallback(
    async (op: OperacionSemana): Promise<{ error?: string }> => {
      try {
        const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) });
        const c = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) return { error: c.error ?? MENSAJE_SIN_CONEXION };
      } catch {
        return { error: MENSAJE_SIN_CONEXION };
      }
      await leer();
      return {};
    },
    [base, leer],
  );

  return { datos, error, cargando, operar };
}
