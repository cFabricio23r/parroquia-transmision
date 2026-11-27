import { MarcoLegal } from '../MarcoLegal';
import { RESPONSABLE } from '../../../lib/legal';

export const metadata = { title: 'Condiciones del servicio · Parroquia en Vivo' };

export default function Terminos() {
  return (
    <MarcoLegal ruta="/terminos" titulo="Condiciones del servicio">
      <p>
        «Parroquia en Vivo» es un servicio gratuito de {RESPONSABLE} para las parroquias de la vicaría. Al
        usarlo aceptas estas condiciones.
      </p>

      <h2>Quién puede usarlo</h2>
      <p>
        Solo las personas invitadas por la Pastoral de Comunicaciones o por el coordinador de su parroquia. Cada
        persona cuida su propia contraseña y su cuenta.
      </p>

      <h2>Uso correcto</h2>
      <ul>
        <li>Usa la plataforma solo para la vida de la parroquia: misas, celebraciones, avisos y actividades.</li>
        <li>
          Lo que se transmite o publica es responsabilidad de la parroquia que lo hace. No se permite contenido
          ajeno a la parroquia, ofensivo o que infrinja derechos de otros.
        </li>
        <li>
          Al conectar Facebook, aceptas también las condiciones de Facebook. Solo conecta páginas que tu
          parroquia administra.
        </li>
      </ul>

      <h2>Disponibilidad</h2>
      <p>
        Hacemos lo posible para que el servicio funcione siempre, pero no podemos garantizarlo: una
        transmisión puede cortarse por la conexión a internet, por el teléfono o por Facebook. El servicio se
        ofrece tal como está.
      </p>

      <h2>Suspensión</h2>
      <p>
        Podemos quitar el acceso a una cuenta que no cumpla estas condiciones. Cualquier persona puede dejar
        de usar el servicio y pedir que borremos sus datos (ver{' '}
        <a href="/eliminar-datos">Cómo eliminar tus datos</a>).
      </p>

      <h2>Privacidad</h2>
      <p>
        Cómo tratamos los datos está en la <a href="/privacidad">Política de privacidad</a>.
      </p>

      <h2>Cambios</h2>
      <p>Si cambiamos estas condiciones, actualizamos la fecha de arriba.</p>
    </MarcoLegal>
  );
}
