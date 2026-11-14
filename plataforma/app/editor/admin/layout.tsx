import type { ReactNode } from 'react';
import '../editor.css';

// Layout de transición: la administración vieja conserva su estilo hasta que el plan 5 la reemplace.
export default function LayoutAdminViejo({ children }: { children: ReactNode }) {
  return <div className="editor">{children}</div>;
}
