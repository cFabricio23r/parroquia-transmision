'use client';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

/**
 * Filtro «Lugar» de D3 (Decisión 19 del plan 5): «Todos» más una opción por parroquia, por id.
 * Con el ratón (o el dedo), elegir navega a `?parroquia=<id>`. Con el teclado no (WCAG 3.2.2, ronda 2):
 * las flechas solo recorren las opciones y se aplica con Enter o con «Filtrar», que se ve al recibir el
 * foco. Sin JavaScript, el formulario GET con «Filtrar» hace lo mismo.
 */
export function FiltroLugar({ parroquias, elegida }: { parroquias: { id: string; nombre: string }[]; elegida: string }) {
  const router = useRouter();
  const conPuntero = useRef(false);
  const ir = (v: string) => router.push(v ? `/editor/admin/registro?parroquia=${encodeURIComponent(v)}` : '/editor/admin/registro');
  return (
    <form
      method="get"
      action="/editor/admin/registro"
      className="pv-admin-filtro-lugar"
      onSubmit={(e) => {
        e.preventDefault();
        ir(String(new FormData(e.currentTarget).get('parroquia') ?? ''));
      }}
    >
      <label className="pv-admin-lugar">
        Lugar
        <select
          key={elegida}
          name="parroquia"
          defaultValue={elegida}
          onPointerDown={() => {
            conPuntero.current = true;
          }}
          onKeyDown={(e) => {
            conPuntero.current = false;
            if (e.key === 'Enter') {
              e.preventDefault();
              ir(e.currentTarget.value);
            }
          }}
          onChange={(e) => {
            if (conPuntero.current) ir(e.target.value);
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
      <button type="submit" className="pv-boton pv-boton--secundario pv-boton--compacto pv-solo-lectores pv-solo-lectores--foco">
        Filtrar
      </button>
    </form>
  );
}
