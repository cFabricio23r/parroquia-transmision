import { redirect } from 'next/navigation';
import { misParroquias } from '../../lib/mis-parroquias';
import { etiquetaUsuario, inicial } from '../../lib/persona';
import { clienteServidor } from '../../lib/supabase/servidor';
import { usuarioActual } from '../../lib/usuario-actual';
import { Boton } from '../componentes/Boton';
import { CajaInfo } from '../componentes/CajaInfo';
import { Chip } from '../componentes/Chip';
import { MarcoPagina } from '../componentes/MarcoPagina';
import { MensajeEstado } from '../componentes/MensajeEstado';
import { Tarjeta } from '../componentes/Tarjeta';
import { salir } from './acciones-sesion';

export const metadata = { title: '¿Qué vas a editar? · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** C1 · Elegir parroquia (AB/VicCoordElegir) y «Sin parroquia asignada» (A5). */
export default async function ElegirParroquia() {
  const sesion = await clienteServidor();
  const u = await usuarioActual(sesion);
  if (!u) redirect('/editor/entrar');
  // RLS: un coordinador ve solo sus parroquias; un administrador, todas.
  const parroquias = await misParroquias(sesion);
  // Con una sola parroquia se va directo a ella (un administrador se queda: necesita el enlace a la administración).
  if (parroquias.length === 1 && !u.esAdmin) redirect(`/editor/p/${parroquias[0].slug}`);
  const usuario = { etiqueta: etiquetaUsuario(u), inicial: inicial(u.nombre, u.correo) };

  if (!parroquias.length && !u.esAdmin) {
    return (
      <MarcoPagina usuario={usuario}>
        <main className="pv-sin-parroquia">
          <MensajeEstado
            codigo="sin-parroquia"
            rol="alert"
            accion={
              <form action={salir}>
                <Boton variante="secundario" type="submit">
                  Cerrar sesión
                </Boton>
              </form>
            }
          />
        </main>
      </MarcoPagina>
    );
  }

  return (
    <MarcoPagina usuario={usuario}>
      <main className="pv-elegir">
        <h1 className="pv-elegir-titulo">¿Qué vas a editar?</h1>
        <p className="pv-elegir-texto">Ves solo las parroquias que te asignaron.</p>
        <Tarjeta>
          {parroquias.length ? (
            <ul className="pv-elegir-lista">
              {parroquias.map((p) => (
                <li key={p.id} className="pv-elegir-fila">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="pv-elegir-cruz">
                    <path d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6z" fill="#1155a4" />
                  </svg>
                  <span className="pv-elegir-datos">
                    <span className="pv-elegir-nombre">{p.nombre}</span>
                    <span className="pv-elegir-slug">Parroquia · {p.slug}</span>
                  </span>
                  {p.version === null ? <Chip tono="ambar">Borrador</Chip> : <Chip tono="verde">Publicada · v{p.version}</Chip>}
                  <Boton variante="secundario" href={`/editor/p/${p.slug}`} aria-label={`Editar ${p.nombre}`}>
                    Editar
                  </Boton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pv-elegir-vacio">Todavía no hay parroquias.</p>
          )}
        </Tarjeta>
        <CajaInfo>
          Casi siempre es una sola parroquia: entonces entras directo al editor y esta pantalla no aparece. Si alguien transmite
          desde una capilla, lo hace la parroquia a cargo, con su misma identidad.
        </CajaInfo>
        {u.esAdmin && (
          <div>
            <Boton variante="secundario" href="/editor/admin">
              Administrar parroquias
            </Boton>
          </div>
        )}
      </main>
    </MarcoPagina>
  );
}
