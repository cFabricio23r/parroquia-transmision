'use client';
// Salir de una sección con un formulario sin guardar (ronda final del editor). El guardado automático
// sigue al cambiar de sección (Decisión 26), pero formularios como «Editar aviso» no se guardan solos:
// si uno está sin guardar, seguir un enlace del editor (el menú, las migas, «Inicio») pregunta antes,
// con el mismo diálogo que al elegir otro aviso. Cerrar la pestaña o recargar lo cubre `beforeunload`.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Boton } from '../../../componentes/Boton';
import { Dialogo } from '../../../componentes/Dialogo';
import { useBorrador, type SalidaProtegida } from './ProveedorBorrador';

/** El destino de un clic en un enlace que cambia de página dentro del sitio, o `null` si no lo es. */
export function destinoDeClic(e: MouseEvent, actual: Location): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const url = new URL(a.href, actual.href);
  if (url.origin !== actual.origin) return null;
  if (url.pathname === actual.pathname && url.search === actual.search) return null;
  return url.pathname + url.search + url.hash;
}

export function GuardiaSalida() {
  const { salidaProtegida } = useBorrador();
  const router = useRouter();
  const [pendiente, setPendiente] = useState<{ destino: string; salida: SalidaProtegida } | null>(null);
  const leer = salidaProtegida;

  useEffect(() => {
    // En captura y sobre `window`: llega antes que el clic de <Link>, que así no navega.
    const alClic = (e: MouseEvent) => {
      const salida = leer();
      if (!salida) return;
      const destino = destinoDeClic(e, window.location);
      if (!destino) return;
      e.preventDefault();
      e.stopPropagation();
      setPendiente({ destino, salida });
    };
    window.addEventListener('click', alClic, true);
    return () => window.removeEventListener('click', alClic, true);
    // `salidaProtegida` lee una referencia del proveedor: hace siempre lo mismo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seguir = (accion: 'guardar' | 'descartar') => {
    if (!pendiente) return;
    const { destino, salida } = pendiente;
    // La sección puede haber cambiado desde el clic: se usa la salida de ahora si sigue puesta.
    const s = leer() ?? salida;
    setPendiente(null);
    if (accion === 'guardar') {
      if (!s.guardar()) return; // con errores se queda, y los errores se ven en el formulario
    } else s.descartar();
    router.push(destino);
  };

  return (
    <Dialogo abierto={pendiente !== null} titulo="Cambios sin guardar" onCerrar={() => setPendiente(null)}>
      <p className="pv-dialogo-texto">{pendiente?.salida.texto}</p>
      <div className="pv-dialogo-acciones">
        <Boton variante="secundario" onClick={() => setPendiente(null)}>
          Seguir editando
        </Boton>
        <Boton variante="secundario" onClick={() => seguir('descartar')}>
          Descartar cambios
        </Boton>
        <Boton onClick={() => seguir('guardar')}>{pendiente?.salida.etiquetaGuardar ?? 'Guardar'}</Boton>
      </div>
    </Dialogo>
  );
}
