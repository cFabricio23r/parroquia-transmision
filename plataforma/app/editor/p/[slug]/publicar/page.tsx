// Transición (Decisión 18 del plan 3): «Publicar» con el componente de hoy dentro del marco nuevo.
// La reemplaza F12 en el plan 5. editor.css se importa solo aquí (estilos de Versiones).
import '../../../editor.css';
import { PaginaPublicar } from './PaginaPublicar';

export const metadata = { title: 'Publicar · Parroquia en Vivo' };

export default function Pagina() {
  return <PaginaPublicar />;
}
