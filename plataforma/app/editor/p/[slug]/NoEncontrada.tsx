import { EnlaceTexto } from '../../../componentes/EnlaceTexto';
import { Encabezado, type UsuarioEncabezado } from '../../../componentes/Encabezado';

/** Parroquia que no existe o que no es de quien entra (RLS no las distingue: no se filtra cuál es cuál). */
export function NoEncontrada({ usuario }: { usuario: UsuarioEncabezado }) {
  return (
    <>
      <Encabezado usuario={usuario} enlaceInicio />
      <main className="pv-sin-parroquia">
        <div className="pv-mensaje">
          <h1 className="pv-mensaje-titulo">No encontramos esa parroquia</h1>
          <EnlaceTexto href="/editor">Volver a mis parroquias</EnlaceTexto>
        </div>
      </main>
    </>
  );
}
