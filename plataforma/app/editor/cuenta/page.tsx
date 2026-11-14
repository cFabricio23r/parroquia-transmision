import { redirect } from 'next/navigation';
import { idsDeMisMembresias, misParroquias } from '../../../lib/mis-parroquias';
import { etiquetaRol, etiquetaUsuario, inicial } from '../../../lib/persona';
import { clienteServidor } from '../../../lib/supabase/servidor';
import { usuarioActual } from '../../../lib/usuario-actual';
import { Chip } from '../../componentes/Chip';
import { MarcoPagina } from '../../componentes/MarcoPagina';
import { Tarjeta } from '../../componentes/Tarjeta';
import { FormCambiarClave } from './FormCambiarClave';
import { FormCuenta } from './FormCuenta';

export const metadata = { title: 'Mi cuenta · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** C2 · Mi cuenta (AB/VicCuenta). */
export default async function Cuenta() {
  const sesion = await clienteServidor();
  const u = await usuarioActual(sesion);
  if (!u) redirect('/editor/entrar');
  const [parroquias, membresias] = await Promise.all([misParroquias(sesion), idsDeMisMembresias(sesion, u.id)]);
  // Chips de la Decisión 10: el rol y una por parroquia asignada; un admin sin parroquias, «Todas las parroquias».
  const asignadas = parroquias.filter((p) => membresias.includes(p.id));
  const chips = (
    <>
      <Chip tono="azul">{etiquetaRol(u.esAdmin)}</Chip>
      {asignadas.map((p) => (
        <Chip key={p.id} tono="gris">
          {p.nombre}
        </Chip>
      ))}
      {u.esAdmin && asignadas.length === 0 && <Chip tono="gris">Todas las parroquias</Chip>}
    </>
  );
  return (
    <MarcoPagina usuario={{ etiqueta: etiquetaUsuario(u), inicial: inicial(u.nombre, u.correo) }}>
      <main className="pv-cuenta">
        <Tarjeta como="section" etiqueta="Datos" relleno={26} className="pv-cuenta-seccion pv-cuenta-seccion--datos">
          <FormCuenta nombre={u.nombre ?? ''} correo={u.correo} chips={chips} />
        </Tarjeta>
        <Tarjeta como="section" etiqueta="Cambiar contraseña" relleno={26} className="pv-cuenta-seccion pv-cuenta-seccion--clave">
          <FormCambiarClave />
        </Tarjeta>
      </main>
    </MarcoPagina>
  );
}
