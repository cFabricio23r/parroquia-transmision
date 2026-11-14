'use client';
import { useState, type FormEvent } from 'react';
import type { Campo } from '../../../lib/admin';
import { sugerirSlug } from '../../../lib/admin-textos';
import { Boton } from '../../componentes/Boton';
import { CampoTexto } from '../../componentes/CampoTexto';
import { Dialogo } from '../../componentes/Dialogo';
import { useEnvio } from '../../componentes/useEnvio';
import { crearParroquia } from './acciones';

export const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Intenta de nuevo en un momento';

/**
 * «Nueva parroquia» (Decisión 10 del plan 5): nombre, link sugerido mientras no se toque, y lugar. Al
 * crearla se cierra y avisa a quien lo abrió con `alCrear` (la tabla se refresca y anuncia).
 */
export function DialogoNuevaParroquia({
  abierto,
  onCerrar,
  alCrear,
}: {
  abierto: boolean;
  onCerrar: () => void;
  alCrear: (nombre: string, slug: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [lugar, setLugar] = useState('');
  // Error general (sin campo) y los de cada campo; escribir en un campo borra el suyo (ronda 2).
  const [error, setError] = useState<string>();
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const limpiar = (c: Campo) => setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));
  const { ocupado, enviar } = useEnvio();

  function cerrar() {
    setNombre('');
    setSlug('');
    setSlugTocado(false);
    setLugar('');
    setError(undefined);
    setErrores({});
    onCerrar();
  }

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await enviar(() => crearParroquia(nombre, slug, lugar));
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') {
      setErrores({});
      return setError(MENSAJE_SIN_CONEXION);
    }
    if (r.valor.error) {
      const porCampo = r.valor.errores ?? (r.valor.campo ? { [r.valor.campo]: r.valor.error } : {});
      setErrores(porCampo);
      return setError(r.valor.campo ? undefined : r.valor.error);
    }
    const creado = r.valor.slug ?? slug;
    const nombreCreado = nombre.trim();
    cerrar();
    alCrear(nombreCreado, creado);
  }

  const errorDe = (c: Campo) => errores[c];
  return (
    <Dialogo abierto={abierto} titulo="Nueva parroquia" onCerrar={cerrar}>
      <form className="pv-admin-formulario" onSubmit={crear} noValidate>
        {error && (
          <p role="alert" className="pv-alerta">
            {error}
          </p>
        )}
        <CampoTexto
          id="nueva-nombre"
          etiqueta="Nombre de la parroquia"
          value={nombre}
          error={errorDe('nombre')}
          autoComplete="off"
          onChange={(e) => {
            setNombre(e.target.value);
            limpiar('nombre');
            if (!slugTocado) {
              setSlug(sugerirSlug(e.target.value));
              limpiar('slug');
            }
          }}
        />
        <CampoTexto
          id="nueva-slug"
          etiqueta="Link"
          value={slug}
          error={errorDe('slug')}
          autoComplete="off"
          spellCheck={false}
          ayuda={`Va en la dirección: …/${slug || 'tu-link'}/pantalla.html. No se puede cambiar después.`}
          onChange={(e) => {
            setSlugTocado(true);
            setSlug(e.target.value);
            limpiar('slug');
          }}
        />
        <CampoTexto
          id="nueva-lugar"
          etiqueta="Lugar"
          value={lugar}
          error={errorDe('lugar')}
          maxLength={200}
          ayuda="Por ejemplo: Ciudad Arce, La Libertad."
          onChange={(e) => {
            setLugar(e.target.value);
            limpiar('lugar');
          }}
        />
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" ocupado={ocupado}>
            Crear parroquia
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
