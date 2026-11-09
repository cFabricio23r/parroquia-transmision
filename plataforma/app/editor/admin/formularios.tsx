'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Campo as NombreCampo, Resultado } from '../../../lib/admin';
import { Campo, Resumen } from '../formularios';
import { aceptarInvitacion, crearParroquia, invitar, quitarAcceso } from './acciones';

const valor = (e: FormEvent<HTMLFormElement>, nombre: string) => String(new FormData(e.currentTarget).get(nombre) ?? '');

/** El mensaje solo se ata a un campo si el error dice a cuál se refiere; si no, va solo en el resumen. */
const de = (r: Resultado | undefined, campo: NombreCampo) => (r?.campo === campo ? r.error : undefined);

export function FormNuevaParroquia() {
  const [r, setR] = useState<Resultado>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = { slug: valor(e, 'slug'), nombre: valor(e, 'nombre') };
    setR(undefined); // se vuelve a anunciar y enfocar aunque el mensaje sea el mismo
    setOcupado(true);
    const res = await crearParroquia(datos.slug, datos.nombre); // si sale bien, redirige
    setR(res);
    setOcupado(false);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={r?.error} />
      <Campo id="nombre" etiqueta="Nombre de la parroquia" tipo="text" autoComplete="off" error={de(r, 'nombre')} />
      <Campo
        id="slug"
        etiqueta="Dirección"
        tipo="text"
        autoComplete="off"
        ayuda="De 3 a 40 caracteres: minúsculas sin tildes, números y guiones (por ejemplo san-pedro-apostol)."
        error={de(r, 'slug')}
      />
      <button className="boton" type="submit" disabled={ocupado}>
        Crear la parroquia
      </button>
    </form>
  );
}

export function FormInvitar({ parroquiaId }: { parroquiaId: string }) {
  const [r, setR] = useState<Resultado>();
  const [hecho, setHecho] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const correo = valor(e, 'correo');
    setR(undefined);
    setHecho(undefined);
    setOcupado(true);
    const res = await invitar(correo, parroquiaId);
    setOcupado(false);
    setR(res);
    if (res.error) return;
    formulario.reset();
    setHecho(`Le enviamos la invitación a ${correo}.`);
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={r?.error} />
      {hecho && (
        <div role="status" className="aviso">
          {hecho}
        </div>
      )}
      <Campo id="correo" etiqueta="Correo del coordinador" tipo="email" autoComplete="off" error={de(r, 'correo')} />
      <button className="boton" type="submit" disabled={ocupado}>
        Invitar coordinador
      </button>
    </form>
  );
}

/** Quitar acceso en dos pasos: el primer botón pide confirmar y el foco pasa al botón de confirmar. */
export function BotonQuitar({ parroquiaId, usuarioId, correo }: { parroquiaId: string; usuarioId: string; correo: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const confirmar = useRef<HTMLButtonElement>(null);
  const pedir = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmando) confirmar.current?.focus();
  }, [confirmando]);

  async function quitar() {
    setError(undefined);
    setOcupado(true);
    const r = await quitarAcceso(parroquiaId, usuarioId);
    setOcupado(false);
    setError(r.error);
    if (r.error) setConfirmando(false);
  }
  function cancelar() {
    setConfirmando(false);
    setTimeout(() => pedir.current?.focus(), 0);
  }
  return (
    <>
      {confirmando ? (
        <span role="group" aria-label={`Confirmar: quitar acceso a ${correo}`} className="confirmar" onKeyDown={(e) => e.key === 'Escape' && cancelar()}>
          <span>¿Quitar el acceso a {correo}?</span>
          <button ref={confirmar} type="button" className="boton boton-peligro" onClick={quitar} disabled={ocupado}>
            Sí, quitar acceso
          </button>
          <button type="button" className="boton boton-corto boton-neutro" onClick={cancelar} disabled={ocupado}>
            Cancelar
          </button>
        </span>
      ) : (
        <button ref={pedir} type="button" className="boton boton-peligro" onClick={() => setConfirmando(true)} aria-label={`Quitar acceso a ${correo}`}>
          Quitar acceso
        </button>
      )}
      <Resumen mensaje={error} />
    </>
  );
}

export function FormAceptar({ token, correo, crearCuenta }: { token: string; correo: string; crearCuenta: boolean }) {
  const [r, setR] = useState<(Resultado & { aviso?: string }) | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (r?.aviso) aviso.current?.focus();
  }, [r]);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = crearCuenta ? { clave: valor(e, 'clave'), repetida: valor(e, 'repetida') } : { clave: '', repetida: '' };
    setR(undefined);
    setOcupado(true);
    const res = await aceptarInvitacion(token, datos.clave, datos.repetida); // si sale bien, redirige
    setR(res);
    setOcupado(false);
  }
  if (r?.aviso) {
    return (
      <div ref={aviso} role="status" tabIndex={-1} className="aviso">
        <p>{r.aviso}</p>
        <p>
          <Link href="/editor/entrar">Ir a entrar</Link>
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={enviar}>
      <Resumen mensaje={r?.error} />
      {crearCuenta ? (
        <>
          <p>
            Vas a crear tu cuenta con el correo <strong>{correo}</strong>. Elige una contraseña.
          </p>
          <Campo id="clave" etiqueta="Contraseña" tipo="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres." error={de(r, 'clave')} />
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
