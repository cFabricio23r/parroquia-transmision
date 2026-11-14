'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Boton } from '../../../componentes/Boton';
import { CajaInfo } from '../../../componentes/CajaInfo';
import { CampoSelect } from '../../../componentes/CampoSelect';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { Dialogo } from '../../../componentes/Dialogo';
import { useEnvio } from '../../../componentes/useEnvio';
import { invitar } from '../acciones';
import { MENSAJE_SIN_CONEXION } from '../DialogoNuevaParroquia';

export interface OpcionParroquia {
  id: string;
  nombre: string;
}

/** «Invitar coordinador» (D2, Decisión 14 del plan 5). `elegida` viene del filtro `?parroquia=`. */
export function DialogoInvitar({
  abierto,
  onCerrar,
  parroquias,
  elegida,
  alInvitar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  parroquias: OpcionParroquia[];
  elegida?: string;
  alInvitar: (correo: string) => void;
}) {
  const [correo, setCorreo] = useState('');
  const [parroquia, setParroquia] = useState(elegida ?? parroquias[0]?.id ?? '');
  const [error, setError] = useState<{ texto: string; campo?: string }>();
  const { ocupado, enviar } = useEnvio();

  useEffect(() => {
    if (abierto) setParroquia(elegida ?? parroquias[0]?.id ?? '');
  }, [abierto, elegida, parroquias]);

  function cerrar() {
    setCorreo('');
    setError(undefined);
    onCerrar();
  }

  async function enviarInvitacion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await enviar(() => invitar(correo, parroquia));
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') return setError({ texto: MENSAJE_SIN_CONEXION });
    if (r.valor.error) return setError({ texto: r.valor.error, campo: r.valor.campo });
    const enviado = correo.trim().toLowerCase();
    cerrar();
    alInvitar(enviado);
  }

  return (
    <Dialogo abierto={abierto} titulo="Invitar coordinador" onCerrar={cerrar}>
      <form className="pv-admin-formulario" onSubmit={enviarInvitacion} noValidate>
        {error && error.campo !== 'correo' && (
          <p role="alert" className="pv-alerta">
            {error.texto}
          </p>
        )}
        <CampoTexto
          id="invitar-correo"
          etiqueta="Correo"
          type="email"
          autoComplete="off"
          value={correo}
          error={error?.campo === 'correo' ? error.texto : undefined}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <CampoSelect
          id="invitar-parroquia"
          etiqueta="Asignar a"
          ayuda="Una parroquia puede tener varios coordinadores; todos editan, publican y transmiten."
          value={parroquia}
          onChange={(e) => setParroquia(e.target.value)}
        >
          {parroquias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </CampoSelect>
        <CajaInfo>Le llega un correo para crear su contraseña. La invitación dura 7 días; si vence, se reenvía desde la lista.</CajaInfo>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" ocupado={ocupado}>
            Enviar invitación
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
