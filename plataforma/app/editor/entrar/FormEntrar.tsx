'use client';
import { useState, type FormEvent } from 'react';
import { Boton } from '../../componentes/Boton';
import { CajaInfo } from '../../componentes/CajaInfo';
import { CampoClave } from '../../componentes/CampoClave';
import { CampoTexto } from '../../componentes/CampoTexto';
import { EnlaceTexto } from '../../componentes/EnlaceTexto';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { useEnvio } from '../../componentes/useEnvio';
import { entrar } from '../acciones-sesion';

/** A1 · Entrar (AB/VicAccesoEntrar). */
export function FormEntrar() {
  const [error, setError] = useState<'incorrectos' | 'muchos-intentos' | 'sin-conexion'>();
  const [intento, setIntento] = useState(0); // vuelve a enfocar el mensaje aunque sea el mismo
  const { ocupado, enviar: enviarAccion } = useEnvio();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const r = await enviarAccion(() => entrar(String(datos.get('correo') ?? ''), String(datos.get('clave') ?? ''))); // si sale bien, redirige
    if (r.tipo === 'ocupado') return;
    setError(r.tipo === 'fallo' ? 'sin-conexion' : r.valor?.error);
    setIntento((n) => n + 1);
  }

  function entendido() {
    setError(undefined);
    setTimeout(() => (document.getElementById('correo') as HTMLInputElement | null)?.focus(), 0);
  }

  return (
    <form onSubmit={enviar}>
      <h1 className="pv-titulo-acceso">Entrar</h1>
      <p className="pv-texto-acceso">Usa el correo con el que te invitaron y tu contraseña.</p>
      {error === 'incorrectos' && (
        <MensajeEstado
          key={intento}
          codigo="incorrectos"
          incrustado
          rol="alert"
          enfocar
          accion={<EnlaceTexto href="/editor/olvide">Olvidé mi contraseña</EnlaceTexto>}
        />
      )}
      {error === 'muchos-intentos' && (
        <MensajeEstado
          key={intento}
          codigo="muchos-intentos"
          incrustado
          rol="alert"
          enfocar
          accion={
            <Boton variante="secundario" onClick={entendido}>
              Entendido
            </Boton>
          }
        />
      )}
      {error === 'sin-conexion' && <MensajeEstado key={intento} codigo="sin-conexion" incrustado rol="alert" enfocar />}
      <CampoTexto id="correo" etiqueta="Correo" type="email" autoComplete="username" required />
      <CampoClave id="clave" etiqueta="Contraseña" autoComplete="current-password" />
      <Boton type="submit" anchoCompleto ocupado={ocupado}>
        Entrar
      </Boton>
      <div className="pv-centro">
        <EnlaceTexto href="/editor/olvide">Olvidé mi contraseña</EnlaceTexto>
      </div>
      <CajaInfo>
        Solo pueden entrar las personas invitadas por la Pastoral de Comunicaciones. ¿Te llegó una invitación? Ábrela desde el correo para crear tu contraseña.
      </CajaInfo>
    </form>
  );
}
