'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Resultado } from '../../../lib/admin';
import { claveValida, MENSAJE_CLAVES_NO_IGUALES, requisitosClave } from '../../../lib/clave';
import { MAX_NOMBRE, validarNombre } from '../../../lib/perfiles';
import { Boton } from '../../componentes/Boton';
import { CampoClave } from '../../componentes/CampoClave';
import { CampoTexto } from '../../componentes/CampoTexto';
import { EnlaceTexto } from '../../componentes/EnlaceTexto';
import { ListaRequisitos } from '../../componentes/ListaRequisitos';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { useEnvio } from '../../componentes/useEnvio';
import { aceptarInvitacion } from '../admin/acciones';

/**
 * A2 · Formulario de la invitación vigente. `crearCuenta`: pide nombre y contraseña (paso «crear»);
 * si no, solo «Aceptar la invitación» con la sesión ya iniciada (paso «aceptar»).
 */
export function FormInvitacion({ token, correo, crearCuenta, pie }: { token: string; correo: string; crearCuenta: boolean; pie: string }) {
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errorNombre, setErrorNombre] = useState<string>();
  const [noSirve, setNoSirve] = useState(0);
  const [r, setR] = useState<(Resultado & { aviso?: string }) | undefined>();
  const [fallos, setFallos] = useState(0); // >0: la acción no llegó al servidor
  const { ocupado, enviar: enviarAccion } = useEnvio();
  const alerta = useRef<HTMLDivElement>(null);
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (r?.aviso) aviso.current?.focus();
    else if (r?.error && r.campo !== 'nombre') alerta.current?.focus();
  }, [r]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setR(undefined);
    setFallos(0);
    if (crearCuenta) {
      const v = validarNombre(nombre);
      setErrorNombre('error' in v ? v.error : undefined);
      const claveBien = claveValida(clave, repetida);
      setNoSirve(claveBien ? 0 : (n) => n + 1);
      if ('error' in v) {
        if (claveBien) setTimeout(() => document.getElementById('nombre')?.focus(), 0);
        return;
      }
      if (!claveBien) return;
    }
    const envio = await enviarAccion(() =>
      aceptarInvitacion(token, crearCuenta ? clave : '', crearCuenta ? repetida : '', crearCuenta ? nombre : ''),
    ); // si sale bien, redirige
    if (envio.tipo === 'ocupado') return;
    if (envio.tipo === 'fallo') {
      setFallos((n) => n + 1);
      return;
    }
    const res = envio.valor;
    if (res.campo === 'nombre') setErrorNombre(res.error);
    setR(res);
  }

  if (r?.aviso) {
    return (
      <div ref={aviso} role="status" tabIndex={-1} className="pv-aviso">
        <span>{r.aviso}</span>
        <EnlaceTexto href="/editor/entrar">Ir a entrar</EnlaceTexto>
      </div>
    );
  }

  const errorServidor = r?.error && r.campo !== 'nombre' ? r.error : undefined;
  return (
    // noValidate: la validación es la nuestra («Escribe tu nombre.», «Contraseña que no sirve»), no el globo del navegador.
    <form onSubmit={enviar} noValidate>
      {fallos > 0 && <MensajeEstado key={`f${fallos}`} codigo="sin-conexion" incrustado rol="alert" enfocar />}
      {noSirve > 0 && <MensajeEstado key={noSirve} codigo="clave-no-sirve" incrustado rol="alert" enfocar />}
      {errorServidor && (
        <div ref={alerta} role="alert" tabIndex={-1} className="pv-alerta">
          {errorServidor}.
        </div>
      )}
      <CampoTexto id="correo" etiqueta="Correo" type="text" value={correo} readOnly ayuda="Es el correo de la invitación; no se puede cambiar." />
      {crearCuenta && (
        <>
          <CampoTexto
            id="nombre"
            etiqueta="Tu nombre"
            autoComplete="name"
            required
            maxLength={MAX_NOMBRE}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            ayuda="Así te ven en el registro de cambios."
            error={errorNombre}
          />
          <CampoClave id="clave" etiqueta="Crea una contraseña" autoComplete="new-password" valor={clave} onCambio={setClave} />
          <CampoClave
            id="repetida"
            etiqueta="Repite la contraseña"
            autoComplete="new-password"
            valor={repetida}
            onCambio={setRepetida}
            error={repetida.length > 0 && repetida !== clave ? MENSAJE_CLAVES_NO_IGUALES : undefined}
          />
          <ListaRequisitos requisitos={requisitosClave(clave, repetida)} />
        </>
      )}
      <Boton type="submit" anchoCompleto ocupado={ocupado}>
        {crearCuenta ? 'Crear cuenta y entrar' : 'Aceptar la invitación'}
      </Boton>
      <div className="pv-pie-acceso">{pie}</div>
    </form>
  );
}
