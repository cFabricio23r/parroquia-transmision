'use client';
import { useBorrador } from '../ProveedorBorrador';
import { Versiones } from '../Versiones';

export function PaginaPublicar() {
  const { datos, guardado } = useBorrador();
  // Publicar sube lo último guardado: mientras el guardado no esté en «guardado», queda bloqueado.
  return (
    <div className="editor pv-publicar-transicion">
      <Versiones slug={datos.slug} versiones={datos.versiones} sinGuardar={guardado.estado !== 'guardado'} />
    </div>
  );
}
