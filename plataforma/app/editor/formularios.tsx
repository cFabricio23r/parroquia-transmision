'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cambiarClave, entrar, pedirRecuperacion } from './acciones-sesion';

/** Resumen de errores: role="alert" y recibe el foco al aparecer. */
function Resumen({ mensaje }: { mensaje?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mensaje) ref.current?.focus();
  }, [mensaje]);
  if (!mensaje) return null;
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="resumen-error">
      {mensaje}
    </div>
  );
}

function Campo(props: { id: string; etiqueta: string; tipo: string; autoComplete: string; ayuda?: string; error?: string }) {
  const ayudaId = props.ayuda ? `${props.id}-ayuda` : undefined;
  const errorId = props.error ? `${props.id}-error` : undefined;
  return (
    <div className="campo">
      <label htmlFor={props.id}>{props.etiqueta}</label>
      <input
        id={props.id}
        name={props.id}
        type={props.tipo}
        autoComplete={props.autoComplete}
        required
        aria-invalid={props.error ? true : undefined}
        aria-describedby={[ayudaId, errorId].filter(Boolean).join(' ') || undefined}
      />
      {props.ayuda && (
        <p id={ayudaId} className="ayuda">
          {props.ayuda}
        </p>
      )}
      {props.error && (
        <p id={errorId} className="error-campo">
          {props.error}
        </p>
      )}
    </div>
  );
}

const valor = (e: FormEvent<HTMLFormElement>, nombre: string) => String(new FormData(e.currentTarget).get(nombre) ?? '');

export function FormEntrar() {
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = { correo: valor(e, 'correo'), clave: valor(e, 'clave') };
    setOcupado(true);
    const r = await entrar(datos.correo, datos.clave);
    setError(r?.error);
    setOcupado(false);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={error} />
      <Campo id="correo" etiqueta="Correo" tipo="email" autoComplete="username" error={error} />
      <Campo id="clave" etiqueta="Contraseña" tipo="password" autoComplete="current-password" />
      <button className="boton" type="submit" disabled={ocupado}>
        Entrar
      </button>
    </form>
  );
}

export function FormOlvide() {
  const [mensaje, setMensaje] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const aviso = useRef<HTMLDivElement>(null);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const correo = valor(e, 'correo');
    setOcupado(true);
    const r = await pedirRecuperacion(correo);
    setMensaje(r.mensaje);
    setOcupado(false);
    setTimeout(() => aviso.current?.focus(), 0);
  }
  return (
    <form onSubmit={enviar}>
      {mensaje && (
        <div ref={aviso} role="status" tabIndex={-1} className="aviso">
          {mensaje}
        </div>
      )}
      <Campo id="correo" etiqueta="Correo" tipo="email" autoComplete="email" ayuda="Te enviaremos un enlace para elegir una contraseña nueva." />
      <button className="boton" type="submit" disabled={ocupado}>
        Enviar el enlace
      </button>
    </form>
  );
}

export function FormNuevaClave() {
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = { clave: valor(e, 'clave'), repetida: valor(e, 'repetida') };
    setOcupado(true);
    const r = await cambiarClave(datos.clave, datos.repetida);
    setError(r?.error);
    setOcupado(false);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={error} />
      <Campo id="clave" etiqueta="Contraseña nueva" tipo="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres." error={error} />
      <Campo id="repetida" etiqueta="Repite la contraseña" tipo="password" autoComplete="new-password" />
      <button className="boton" type="submit" disabled={ocupado}>
        Guardar la contraseña
      </button>
    </form>
  );
}
