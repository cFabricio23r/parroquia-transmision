'use client';
// Vista previa continua (plan 3, Tarea 9): un solo iframe montado en el marco para todo el editor.
// Al cambiar de sección cambia el `src` (se recarga solo el iframe); en las secciones sin vista previa
// queda oculto con `hidden`, así no se recarga al volver. El borrador va por postMessage, nunca por la red.
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { vistaPreviaDeRuta, type VistaPreviaSeccion } from '../../../../lib/editor/secciones';
import {
  configParaVistaPrevia,
  ESPERA_VISTA_PREVIA_MS,
  mensajeVistaPrevia,
  srcVistaPrevia,
  tiposParaVistaPrevia,
  tituloMarcoVistaPrevia,
} from '../../../../lib/vista-previa';
import { CajaInfo } from '../../../componentes/CajaInfo';
import { CampoSelect } from '../../../componentes/CampoSelect';
import { versionElegida } from '../../../../lib/editor/transicion';
import { useBorrador } from './ProveedorBorrador';

/** La última vista mostrada: el iframe conserva su página mientras está oculto. */
const SIN_VISTA: VistaPreviaSeccion = { pagina: 'pantalla', vista: 'inicio', titulo: 'Vista previa', conSelectorTipo: false };

export function PanelVistaPrevia() {
  const { datos, borrador, urls, notaVistaPrevia, tipoVistaPrevia, elegirTipoVistaPrevia, vistaPreviaExtra, versionTransicion } = useBorrador();
  const pathname = usePathname() ?? '';
  const ruta = vistaPreviaDeRuta(pathname, datos.slug);
  const visible = ruta.vistaPrevia !== null;

  // Mientras está oculto se queda con la última vista, para no recargar el iframe.
  const ultimaVista = useRef<VistaPreviaSeccion>(ruta.vistaPrevia ?? SIN_VISTA);
  if (ruta.vistaPrevia) ultimaVista.current = ruta.vistaPrevia;
  // La transición se ve en la versión elegida en su sección (sin imagen del patrono, la del logo).
  const vp =
    ultimaVista.current.pagina === 'transicion'
      ? { ...ultimaVista.current, vista: versionElegida(borrador, versionTransicion) }
      : ultimaVista.current;
  const src = srcVistaPrevia(datos.slug, vp);

  const tipos = useMemo(() => tiposParaVistaPrevia(borrador, datos.tiposComunes), [borrador, datos.tiposComunes]);
  const elegido = tipoVistaPrevia && tipos.some((t) => t.clave === tipoVistaPrevia) ? tipoVistaPrevia : null;
  const tipo =
    vistaPreviaExtra?.tipo ?? (vp.conSelectorTipo ? (elegido ?? tipos[0]?.clave ?? null) : (vp.tipoFijo ?? tipos[0]?.clave ?? null));
  const claves = useMemo(() => datos.tiposComunes.map((t) => t.clave), [datos.tiposComunes]);
  const config = configParaVistaPrevia(vistaPreviaExtra?.config ?? borrador, tipo ?? undefined, claves);
  const extra = vp.estado;

  const marco = useRef<HTMLIFrameElement | null>(null);
  const cargado = useRef(false);
  // Siempre lo último, para el envío al cargar el iframe.
  const ultimo = useRef({ config, urls, tipo, extra });
  ultimo.current = { config, urls, tipo, extra };

  const enviar = useCallback(() => {
    if (!cargado.current) return;
    const { config: c, urls: u, tipo: t, extra: x } = ultimo.current;
    marco.current?.contentWindow?.postMessage(mensajeVistaPrevia(c, u, t, x), location.origin);
  }, []);

  // A 400 ms de cada cambio del borrador o del tipo elegido.
  const instantanea = JSON.stringify([config, urls, tipo, extra]);
  useEffect(() => {
    const t = setTimeout(enviar, ESPERA_VISTA_PREVIA_MS);
    return () => clearTimeout(t);
  }, [instantanea, enviar]);

  // Un cambio de `src` vuelve a cargar: hasta el próximo onLoad no se manda nada.
  useEffect(() => {
    const doc = marco.current?.contentDocument;
    cargado.current = !!doc && doc.readyState === 'complete' && doc.location.href.endsWith(src);
  }, [src]);

  return (
    <section className="pv-previa" aria-labelledby="pv-previa-titulo" hidden={!visible}>
      <div className="pv-previa-cabeza">
        <h2 id="pv-previa-titulo" className="pv-subtitulo">
          {vp.titulo}
        </h2>
        {vp.conSelectorTipo && tipos.length > 0 && (
          <div className="pv-previa-tipo">
            <CampoSelect
              id="pv-previa-tipo"
              etiqueta="Ver con el tipo"
              value={tipo ?? ''}
              onChange={(e) => elegirTipoVistaPrevia(e.target.value)}
            >
              {tipos.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.nombre}
                </option>
              ))}
            </CampoSelect>
          </div>
        )}
      </div>
      <iframe
        ref={(el) => {
          marco.current = el;
          if (el && !el.dataset.montado) el.dataset.montado = String(Date.now());
        }}
        className="pv-previa-marco"
        title={tituloMarcoVistaPrevia(vp)}
        src={src}
        onLoad={() => {
          cargado.current = true;
          enviar();
        }}
      />
      {visible && notaVistaPrevia ? <CajaInfo>{notaVistaPrevia}</CajaInfo> : null}
    </section>
  );
}
