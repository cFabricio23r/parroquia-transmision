import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { MENSAJE_SOLO_ADMIN } from '../../../lib/admin';
import { etiquetaUsuario, inicial } from '../../../lib/persona';
import { clienteServidor } from '../../../lib/supabase/servidor';
import { usuarioActual } from '../../../lib/usuario-actual';
import { Boton } from '../../componentes/Boton';
import { Encabezado } from '../../componentes/Encabezado';
import { Tarjeta } from '../../componentes/Tarjeta';
import { PestanasAdmin } from './PestanasAdmin';
import '../../estilos/admin.css';

export const dynamic = 'force-dynamic';

/**
 * Marco de la administración (D1–D3): encabezado y pestañas. Sin sesión va a entrar; quien no es admin
 * ve el aviso (Decisión 26 del plan 5). Las páginas no repiten esta comprobación, pero cada acción de
 * servidor sigue llamando a exigirAdmin.
 */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const u = await usuarioActual(await clienteServidor());
  if (!u) redirect('/editor/entrar');
  const usuario = { etiqueta: etiquetaUsuario(u), inicial: inicial(u.nombre, u.correo) };
  return (
    <>
      <Encabezado usuario={usuario} enlaceInicio />
      {u.esAdmin ? (
        <>
          <PestanasAdmin />
          {children}
        </>
      ) : (
        <main className="pv-admin pv-admin--solo">
          <Tarjeta relleno={26} className="pv-admin-solo">
            <h1 className="pv-admin-titulo">Administración</h1>
            <p role="alert" className="pv-alerta">
              {MENSAJE_SOLO_ADMIN}
            </p>
            <div>
              <Boton variante="secundario" href="/editor">
                Volver
              </Boton>
            </div>
          </Tarjeta>
        </main>
      )}
    </>
  );
}
