'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cambiarClave } from './acciones-sesion';

/** Resumen de errores: role="alert" y recibe el foco al aparecer. */
export function Resumen({ mensaje }: { mensaje?: string }) {
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

export function Campo(props: { id: string; etiqueta: string; tipo: string; autoComplete: string; ayuda?: string; error?: string }) {
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

export function FormNuevaClave() {
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = { clave: valor(e, 'clave'), repetida: valor(e, 'repetida') };
    setError(undefined);
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
