import type { ReactNode } from 'react';
// Sistema visual de la plataforma (spec, sección 1). CSS global con prefijo pv-: Next no descarga
// el CSS global al navegar, así que todo lleva el prefijo para no chocar entre páginas.
import '../estilos/fuentes.css';
import '../estilos/tokens.css';
import '../estilos/base.css';
import '../estilos/componentes.css';
import '../estilos/marco.css';
import '../estilos/editor-marco.css';
import '../estilos/editor-estilo.css';

export default function EditorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
