'use client';
// Aviso del guardado automático en la sección (plan 3, Tarea 10): sesión cerrada, sin conexión,
// conflicto con otra persona, rechazo por forma y error. El estado normal («Guardando…», «Guardado»)
// vive en el encabezado; aquí solo aparece lo que pide hacer algo. Lo escrito nunca se pierde.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { limpiarMensaje } from '../../../../lib/editor/errores';
import { unirLista } from '../../../../lib/editor/estados';
import { MENSAJE_FALLO_GUARDADO } from '../../../../lib/editor/guardado';
import { seccion, seccionDeBloque, seccionDeRuta, type Bloque, type IdSeccion } from '../../../../lib/editor/secciones';
import { Boton } from '../../../componentes/Boton';
import { MensajeEstado } from '../../../componentes/MensajeEstado';
import { useBorrador } from './ProveedorBorrador';

export const TEXTO_RECHAZADO = 'No se pudo guardar: hay datos que no tienen la forma correcta.';
export const NOTA_SESION = 'Entra en la otra pestaña y vuelve: lo que escribiste sigue aquí y se guarda en el siguiente cambio.';

/** Decisión 8: «esta sección» si la actual tiene un bloque en conflicto; si no, el nombre de las secciones. */
export function textoConflicto(conflictos: Bloque[], actual: IdSeccion): string {
  const secciones = [...new Set(conflictos.map(seccionDeBloque))];
  if (secciones.includes(actual)) return 'Otra persona cambió esta sección mientras editabas.';
  return `Otra persona cambió ${unirLista(secciones.map((s) => seccion(s).texto))} mientras editabas.`;
}

/** Quien está escribiendo no pierde el foco cuando aparece un aviso. */
function escribiendo(): boolean {
  const e = document.activeElement as HTMLElement | null;
  if (!e) return false;
  if (e.isContentEditable || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT') return true;
  if (e.tagName !== 'INPUT') return false;
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'color', 'range'].includes((e as HTMLInputElement).type);
}

export function AvisoGuardado() {
  const { datos, guardado, usarLoMio, verLoSuyo, guardarYa } = useBorrador();
  const pathname = usePathname() ?? '';
  const actual = seccionDeRuta(pathname, datos.slug);
  const caja = useRef<HTMLDivElement>(null);
  const estado = guardado.estado;
  const visible = ['sesion-cerrada', 'sin-conexion', 'conflicto', 'rechazado', 'error'].includes(estado);

  // Al aparecer (o cambiar de clase) recibe el foco, salvo que la persona esté escribiendo.
  useEffect(() => {
    if (!visible || escribiendo()) return;
    caja.current?.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
  }, [visible, estado]);

  if (!visible) return null;

  let contenido;
  if (estado === 'sesion-cerrada') {
    contenido = (
      <MensajeEstado
        codigo="sesion-cerrada"
        rol="alert"
        accion={
          <>
            <Boton variante="secundario" href="/editor/entrar" target="_blank">
              Entrar de nuevo
            </Boton>
            <p className="pv-aviso-guardado-nota">{NOTA_SESION}</p>
          </>
        }
      />
    );
  } else if (estado === 'sin-conexion') {
    contenido = (
      <MensajeEstado
        codigo="sin-conexion"
        rol="alert"
        accion={
          <Boton variante="secundario" onClick={() => void guardarYa()}>
            Reintentar
          </Boton>
        }
      />
    );
  } else if (estado === 'conflicto') {
    contenido = (
      <div className="pv-conflicto" role="alert" tabIndex={-1}>
        <p className="pv-conflicto-titulo">{textoConflicto(guardado.conflictos, actual.id === 'publicar' ? 'resumen' : actual.id)}</p>
        <div className="pv-conflicto-acciones">
          <Boton variante="primario" compacto onClick={usarLoMio}>
            Usar lo mío
          </Boton>
          <Boton variante="secundario" compacto onClick={verLoSuyo}>
            Ver lo suyo
          </Boton>
        </div>
      </div>
    );
  } else if (estado === 'rechazado') {
    contenido = (
      <div className="pv-alerta" role="alert" tabIndex={-1}>
        <p className="pv-alerta-titulo">{TEXTO_RECHAZADO}</p>
        {guardado.erroresForma.length > 0 && (
          <ul className="pv-alerta-lista">
            {guardado.erroresForma.map((e) => (
              <li key={e}>{limpiarMensaje(e)}</li>
            ))}
          </ul>
        )}
      </div>
    );
  } else {
    contenido = (
      <div className="pv-alerta" role="alert" tabIndex={-1}>
        {guardado.mensaje ?? MENSAJE_FALLO_GUARDADO}
      </div>
    );
  }

  return (
    <div className="pv-aviso-guardado" ref={caja}>
      {contenido}
    </div>
  );
}
