'use client';
import { useState, type FormEvent } from 'react';
import { Campo, Resumen } from '../formularios';
import { aceptarInvitacion, crearParroquia, invitar, quitarAcceso } from './acciones';

const valor = (e: FormEvent<HTMLFormElement>, nombre: string) => String(new FormData(e.currentTarget).get(nombre) ?? '');

export function FormNuevaParroquia() {
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = { slug: valor(e, 'slug'), nombre: valor(e, 'nombre') };
    setError(undefined);
    setOcupado(true);
    const r = await crearParroquia(datos.slug, datos.nombre); // si sale bien, redirige
    setError(r?.error);
    setOcupado(false);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={error} />
      <Campo id="nombre" etiqueta="Nombre de la parroquia" tipo="text" autoComplete="off" />
      <Campo
        id="slug"
        etiqueta="Dirección"
        tipo="text"
        autoComplete="off"
        ayuda="De 3 a 40 caracteres: minúsculas sin tildes, números y guiones (por ejemplo san-pedro-apostol)."
        error={error}
      />
      <button className="boton" type="submit" disabled={ocupado}>
        Crear la parroquia
      </button>
    </form>
  );
}

export function FormInvitar({ parroquiaId }: { parroquiaId: string }) {
  const [error, setError] = useState<string>();
  const [hecho, setHecho] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const correo = valor(e, 'correo');
    setError(undefined);
    setHecho(undefined);
    setOcupado(true);
    const r = await invitar(correo, parroquiaId);
    setOcupado(false);
    if (r.error) return setError(r.error);
    formulario.reset();
    setHecho(`Le enviamos la invitación a ${correo}.`);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={error} />
      {hecho && (
        <div role="status" className="aviso">
          {hecho}
        </div>
      )}
      <Campo id="correo" etiqueta="Correo del coordinador" tipo="email" autoComplete="off" error={error} />
      <button className="boton" type="submit" disabled={ocupado}>
        Invitar coordinador
      </button>
    </form>
  );
}

export function BotonQuitar({ parroquiaId, usuarioId, correo }: { parroquiaId: string; usuarioId: string; correo: string }) {
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function quitar() {
    setError(undefined);
    setOcupado(true);
    const r = await quitarAcceso(parroquiaId, usuarioId);
    setError(r.error);
    setOcupado(false);
  }
  return (
    <>
      <button type="button" className="boton boton-peligro" onClick={quitar} disabled={ocupado} aria-label={`Quitar acceso a ${correo}`}>
        Quitar acceso
      </button>
      <Resumen mensaje={error} />
    </>
  );
}

export function FormAceptar({ token, correo, crearCuenta }: { token: string; correo: string; crearCuenta: boolean }) {
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = crearCuenta ? { clave: valor(e, 'clave'), repetida: valor(e, 'repetida') } : { clave: '', repetida: '' };
    setError(undefined);
    setOcupado(true);
    const r = await aceptarInvitacion(token, datos.clave, datos.repetida); // si sale bien, redirige
    setError(r?.error);
    setOcupado(false);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={error} />
      {crearCuenta ? (
        <>
          <p>
            Vas a crear tu cuenta con el correo <strong>{correo}</strong>. Elige una contraseña.
          </p>
          <Campo id="clave" etiqueta="Contraseña" tipo="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres." error={error} />
          <Campo id="repetida" etiqueta="Repite la contraseña" tipo="password" autoComplete="new-password" />
        </>
      ) : (
        <p>
          Entraste como <strong>{correo}</strong>.
        </p>
      )}
      <button className="boton" type="submit" disabled={ocupado}>
        Aceptar la invitación
      </button>
    </form>
  );
}
