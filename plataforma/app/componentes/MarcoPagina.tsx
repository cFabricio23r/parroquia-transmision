import type { ReactNode } from 'react';
import { Encabezado, type UsuarioEncabezado } from './Encabezado';

/** Páginas con sesión fuera del editor (C1, C2): encabezado con usuario; cada página pone su <main>. */
export function MarcoPagina({ usuario, children }: { usuario: UsuarioEncabezado; children: ReactNode }) {
  return (
    <>
      <Encabezado usuario={usuario} enlaceInicio />
      {children}
    </>
  );
}
