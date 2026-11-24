'use client';
// Transición (pantallas más opciones, #3): la animación de OBS con la identidad de la parroquia. La vista
// previa la repite en la versión elegida; «Descargar transición» arma el video en el navegador con los
// cuadros de esa misma página (lo que se ve es lo que se baja) y lo baja para cargarlo en OBS como Stinger.
import { useEffect, useState } from 'react';
import {
  armarTransicion,
  DURACION_TRANSICION,
  FRECUENCIA_SONIDO,
  nombreArchivoTransicion,
  puedeArmarTransicion,
  versionElegida,
  versionesTransicion,
  type SonidoTransicion,
  type VersionTransicion,
} from '../../../../../lib/editor/transicion';
import { Boton } from '../../../../componentes/Boton';
import { Segmentado } from '../../../../componentes/Segmentado';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';

export const TEXTO_TRANSICION = 'La animación que pasa entre una escena y otra en OBS, con el logo, el nombre y los colores de la parroquia.';
export const NOTA_SIN_PATRONO = 'Sube la imagen del patrono en Patrono y fiesta para usar esta versión.';
export const NOTA_SIN_NAVEGADOR = 'Para descargarla, abre el editor en Chrome o Edge.';
export const NOTA_DESCARGAR_DE_NUEVO = 'Si cambias el logo, los colores o el nombre, vuelve a descargarla.';
const ERROR_ARMAR = 'No se pudo armar el video. Espera a que se vea la vista previa y vuelve a intentarlo.';

const OPCIONES_VERSION: { valor: VersionTransicion; texto: string }[] = [
  { valor: 'logo', texto: 'Solo el logo' },
  { valor: 'patrono', texto: 'Con la imagen del patrono' },
];

/** Lo que expone vicaria/transicion.html dentro del iframe de la vista previa. */
interface VentanaTransicion extends Window {
  transicion?: { listo: Promise<void>; cuadro(t: number): unknown };
  sonidoTransicion?: (frecuencia: number, duracion: number) => SonidoTransicion;
}

/** La ventana de la vista previa, cuando ya muestra la transición en la versión pedida. */
function ventanaDeLaVistaPrevia(version: VersionTransicion): VentanaTransicion | null {
  const marco = document.querySelector<HTMLIFrameElement>('iframe.pv-previa-marco');
  const w = marco?.contentWindow as VentanaTransicion | null | undefined;
  if (!w || !w.transicion || !w.sonidoTransicion) return null;
  if (!w.location.search.includes(`version=${version}`)) return null;
  return w;
}

function bajar(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SeccionTransicion() {
  const { datos, borrador, versionTransicion, elegirVersionTransicion } = useBorrador();
  const versiones = versionesTransicion(borrador);
  const version = versionElegida(borrador, versionTransicion);
  const conPatrono = versiones.includes('patrono');
  // null mientras se pregunta al navegador si puede armar VP9 con transparencia.
  const [puede, setPuede] = useState<boolean | null>(null);
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    puedeArmarTransicion().then((p) => vivo && setPuede(p));
    return () => {
      vivo = false;
    };
  }, []);

  const descargar = async () => {
    if (armando || !puede) return;
    setError(null);
    setArmando(true);
    try {
      const w = ventanaDeLaVistaPrevia(version);
      if (!w?.transicion || !w.sonidoTransicion) throw new Error('La vista previa no está lista.');
      await w.transicion.listo;
      const transicion = w.transicion;
      const lienzo = w.document.getElementById('lienzo') as HTMLCanvasElement | null;
      if (!lienzo) throw new Error('La vista previa no está lista.');
      const archivo = await armarTransicion(
        (t) => {
          transicion.cuadro(t);
          return lienzo;
        },
        w.sonidoTransicion(FRECUENCIA_SONIDO, DURACION_TRANSICION),
      );
      bajar(archivo, nombreArchivoTransicion(datos.slug, version));
    } catch {
      setError(ERROR_ARMAR);
    } finally {
      setArmando(false);
    }
  };

  return (
    <section className="pv-seccion-form" aria-labelledby="pv-titulo-transicion">
      <CabezaSeccion titulo={<span id="pv-titulo-transicion">Transición</span>} texto={TEXTO_TRANSICION} />
      <Segmentado
        etiqueta="Versión"
        opciones={OPCIONES_VERSION.map((o) => ({ ...o, deshabilitada: o.valor === 'patrono' && !conPatrono }))}
        valor={version}
        onCambiar={elegirVersionTransicion}
        nota={conPatrono ? undefined : NOTA_SIN_PATRONO}
      />
      <div className="pv-transicion-descarga">
        <Boton
          onClick={descargar}
          disabled={puede === false || armando || undefined}
          aria-describedby={puede === false ? 'pv-transicion-sin-navegador' : undefined}
        >
          {armando ? 'Armando el video…' : 'Descargar transición'}
        </Boton>
        {puede === false && (
          <p id="pv-transicion-sin-navegador" className="pv-campo-ayuda">
            {NOTA_SIN_NAVEGADOR}
          </p>
        )}
        {error && (
          <p className="pv-campo-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="pv-transicion-obs">
        <h2 className="pv-subtitulo">Cómo cargarla en OBS</h2>
        <ol>
          <li>En OBS, en el cuadro «Transiciones de escena», toca el botón «+» y elige «Stinger».</li>
          <li>En «Archivo de video», elige el archivo que descargaste.</li>
          <li>En «Punto de transición», escribe 1000 ms y toca «Aceptar».</li>
        </ol>
        <p className="pv-campo-ayuda">{NOTA_DESCARGAR_DE_NUEVO}</p>
      </div>
    </section>
  );
}
