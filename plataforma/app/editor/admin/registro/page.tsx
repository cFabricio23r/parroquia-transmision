import { compararEs } from '../../../../lib/admin-textos';
import { todasLasFilas } from '../../../../lib/admin-parroquias';
import { listarRegistro } from '../../../../lib/registro';
import { clienteServicio } from '../../../../lib/supabase/servicio';
import { Chip } from '../../../componentes/Chip';
import { Tabla } from '../../../componentes/Tabla';
import { FiltroLugar } from './FiltroLugar';

export const metadata = { title: 'Registro · Administración · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

const COLUMNAS = [
  { titulo: 'Cuándo', ancho: '170px' },
  { titulo: 'Quién', ancho: '200px' },
  { titulo: 'Qué hizo', ancho: '1fr' },
  { titulo: 'Tipo', ancho: '140px' },
];

/**
 * D3 · Registro de cambios (AB/VicAdminRegistro). El layout ya comprobó que quien entra es admin.
 * `?parroquia=<uuid>` filtra por parroquia; un valor que no es una parroquia conocida se ignora.
 */
export default async function Registro({ searchParams }: { searchParams: Promise<{ parroquia?: string }> }) {
  const { parroquia } = await searchParams;
  const servicio = clienteServicio();
  const parroquias = (
    await todasLasFilas<{ id: string; nombre: string }>((d, h) => servicio.from('parroquias').select('id, nombre').order('id').range(d, h))
  ).sort((a, b) => compararEs(a.nombre, b.nombre));
  const elegida = typeof parroquia === 'string' && parroquias.some((p) => p.id === parroquia) ? parroquia : '';
  const filas = await listarRegistro(servicio, elegida || undefined);
  return (
    <main className="pv-admin">
      <div className="pv-admin-cabeza">
        <h1 className="pv-admin-titulo">Registro de cambios</h1>
        <FiltroLugar parroquias={parroquias} elegida={elegida} />
      </div>
      <Tabla
        etiqueta="Registro de cambios"
        className="pv-tabla--registro"
        columnas={COLUMNAS}
        filas={filas.map((f) => ({
          clave: String(f.id),
          celdas: [
            <time key="c" dateTime={f.en}>
              {f.cuando}
            </time>,
            <b key="q">{f.quien}</b>,
            <span key="f">{f.frase}</span>,
            <Chip key="t" tono={f.chip.tono}>
              {f.chip.texto}
            </Chip>,
          ],
        }))}
      />
      {filas.length === 0 && <p className="pv-admin-nota">Todavía no hay cambios registrados.</p>}
      <p className="pv-admin-nota">Solo quién hizo qué y cuándo. No guarda contraseñas ni datos de las transmisiones.</p>
    </main>
  );
}
