'use client';
import { useRef, useState, type FormEvent } from 'react';
import { claveValida, MENSAJE_CLAVES_NO_IGUALES, requisitosClave } from '../../../lib/clave';
import { Boton } from '../../componentes/Boton';
import { CampoClave } from '../../componentes/CampoClave';
import { ListaRequisitos } from '../../componentes/ListaRequisitos';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { cambiarClave } from '../acciones-sesion';

/** A4 · Crea una contraseña nueva (AB/VicAccesoNueva). */
export function FormNuevaClave({ correo }: { correo: string }) {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [noSirve, setNoSirve] = useState(0); // >0: se intentó enviar sin cumplir los requisitos
  const [errorServidor, setErrorServidor] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const alerta = useRef<HTMLDivElement>(null);
  const distintas = repetida.length > 0 && repetida !== clave;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorServidor(undefined);
    if (!claveValida(clave, repetida)) {
      setNoSirve((n) => n + 1); // sin llamar al servidor
      return;
    }
    setNoSirve(0);
    setOcupado(true);
    const r = await cambiarClave(clave, repetida); // si sale bien, redirige a /editor
    setOcupado(false);
    if (r?.error) {
      setErrorServidor(r.error);
      setTimeout(() => alerta.current?.focus(), 0);
    }
  }

  return (
    <form onSubmit={enviar}>
      <h1 className="pv-titulo-acceso">Crea una contraseña nueva</h1>
      <p className="pv-texto-acceso">
        Para <b>{correo}</b>.
      </p>
      {noSirve > 0 && <MensajeEstado key={noSirve} codigo="clave-no-sirve" incrustado rol="alert" enfocar />}
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
      <Boton type="submit" anchoCompleto disabled={ocupado}>
        Guardar y entrar
      </Boton>
    </form>
  );
}
