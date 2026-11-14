'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Boton } from '../../componentes/Boton';
import { CajaInfo } from '../../componentes/CajaInfo';
import { CampoTexto } from '../../componentes/CampoTexto';
import { EnlaceTexto } from '../../componentes/EnlaceTexto';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { useEnvio } from '../../componentes/useEnvio';
import { pedirRecuperacion } from '../acciones-sesion';

/**
 * A3 · ¿Olvidaste tu contraseña? (AB/VicAccesoOlvide). Después de enviar, la tarjeta se reemplaza
 * por «Revisa tu correo», exista o no la cuenta, y el foco pasa al título.
 */
export function FormOlvide() {
  const [enviado, setEnviado] = useState<string>();
  const [fallos, setFallos] = useState(0); // >0: la acción no llegó al servidor
  const { ocupado, enviar: enviarAccion } = useEnvio();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (enviado !== undefined) titulo.current?.focus();
  }, [enviado]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const correo = String(new FormData(e.currentTarget).get('correo') ?? '').trim();
    const r = await enviarAccion(() => pedirRecuperacion(correo));
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') {
      setFallos((n) => n + 1);
      return;
    }
    setFallos(0);
    setEnviado(correo);
  }

  if (enviado !== undefined) {
    return (
      <>
        <h1 ref={titulo} tabIndex={-1} className="pv-titulo-acceso pv-titulo-acceso--24">
          Revisa tu correo
        </h1>
        <p className="pv-texto-acceso">
          Si <b>{enviado}</b> tiene una cuenta, le llegó un enlace para crear una contraseña nueva.
        </p>
        <CajaInfo>
          <b>¿No te llegó?</b> Revisa la carpeta de spam. El enlace dura 1 hora.
        </CajaInfo>
        <Boton variante="secundario" anchoCompleto href="/editor/entrar">
          Volver a entrar
        </Boton>
      </>
    );
  }
  return (
    <form onSubmit={enviar}>
      <h1 className="pv-titulo-acceso pv-titulo-acceso--24">¿Olvidaste tu contraseña?</h1>
      <p className="pv-texto-acceso">Escribe tu correo y te mandamos un enlace para crear una nueva.</p>
      {fallos > 0 && <MensajeEstado key={fallos} codigo="sin-conexion" incrustado rol="alert" enfocar />}
      <CampoTexto id="correo" etiqueta="Correo" type="email" autoComplete="email" required />
      <Boton type="submit" anchoCompleto ocupado={ocupado}>
        Enviar enlace
      </Boton>
      <div className="pv-centro">
        <EnlaceTexto href="/editor/entrar">Volver a entrar</EnlaceTexto>
      </div>
    </form>
  );
}
