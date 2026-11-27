import type { ReactNode } from 'react';
import '../estilos/fuentes.css';
import '../estilos/tokens.css';
import '../estilos/base.css';
import '../estilos/marco.css';
import '../estilos/legal.css';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
