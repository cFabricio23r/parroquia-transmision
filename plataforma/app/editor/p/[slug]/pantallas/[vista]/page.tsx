import { vistaEditor } from '../../../../../../lib/editor/pantallas';
import { SeccionPantallaEditar } from './SeccionPantallaEditar';

export async function generateMetadata({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  const v = vistaEditor(vista);
  return { title: `${v ? v.titulo : 'Pantallas'} · Parroquia en Vivo` };
}

export default async function Pagina({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = await params;
  return <SeccionPantallaEditar vista={vista} />;
}
