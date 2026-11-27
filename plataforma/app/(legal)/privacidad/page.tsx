import { MarcoLegal } from '../MarcoLegal';
import { RESPONSABLE } from '../../../lib/legal';

export const metadata = { title: 'Política de privacidad · Parroquia en Vivo' };

export default function Privacidad() {
  return (
    <MarcoLegal ruta="/privacidad" titulo="Política de privacidad">
      <p>
        «Parroquia en Vivo» es la plataforma y la app con la que las parroquias de la vicaría preparan sus
        pantallas y transmiten sus misas y actividades. La administra {RESPONSABLE}. Esta página explica qué
        datos guardamos, para qué y cómo puedes pedir que los borremos.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <strong>Personas que usan la plataforma</strong> (coordinadores y voluntarios invitados): correo
          electrónico, el nombre que cada uno escribe y un registro de los cambios que hace.
        </li>
        <li>
          <strong>Conexión con Facebook</strong>, solo si una parroquia la activa: el nombre de la cuenta de
          Facebook que se conecta, la lista de páginas que esa cuenta administra (nombre, identificador y
          número de seguidores) y los permisos de acceso (tokens) que entrega Facebook. Los tokens se guardan
          cifrados y nunca salen de nuestro servidor.
        </li>
        <li>
          <strong>Transmisiones</strong>: el horario, el título y la descripción de cada transmisión, y el
          identificador de los vivos que se crean en Facebook.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Para que cada parroquia entre a su espacio y edite su información.</li>
        <li>
          Con Facebook, solo para mostrar las páginas que administras, crear las transmisiones en vivo en esas
          páginas y compartirlas en otras páginas de la vicaría que tú elijas.
        </li>
      </ul>
      <p>No leemos tus mensajes ni tu perfil personal, y no publicamos nada que no pidas.</p>

      <h2>La app del celular</h2>
      <p>
        La app usa la cámara y el micrófono solo mientras transmites. El registro técnico de la transmisión
        (calidad de la conexión, temperatura del teléfono) se guarda en el propio celular y solo sale de él si
        tú decides compartirlo.
      </p>

      <h2>Con quién se comparten</h2>
      <p>
        No vendemos ni compartimos tus datos con nadie para publicidad. Para funcionar usamos estos servicios,
        que guardan o procesan los datos por nosotros: Supabase (base de datos), Vercel (alojamiento de la
        plataforma), Resend (correos de invitación) y Meta (Facebook, para crear los vivos).
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la parroquia use la plataforma. Al desconectar Facebook, los tokens se borran en el momento.
        Si pides que borremos tus datos, lo hacemos en un plazo de 30 días.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir ver, corregir o borrar tus datos. Los pasos están en{' '}
        <a href="/eliminar-datos">Cómo eliminar tus datos</a>.
      </p>
    </MarcoLegal>
  );
}
