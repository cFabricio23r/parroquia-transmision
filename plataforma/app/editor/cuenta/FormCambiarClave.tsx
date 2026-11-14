'use client';
import { useRef, useState, type FormEvent } from 'react';
import { claveValida, MENSAJE_CLAVES_NO_IGUALES, requisitosClave } from '../../../lib/clave';
import { Boton } from '../../componentes/Boton';
import { CampoClave } from '../../componentes/CampoClave';
import { ListaRequisitos } from '../../componentes/ListaRequisitos';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { MENSAJES_ACCESO } from '../../../lib/mensajes-acceso';
import { useEnvio } from '../../componentes/useEnvio';
import { cambiarMiClave } from '../acciones-sesion';

type Resultado = { error?: string; campo?: 'actual' | 'nueva'; codigo?: 'muchos-intentos' | 'sin-conexion' };

/** Cambiar contraseña desde Mi cuenta, pidiendo la actual (Decisión 11 del plan 2). */
export function FormCambiarClave() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [r, setR] = useState<Resultado>();
  const [noSirve, setNoSirve] = useState(0);
  const [intento, setIntento] = useState(0);
  const [listo, setListo] = useState(false);
  const { ocupado, enviar: enviarAccion } = useEnvio();
  const alerta = useRef<HTMLDivElement>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setListo(false);
    setR(undefined);
    if (!claveValida(nueva, repetida)) {
      setNoSirve((n) => n + 1); // sin llamar al servidor
      return;
    }
    setNoSirve(0);
    const envio = await enviarAccion(() => cambiarMiClave(actual, nueva, repetida));
    if (envio.tipo === 'ocupado') return;
    setIntento((n) => n + 1);
    // Si la acción ni llegó al servidor, el mismo aviso que cuando Supabase no responde.
    const res: Resultado = envio.tipo === 'fallo' ? { codigo: 'sin-conexion', error: MENSAJES_ACCESO['sin-conexion'].texto } : envio.valor;
    if (!res.error) {
      setActual('');
      setNueva('');
      setRepetida('');
      setListo(true);
      return;
    }
    setR(res);
    if (res.campo === 'actual') setTimeout(() => document.getElementById('actual')?.focus(), 0);
    else if (!res.codigo) setTimeout(() => alerta.current?.focus(), 0);
  }

  const errorGeneral = r?.error && !r.codigo && r.campo !== 'actual' ? r.error : undefined;
  return (
    // noValidate: la validación es la nuestra («Contraseña que no sirve»), no el globo del navegador.
    <form onSubmit={enviar} noValidate className="pv-cuenta-form">
      <h2 className="pv-cuenta-subtitulo">Cambiar contraseña</h2>
      {r?.codigo && <MensajeEstado key={intento} codigo={r.codigo} incrustado rol="alert" enfocar />}
      {noSirve > 0 && <MensajeEstado key={`n${noSirve}`} codigo="clave-no-sirve" incrustado rol="alert" enfocar />}
      {errorGeneral && (
        <div ref={alerta} role="alert" tabIndex={-1} className="pv-alerta">
          {errorGeneral}.
        </div>
      )}
      <CampoClave
        id="actual"
        etiqueta="Contraseña actual"
        autoComplete="current-password"
        valor={actual}
        onCambio={setActual}
        error={r?.campo === 'actual' ? r.error : undefined}
      />
      <CampoClave id="nueva" etiqueta="Contraseña nueva" autoComplete="new-password" valor={nueva} onCambio={setNueva} />
      <CampoClave
        id="repetida"
        etiqueta="Repite la contraseña nueva"
        autoComplete="new-password"
        valor={repetida}
        onCambio={setRepetida}
        error={repetida.length > 0 && repetida !== nueva ? MENSAJE_CLAVES_NO_IGUALES : undefined}
      />
      <ListaRequisitos requisitos={requisitosClave(nueva, repetida)} />
      <div>
        <Boton type="submit" ocupado={ocupado}>
          Cambiar contraseña
        </Boton>
      </div>
      <div role="status" className="pv-cuenta-estado">
        {listo ? 'Listo: tu contraseña cambió.' : ''}
      </div>
    </form>
  );
}
