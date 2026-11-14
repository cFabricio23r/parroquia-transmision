import type { ReactNode } from 'react';
import '../../editor.css';

// Layout de transición: el editor viejo de una parroquia conserva su estilo hasta que el plan 3 lo reemplace.
export default function LayoutEditorViejo({ children }: { children: ReactNode }) {
  return <div className="editor">{children}</div>;
}
