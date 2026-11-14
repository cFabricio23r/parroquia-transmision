'use client';
import { useRef, useState, type FormEvent } from 'react';
import { claveValida, MENSAJE_CLAVES_NO_IGUALES, requisitosClave } from '../../../lib/clave';
import { Boton } from '../../componentes/Boton';
import { CampoClave } from '../../componentes/CampoClave';
import { ListaRequisitos } from '../../componentes/ListaRequisitos';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { useEnvio } from '../../componentes/useEnvio';
import { cambiarClave } from '../acciones-sesion';

/** A4 · Crea una contraseña nueva (AB/VicAccesoNueva). */
export function FormNuevaClave({ correo }: { correo: string }) {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [noSirve, setNoSirve] = useState(0); // >0: se intentó enviar sin cumplir los requisitos
  const [errorServidor, setErrorServidor] = useState<string>();
  const [fallos, setFallos] = useState(0); // >0: la acción no llegó al servidor
  const { ocupado, enviar: enviarAccion } = useEnvio();
  const alerta = useRef<HTMLDivElement>(null);
  const distintas = repetida.length > 0 && repetida !== clave;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorServidor(undefined);
    setFallos(0);
    if (!claveValida(clave, repetida)) {
      setNoSirve((n) => n + 1); // sin llamar al servidor
      return;
    }
    setNoSirve(0);
    const envio = await enviarAccion(() => cambiarClave(clave, repetida)); // si sale bien, redirige a /editor
    if (envio.tipo === 'ocupado') return;
    if (envio.tipo === 'fallo') {
      setFallos((n) => n + 1);
      return;
    }
    const r = envio.valor;
    if (r?.error) {
      setErrorServidor(r.error);
      setTimeout(() => alerta.current?.focus(), 0);
    }
  }

  return (
    // noValidate: la validación es la nuestra («Contraseña que no sirve»), no el globo del navegador.
    <form onSubmit={enviar} noValidate>
      <h1 className="pv-titulo-acceso">Crea una contraseña nueva</h1>
      <p className="pv-texto-acceso">
        Para <b>{correo}</b>.
      </p>
      {noSirve > 0 && <MensajeEstado key={noSirve} codigo="clave-no-sirve" incrustado rol="alert" enfocar />}
      {fallos > 0 && <MensajeEstado key={`f${fallos}`} codigo="sin-conexion" incrustado rol="alert" enfocar />}
      {errorServidor && (
        <div ref={alerta} role="alert" tabIndex={-1} className="pv-alerta">
          {errorServidor}.
        </div>
      )}
      <CampoClave id="clave" etiqueta="Contraseña nueva" autoComplete="new-password" valor={clave} onCambio={setClave} />
      <CampoClave
        id="repetida"
        etiqueta="Repite la contraseña"
        autoComplete="new-password"
        valor={repetida}
        onCambio={setRepetida}
        error={distintas ? MENSAJE_CLAVES_NO_IGUALES : undefined}
      />
      <ListaRequisitos requisitos={requisitosClave(clave, repetida)} />
      <Boton type="submit" anchoCompleto ocupado={ocupado}>
        Guardar y entrar
      </Boton>
    </form>
  );
}
