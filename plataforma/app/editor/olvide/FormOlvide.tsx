'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Boton } from '../../componentes/Boton';
import { CajaInfo } from '../../componentes/CajaInfo';
import { CampoTexto } from '../../componentes/CampoTexto';
import { EnlaceTexto } from '../../componentes/EnlaceTexto';
import { pedirRecuperacion } from '../acciones-sesion';

/**
 * A3 · ¿Olvidaste tu contraseña? (AB/VicAccesoOlvide). Después de enviar, la tarjeta se reemplaza
 * por «Revisa tu correo», exista o no la cuenta, y el foco pasa al título.
 */
export function FormOlvide() {
  const [enviado, setEnviado] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (enviado !== undefined) titulo.current?.focus();
  }, [enviado]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const correo = String(new FormData(e.currentTarget).get('correo') ?? '').trim();
    setOcupado(true);
    await pedirRecuperacion(correo);
    setOcupado(false);
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
      <CampoTexto id="correo" etiqueta="Correo" type="email" autoComplete="email" required />
      <Boton type="submit" anchoCompleto disabled={ocupado}>
        Enviar enlace
      </Boton>
      <div className="pv-centro">
        <EnlaceTexto href="/editor/entrar">Volver a entrar</EnlaceTexto>
      </div>
    </form>
  );
}
