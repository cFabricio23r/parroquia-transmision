'use client';
// Marco del editor (todos los artboards F): encabezado con el estado del guardado y el chip del
// borrador, menú lateral con el punto de cada sección y el <main> con la disposición de la sección.
import { usePathname } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { textoChipBorrador } from '../../../../lib/editor/cambios';
import { hrefSeccion, SECCIONES, seccionDeRuta, sinChipBorrador, usaBorrador, vistaPreviaDeRuta } from '../../../../lib/editor/secciones';
import { CajaInfo } from '../../../componentes/CajaInfo';
import { Encabezado } from '../../../componentes/Encabezado';
import { MenuLateral } from '../../../componentes/MenuLateral';
import { AvisoGuardado } from './AvisoGuardado';
import { GuardiaSalida } from './GuardiaSalida';
import { PanelVistaPrevia } from './PanelVistaPrevia';
import { useBorrador } from './ProveedorBorrador';

export const NOTA_MENU = 'Todo se guarda solo como borrador. En OBS no cambia nada hasta que publiques. App y transmisión se guarda al instante y no necesita Publicar.';
export const AVISO_CELULAR =
  'El editor está pensado para una computadora. Desde el celular puedes mirar, pero para editar usa una pantalla más grande.';

/**
 * Decisión 6: «Guardando…» mientras hay algo por guardar, «Guardado» al día, «Sin guardar» si falló
 * o si un formulario (como «Editar aviso») tiene lo escrito sin guardar.
 */
export function textoGuardado(estado: string, formularioSinGuardar = false): string {
  if (formularioSinGuardar) return 'Sin guardar';
  if (estado === 'guardado') return 'Guardado';
  if (estado === 'guardando' || estado === 'pendiente') return 'Guardando…';
  return 'Sin guardar';
}

export function MarcoEditor({ children }: { children: ReactNode }) {
  const { datos, borrador, guardado, estados, cambios, formularios } = useBorrador();
  const formularioSinGuardar = Object.values(formularios).some((f) => f.sucio);
  const pathname = usePathname() ?? '';
  const actual = seccionDeRuta(pathname, datos.slug);
  const ruta = vistaPreviaDeRuta(pathname, datos.slug);
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
              {textoGuardado(guardado.estado, formularioSinGuardar)}
            </span>
            {!sinChipBorrador(pathname, datos.slug) && (
              <span className={chip.tono === 'verde' ? 'pv-chip-borrador pv-chip-borrador--verde' : 'pv-chip-borrador'}>{chip.texto}</span>
            )}
          </>
        }
      />
      <div className="pv-editor-cuerpo">
        <MenuLateral
          items={SECCIONES.map((s) => ({
            href: hrefSeccion(datos.slug, s.id),
            texto: s.texto,
            actual: s.id === actual.id,
            estado: usaBorrador(s.id) ? estados[s.id].estado : undefined,
          }))}
          pie={NOTA_MENU}
        />
        <main
          className={`pv-editor-main pv-editor-main--${ruta.disposicion}`}
          style={{ '--pv-ancho-form': `${ruta.anchoFormulario}px` } as CSSProperties}
        >
          <div className="pv-editor-celular">
            <CajaInfo>{AVISO_CELULAR}</CajaInfo>
          </div>
          <AvisoGuardado />
          <div className="pv-editor-form">{children}</div>
          <PanelVistaPrevia />
        </main>
      </div>
      <GuardiaSalida />
    </div>
  );
}
