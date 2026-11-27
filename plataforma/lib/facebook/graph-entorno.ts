// De dónde sale el cliente de Graph de una ruta. Sin dependencias de Next.
//  - En producción, siempre el real (crearGraph). Si faltan sus variables, un cliente que falla todo:
//    guardar las páginas no depende de Facebook (las extras quedan «falta»), pero no se cae.
//  - En desarrollo y en las pruebas de navegador, `FACEBOOK_GRAPH_FALSO=1` pone un Graph falso que no
//    sale a internet. Jamás se activa con NODE_ENV=production.
import { crearGraph, type GraphFacebook, type ResultadoGraph } from './graph';

const FALLA: ResultadoGraph<never> = { ok: false, error: { tipo: 'otro' } };

/** Un Graph que falla todo: lo que se usa si el real no se puede armar. */
export function graphSinConfigurar(): GraphFacebook {
  const falla = async () => FALLA;
  return {
    cambiarCodigo: falla,
    alargar: falla,
    yo: falla,
    paginas: falla,
    crearVivo: falla,
    activarCrosspost: falla,
    crosspostHechos: falla,
    estadoVivo: falla,
    urlDeVivo: falla,
    terminarVivo: falla,
    handshake: falla,
    permiteLive: falla,
  };
}

/**
 * Graph falso de pruebas de navegador. El handshake siempre sale bien; `permiteLive` dice que sí salvo
 * para los page_id que contienen «-falta» (así la prueba puede ver «Falta permitir que comparta»).
 */
export function graphFalso(): GraphFacebook {
  return {
    ...graphSinConfigurar(),
    handshake: async () => ({ ok: true, valor: undefined }),
    permiteLive: async (_origen, destinoId) => ({ ok: true, valor: !destinoId.includes('-falta') }),
  };
}

export function graphDeEntorno(entorno: Record<string, string | undefined> = process.env): GraphFacebook {
  if (entorno.FACEBOOK_GRAPH_FALSO === '1' && entorno.NODE_ENV !== 'production') return graphFalso();
  try {
    return crearGraph({ appId: entorno.FACEBOOK_APP_ID ?? '', secreto: entorno.FACEBOOK_APP_SECRETO ?? '' });
  } catch {
    return graphSinConfigurar();
  }
}
