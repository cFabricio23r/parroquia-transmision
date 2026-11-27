import { Tarjeta } from '../../componentes/Tarjeta';

export const TITULO_PASOS_FACEBOOK = 'Para que una parroquia pueda conectar su Facebook';
export const PASOS_FACEBOOK = [
  'En la app de Meta de la vicaría, invita la cuenta de Facebook de la parroquia como «tester».',
  'La parroquia acepta la invitación desde su cuenta de Facebook.',
  'El coordinador entra a «App y transmisión» y toca «Conectar con Facebook».',
] as const;
export const NOTA_PASOS_FACEBOOK = 'Se hace una sola vez por cuenta. Cada parroquia elige sus páginas; aquí solo se ve el estado.';

/** Artboard E1: los tres pasos para conectar. Solo texto: el administrador no conecta por la parroquia. */
export function TarjetaFacebookAdmin() {
  return (
    <Tarjeta como="section" etiqueta={TITULO_PASOS_FACEBOOK} relleno={22}>
      <div className="pv-admin-fb">
        <h2 className="pv-subtitulo">{TITULO_PASOS_FACEBOOK}</h2>
        <ol className="pv-admin-fb-pasos">
          {PASOS_FACEBOOK.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p className="pv-admin-fb-nota">{NOTA_PASOS_FACEBOOK}</p>
      </div>
    </Tarjeta>
  );
}
