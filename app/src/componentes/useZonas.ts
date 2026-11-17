// Zonas seguras (barra de estado, recorte y barra de navegación), en dp, siempre al día (Tareas 9c y 9i).
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { addZonasListener, zonasSeguras, type ZonasSeguras } from '../../modules/transmisor';
import { mismasZonas } from '../estado/zonas';

export const SIN_ZONAS: ZonasSeguras = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Las zonas de ahora. El nativo avisa cada cambio (onZonas, Tarea 9i): al girar, al pasar de gestos a
 * botones con la app abierta o cuando la barra se acomoda tarde. La lectura al cambiar la ventana, y otra
 * a los 400 ms, queda como respaldo (y es la que hace que el nativo empiece a avisar).
 */
export function useZonas(): ZonasSeguras {
  const ventana = useWindowDimensions();
  const [zonas, setZonas] = useState<ZonasSeguras>(SIN_ZONAS);
  const poner = (z: ZonasSeguras) => setZonas((v) => (mismasZonas(v, z) ? v : z));

  useEffect(() => {
    const s = addZonasListener(poner);
    return () => s.remove();
  }, []);

  useEffect(() => {
    let vigente = true;
    const leer = () =>
      zonasSeguras().then(
        (z) => {
          if (vigente) poner(z);
        },
        () => undefined,
      );
    void leer();
    const t = setTimeout(leer, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [ventana.width, ventana.height]);

  return zonas;
}
