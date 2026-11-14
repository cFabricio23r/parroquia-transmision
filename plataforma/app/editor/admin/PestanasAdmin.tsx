'use client';
import { usePathname } from 'next/navigation';
import { Pestanas } from '../../componentes/Pestanas';

/** Pestañas del admin: Parroquias (D1), Coordinadores (D2) y Registro (D3). */
export function PestanasAdmin() {
  const ruta = usePathname();
  return (
    <Pestanas
      etiqueta="Secciones"
      items={[
        { href: '/editor/admin', texto: 'Parroquias', actual: ruta === '/editor/admin' },
        { href: '/editor/admin/coordinadores', texto: 'Coordinadores', actual: ruta.startsWith('/editor/admin/coordinadores') },
        { href: '/editor/admin/registro', texto: 'Registro', actual: ruta.startsWith('/editor/admin/registro') },
      ]}
    />
  );
}
