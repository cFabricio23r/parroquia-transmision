// «Usar esta», «Editar» y el seguimiento de la transmisión en uso (plan 3b, Tarea 13).
//
// La app pone en el panel el tipo y los datos de un día con un script que parte de leerEstado(),
// vuelve a PREDETERMINADO lo de la transmisión, aplica lo del día, pasa por normalizarEstado y
// escribe directo en localStorage. No llama a guardarEstado: ese marca ultimoPropio y entonces
// escucharEstado del mismo panel no lo tomaría (comun.js). Lo toma en ≤ 300 ms.
//
// El seguimiento compara lo que el panel manda con el día en uso: un cambio del voluntario queda
// como Pendiente en el celular, 1,5 s después del último cambio.
import { claveEstado } from '../puente/puente';
import type { Pendiente } from './almacen';
import { SEMANA, type TipoCampos } from './nucleo';
import type { ItemApp } from './pendientes';

export type ParchePanel = { limpiar: readonly string[]; poner: Record<string, unknown> };

const RE_TIPO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Lo que entra al estado del panel: solo las claves de campo, el tipo y el día.
function parcheLimpio(parche: ParchePanel): { limpiar: string[]; poner: Record<string, unknown> } {
  const permitidas = new Set(SEMANA.CLAVES_DE_TRANSMISION);
  const limpiar = (parche.limpiar ?? []).filter((c) => typeof c === 'string' && permitidas.has(c));
  const poner: Record<string, unknown> = { ...SEMANA.limpiarDatos(parche.poner) };
  delete poner.dia;
  const { tipo, prenovenaDia, novenaDia } = parche.poner ?? {};
  if (typeof tipo === 'string' && RE_TIPO.test(tipo)) poner.tipo = tipo;
  if (Number.isInteger(prenovenaDia) && (prenovenaDia as number) >= 1 && (prenovenaDia as number) <= 60) {
    poner.prenovenaDia = prenovenaDia;
  }
  if (Number.isInteger(novenaDia) && (novenaDia as number) >= 1 && (novenaDia as number) <= 60) {
    poner.novenaDia = novenaDia;
  }
  return { limpiar, poner };
}

function armar(slug: string, parche: ParchePanel, despues: string): string {
  const clave = JSON.stringify(claveEstado(slug));
  const p = JSON.stringify(parcheLimpio(parche));
  return (
    '(function(p){try{var b=leerEstado();p.limpiar.forEach(function(c){' +
    'if(Object.prototype.hasOwnProperty.call(PREDETERMINADO,c))b[c]=JSON.parse(JSON.stringify(PREDETERMINADO[c]));else delete b[c];});' +
    'Object.assign(b,p.poner);var s=normalizarEstado(b);s.rotulo=\'ninguno\';s.rotuloHasta=0;' +
    'localStorage.setItem(' + clave + ',JSON.stringify(s));' + despues + '}catch(e){}})(' + p + ');true;'
  );
}

/** El script que «Usar esta» inyecta en el panel. Lanza con un slug inválido. */
export function scriptUsar(slug: string, parche: ParchePanel): string {
  return armar(slug, parche, '');
}

/** «Usar esta» y, 450 ms después, ir a Preparar y al primer campo que falta. */
export function scriptEditar(slug: string, parche: ParchePanel): string {
  const ir =
    'setTimeout(function(){try{var t=document.getElementById(\'tab-preparar\');if(t)t.click();' +
    'var e=document.getElementById(\'elegir\'),c=document.getElementById(\'continuar\');' +
    'if(e&&c&&!e.hidden)c.click();var a=document.querySelector(\'#revision a\');if(a)a.click();}catch(x){}},450);';
  return armar(slug, parche, ir);
}

export interface Seguimiento {
  usar(item: ItemApp, tipo: TipoCampos): void;
  soltar(): void;
  alEstado(json: string): void;
  enUso(): string | null;
}

// Texto estable de unos datos (las claves en orden), para comparar.
function firma(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(firma).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + firma(o[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

export function crearSeguimiento(d: {
  guardar(p: Pendiente): Promise<void>;
  ahora?: () => Date;
  esperaMs?: number;
  plazoAplicarMs?: number;
}): Seguimiento {
  const esperaMs = d.esperaMs ?? 1500;
  const plazoAplicarMs = d.plazoAplicarMs ?? 3000;
  const ahora = d.ahora ?? (() => new Date());

  let item: ItemApp | null = null;
  let tipo: TipoCampos | null = null;
  let esperado = '';
  let ultimo = '';
  let aplicado = false;
  let plazo: ReturnType<typeof setTimeout> | null = null;
  let espera: ReturnType<typeof setTimeout> | null = null;

  function limpiarTemporizadores() {
    if (plazo !== null) clearTimeout(plazo);
    if (espera !== null) clearTimeout(espera);
    plazo = null;
    espera = null;
  }

  function soltar() {
    limpiarTemporizadores();
    item = null;
    tipo = null;
    aplicado = false;
  }

  function programarGuardado(datos: Record<string, unknown>) {
    if (espera !== null) clearTimeout(espera);
    const it = item;
    espera = setTimeout(() => {
      espera = null;
      if (!it || item !== it) return;
      const p: Pendiente = {
        clave: it.clave,
        fecha: it.fecha,
        hora: it.hora,
        tipo: it.tipo,
        origen: it.origen,
        fijaId: it.fijaId,
        serieId: it.serieId,
        datos,
        editadoEn: ahora().toISOString(),
        rechazado: false,
      };
      d.guardar(p).catch(() => console.warn('semana: no se pudo guardar el cambio'));
    }, esperaMs);
  }

  return {
    usar(nuevo, t) {
      soltar();
      item = nuevo;
      tipo = t;
      // Lo que el panel va a tener: el estado con el parche, leído con los mismos campos.
      const { poner } = SEMANA.parcheDePanel(nuevo, t);
      esperado = firma(SEMANA.datosDeEstado(poner, t));
      ultimo = esperado;
      plazo = setTimeout(() => {
        plazo = null;
        if (!aplicado) soltar();
      }, plazoAplicarMs);
    },

    soltar,

    alEstado(json) {
      if (!item || !tipo) return;
      let estado: unknown;
      try {
        estado = JSON.parse(json);
      } catch {
        return;
      }
      if (!estado || typeof estado !== 'object') return;
      const e = estado as Record<string, unknown>;
      const datos = SEMANA.datosDeEstado(e, tipo);
      if (!aplicado) {
        // Hasta que llega el estado nuevo, el viejo no suelta ni se guarda (Review Focus 2).
        if (e.tipo === item.tipo && firma(datos) === esperado) {
          aplicado = true;
          if (plazo !== null) clearTimeout(plazo);
          plazo = null;
        }
        return;
      }
      if (e.tipo !== item.tipo) {
        soltar();
        return;
      }
      const f = firma(datos);
      if (f === ultimo) return;
      ultimo = f;
      programarGuardado(datos);
    },

    enUso() {
      return item ? item.clave : null;
    },
  };
}
