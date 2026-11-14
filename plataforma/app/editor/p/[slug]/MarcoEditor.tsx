'use client';
// Marco del editor (todos los artboards F): encabezado con el estado del guardado y el chip del
// borrador, menú lateral con el punto de cada sección y el <main> con la disposición de la sección.
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { textoChipBorrador } from '../../../../lib/editor/cambios';
import { hrefSeccion, SECCIONES, seccionDeRuta } from '../../../../lib/editor/secciones';
import { CajaInfo } from '../../../componentes/CajaInfo';
import { Encabezado } from '../../../componentes/Encabezado';
import { MenuLateral } from '../../../componentes/MenuLateral';
import { useBorrador } from './ProveedorBorrador';

export const NOTA_MENU = 'Todo se guarda solo como borrador. En OBS no cambia nada hasta que publiques.';
export const AVISO_CELULAR =
  'El editor está pensado para una computadora. Desde el celular puedes mirar, pero para editar usa una pantalla más grande.';

/** Decisión 6: «Guardando…» mientras hay algo por guardar, «Guardado» al día, «Sin guardar» si falló. */
export function textoGuardado(estado: string): string {
  if (estado === 'guardado') return 'Guardado';
  if (estado === 'guardando' || estado === 'pendiente') return 'Guardando…';
  return 'Sin guardar';
}

export function MarcoEditor({ children }: { children: ReactNode }) {
  const { datos, borrador, guardado, estados, cambios } = useBorrador();
  const pathname = usePathname() ?? '';
  const actual = seccionDeRuta(pathname, datos.slug);
  const nombre = (typeof borrador.nombre === 'string' && borrador.nombre.trim()) || datos.nombreParroquia;
  const chip = textoChipBorrador(cambios.length, datos.publicada?.numero ?? null);

  return (
    <div className="pv-editor">
      <Encabezado
        subtitulo={`Editor · ${nombre}`}
        usuario={datos.usuario}
        variante="editor"
        enlaceInicio
        chip={
          <>
            <span className="pv-guardado" role="status">
              {textoGuardado(guardado.estado)}
            </span>
            <span className={chip.tono === 'verde' ? 'pv-chip-borrador pv-chip-borrador--verde' : 'pv-chip-borrador'}>{chip.texto}</span>
          </>
        }
      />
      <div className="pv-editor-cuerpo">
        <MenuLateral
          items={SECCIONES.map((s) => ({
            href: hrefSeccion(datos.slug, s.id),
            texto: s.texto,
            actual: s.id === actual.id,
            estado: s.id === 'publicar' ? undefined : estados[s.id].estado,
          }))}
          pie={NOTA_MENU}
        />
        <main className={`pv-editor-main pv-editor-main--${actual.disposicion}`}>
          <div className="pv-editor-celular">
            <CajaInfo>{AVISO_CELULAR}</CajaInfo>
          </div>
          <div className="pv-editor-form">{children}</div>
        </main>
      </div>
    </div>
  );
}
