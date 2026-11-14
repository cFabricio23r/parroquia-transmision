'use client';
import { useRouter } from 'next/navigation';

/**
 * Filtro «Lugar» de D3 (Decisión 19 del plan 5): «Todos» más una opción por parroquia, por id.
 * Cambiarlo navega a `?parroquia=<id>`. Sin JavaScript, el formulario GET con «Filtrar» hace lo mismo.
 */
export function FiltroLugar({ parroquias, elegida }: { parroquias: { id: string; nombre: string }[]; elegida: string }) {
  const router = useRouter();
  return (
    <form method="get" action="/editor/admin/registro">
      <label className="pv-admin-lugar">
        Lugar
        <select
          name="parroquia"
          value={elegida}
          onChange={(e) => {
            const v = e.target.value;
            router.push(v ? `/editor/admin/registro?parroquia=${encodeURIComponent(v)}` : '/editor/admin/registro');
          }}
        >
          <option value="">Todos</option>
          {parroquias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="pv-solo-lectores">
        Filtrar
      </button>
    </form>
  );
}
