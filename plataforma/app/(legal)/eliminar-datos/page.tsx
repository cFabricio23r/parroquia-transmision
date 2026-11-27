import { MarcoLegal } from '../MarcoLegal';
import { CONTACTO } from '../../../lib/legal';

export const metadata = { title: 'Cómo eliminar tus datos · Parroquia en Vivo' };

export default function EliminarDatos() {
  return (
    <MarcoLegal ruta="/eliminar-datos" titulo="Cómo eliminar tus datos">
      <p>Puedes borrar los datos que «Parroquia en Vivo» guarda de ti de cualquiera de estas formas.</p>

      <h2>1. Desconectar Facebook desde la plataforma</h2>
      <p>
        Si eres coordinador de una parroquia: entra a la plataforma, abre «App y transmisión» y toca
        «Desconectar Facebook». Los permisos de Facebook (tokens) de tu parroquia se borran en ese momento.
      </p>

      <h2>2. Quitar la app desde Facebook</h2>
      <ol>
        <li>En Facebook, abre «Configuración y privacidad» y luego «Configuración».</li>
        <li>Entra a «Integraciones comerciales» (o «Apps y sitios web»).</li>
        <li>Busca «Parroquia en Vivo», selecciónala y toca «Eliminar».</li>
      </ol>
      <p>Así la app deja de tener acceso a tu cuenta y a tus páginas.</p>

      <h2>3. Pedir que borremos todo</h2>
      <p>
        Envíanos un mensaje a <a href={CONTACTO.href}>{CONTACTO.texto}</a> que diga «Eliminar mis datos», con
        tu correo o el nombre de tu cuenta de Facebook. Borramos tu cuenta, tu nombre, tu conexión con Facebook
        y los datos de tus páginas en un plazo de 30 días y te lo confirmamos por el mismo medio.
      </p>
      <p>
        Lo que ya se publicó en Facebook (por ejemplo, un video en vivo en la página de la parroquia) lo
        borra quien administra esa página, desde Facebook.
      </p>
    </MarcoLegal>
  );
}
