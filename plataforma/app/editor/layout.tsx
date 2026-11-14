import type { ReactNode } from 'react';
// Sistema visual de la plataforma (spec, sección 1). CSS global con prefijo pv-: Next no descarga
// el CSS global al navegar, así que convive con editor.css de las pantallas viejas.
import '../estilos/fuentes.css';
import '../estilos/tokens.css';
import '../estilos/base.css';
import '../estilos/componentes.css';

export default function EditorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
