'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { MAX_NOMBRE } from '../../../lib/perfiles';
import { Boton } from '../../componentes/Boton';
import { CampoTexto } from '../../componentes/CampoTexto';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { useEnvio } from '../../componentes/useEnvio';
import { guardarMiNombre, salir } from '../acciones-sesion';

/** Datos de Mi cuenta: nombre editable, correo de solo lectura, rol y parroquias, Guardar y Cerrar sesión. */
export function FormCuenta({ nombre: nombreInicial, correo, chips }: { nombre: string; correo: string; chips: ReactNode }) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [error, setError] = useState<string>();
  const [guardado, setGuardado] = useState(false);
  const [fallos, setFallos] = useState(0); // >0: la acción no llegó al servidor
  const { ocupado, enviar } = useEnvio();
  useEffect(() => {
    if (error) document.getElementById('nombre')?.focus();
  }, [error]);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setGuardado(false);
    setFallos(0);
    const envio = await enviar(() => guardarMiNombre(nombre));
    if (envio.tipo === 'ocupado') return;
    if (envio.tipo === 'fallo') {
      setFallos((n) => n + 1);
      return;
    }
    const r = envio.valor;
    if (r.error) setError(r.error);
    else setGuardado(true);
  }

  return (
    <>
      <form id="form-cuenta" onSubmit={guardar} className="pv-cuenta-form">
        <h1 className="pv-cuenta-titulo">Mi cuenta</h1>
        {fallos > 0 && <MensajeEstado key={fallos} codigo="sin-conexion" incrustado rol="alert" enfocar />}
        <CampoTexto
          id="nombre"
          etiqueta="Nombre"
          autoComplete="name"
          maxLength={MAX_NOMBRE}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setGuardado(false);
          }}
          error={error}
        />
        <CampoTexto
          id="correo"
          etiqueta="Correo"
          type="text"
          value={correo}
          readOnly
          ayuda="Para cambiar el correo, pídeselo a la Pastoral de Comunicaciones."
        />
        <div className="pv-cuenta-roles">
          <span className="pv-campo-etiqueta">Rol y parroquia asignada</span>
          <div className="pv-cuenta-chips">{chips}</div>
        </div>
      </form>
      <div className="pv-cuenta-acciones">
        <Boton type="submit" form="form-cuenta" ocupado={ocupado}>
          Guardar
        </Boton>
        {/* Un form aparte: no se puede anidar dentro del de los datos. */}
        <form action={salir}>
          <Boton variante="peligro" type="submit">
            Cerrar sesión
          </Boton>
        </form>
      </div>
      <div role="status" className="pv-cuenta-estado">
        {guardado ? 'Guardado.' : ''}
      </div>
    </>
  );
}
