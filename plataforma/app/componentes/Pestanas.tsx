import Link from 'next/link';

export interface ItemPestana {
  href: string;
  texto: string;
  actual?: boolean;
}

/** Pestañas de navegación (admin): enlaces con la actual subrayada en azul. */
export function Pestanas({ etiqueta, items }: { etiqueta?: string; items: ItemPestana[] }) {
  return (
    <nav aria-label={etiqueta ?? 'Secciones'} className="pv-pestanas">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="pv-pestana" aria-current={i.actual ? 'page' : undefined}>
          {i.texto}
        </Link>
      ))}
    </nav>
  );
}
