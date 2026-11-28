// Estado de cada sección del editor (spec, sección 8): punto del menú, tarjeta del Resumen, errores
// que bloquean publicar y avisos en ámbar. Puro: corre en el cliente con la lista de errores que manda
// el servidor (validarBorrador) más lo que el cliente puede calcular (fechas, contraste).
import type { Estado } from '../../app/componentes/PuntoEstado';
import { contraste, MIN_CONTRASTE } from '../contraste';
import { MESES } from '../fecha';
import { bloqueDeError, limpiarMensaje } from './errores';
import { avisoImagenPatrono } from './pantallas';
import { disenoDe, nombreDiseno, nombreTipografia } from './rotulos';
import { filasActivas } from './tipos';
import { SECCIONES, usaBorrador, type IdSeccion, type IdSeccionBorrador } from './secciones';

export interface Problema {
  titulo: string;
  detalle: string;
  seccion: IdSeccion;
}

export interface EstadoSeccion {
  estado: Estado;
  frase: string;
  errores: Problema[];
  avisos: Problema[];
}

/** Los 11 tipos comunes, en el orden de vicaria/tipos.js (ORDEN_TIPOS); una prueba los compara. */
export const CLAVES_TIPOS_COMUNES = [
  'dominical',
  'semana',
  'horasanta',
  'sector',
  'patronalsector',
  'procesion',
  'otros',
  'prenovena',
  'novena',
  'patronal',
  'evento',
] as const;

/** Las 8 pantallas que cuenta el Resumen (sin Horarios, que es una vista interna). */
export const VISTAS_RESUMEN = ['inicio', 'portada', 'evento', 'avisos', 'comunion', 'gracias', 'produccion', 'envivo'] as const;

export const NOMBRES_REDES: Record<string, string> = {
  facebook: 'Facebook',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  web: 'Sitio web',
  instagram: 'Instagram',
};

const ESQUINAS: Record<string, string> = { rectas: 'rectas', suaves: 'suaves', redondas: 'redondas', redondeadas: 'suaves' };
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const MENSAJE_SIN_ALT = 'Sin la descripción (alt) no se puede publicar.';

type Config = Record<string, unknown>;
const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** «a», «a y b», «a, b y c». */
export function unirLista(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Nombre de una imagen de la galería para los mensajes: su nombre, su alt o «La imagen N». */
function nombreImagen(galeria: unknown[], i: number): string {
  const im = galeria[i];
  if (esObjeto(im)) {
    if (texto(im.nombre)) return texto(im.nombre);
    if (texto(im.alt)) return texto(im.alt);
  }
  return `La imagen ${i + 1}`;
}

function problemaDeError(m: string, borrador: Config, seccion: IdSeccion): Problema {
  const alt = /^Falta la descripción de la imagen \(galeria\[(\d+)\]\.alt\)/.exec(m);
  if (alt) {
    return { titulo: `${nombreImagen(lista(borrador.galeria), Number(alt[1]))} no tiene descripción`, detalle: MENSAJE_SIN_ALT, seccion };
  }
  return { titulo: limpiarMensaje(m), detalle: '', seccion };
}

/**
 * Avisos de las pantallas personalizadas (plan 4, Decisión 2): «Siempre la misma» con el patrono
 * sin imagen. Con `vista`, solo los de esa pantalla (F5 los muestra en su caja ámbar).
 */
export function avisosDePantallas(borrador: Config, vista?: string): Problema[] {
  return avisoImagenPatrono(borrador)
    .filter((a) => vista === undefined || a.vista === vista)
    .map(({ nombre }) => ({
      titulo: `La pantalla de ${nombre} usa la imagen del patrono, pero no hay una`,
      detalle: 'Súbela en Patrono y fiesta o elige otra imagen.',
      seccion: 'pantallas' as const,
    }));
}

function colorResuelto(valor: unknown, colores: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (valor === 'blanco') return '#ffffff';
  if (RE_HEX.test(valor)) return valor;
  if (esObjeto(colores) && ['principal', 'oscuro', 'acento'].includes(valor)) {
    const hex = colores[valor];
    return typeof hex === 'string' && RE_HEX.test(hex) ? hex : null;
  }
  return null;
}

function avisosDeRotulos(borrador: Config): Problema[] {
  const r = borrador.rotulos;
  if (!esObjeto(r)) return [];
  // El «Fondo del rótulo» solo lleva texto encima en Clásico y Etiqueta (Minimal no lo usa; en Tarjeta es un punto).
  const diseno = disenoDe(r);
  if (diseno === 'minimal' || diseno === 'tarjeta') return [];
  const hex = colorResuelto(r.colorLado, borrador.colores);
  if (!hex) return [];
  if (Math.max(contraste(hex, '#ffffff'), contraste(hex, '#14223a')) >= MIN_CONTRASTE) return [];
  return r.colorLado === 'acento'
    ? [
        {
          titulo: 'El acento como fondo de rótulo tiene poco contraste',
          detalle:
            diseno === 'etiqueta'
              ? 'Se puede publicar; el texto de la caja se pone oscuro, pero puede costar leerse.'
              : 'Se puede publicar, pero conviene usarlo solo como línea.',
          seccion: 'rotulos',
        },
      ]
    : [{ titulo: 'El color del rótulo tiene poco contraste', detalle: 'Se puede publicar, pero el texto puede costar leerse.', seccion: 'rotulos' }];
}

const activo = (a: unknown) => esObjeto(a) && a.activo !== false;
const vencidoAviso = (a: unknown, hoy: string) => esObjeto(a) && typeof a.hasta === 'string' && a.hasta < hoy;
/** Todavía no empieza: `desde` es inclusivo, como en vicaria/pantallas.js (_vigente). */
const futuroAviso = (a: unknown, hoy: string) => esObjeto(a) && typeof a.desde === 'string' && a.desde > hoy;

function avisosDeAvisos(borrador: Config, hoy: string): Problema[] {
  return lista(borrador.avisos)
    .filter((a) => activo(a) && vencidoAviso(a, hoy))
    .map((a) => ({
      titulo: `El aviso «${texto((a as Config).texto)}» ya terminó`,
      detalle: 'Ya no sale en la pantalla. Puedes borrarlo o cambiarle las fechas.',
      seccion: 'avisos' as const,
    }));
}

function fraseLista(borrador: Config, id: IdSeccion): string {
  switch (id) {
    case 'identidad':
      return 'Nombre, logos, colores y fachada.';
    case 'patrono': {
      const p = esObjeto(borrador.patrono) ? borrador.patrono : {};
      const f = esObjeto(borrador.fiesta) ? borrador.fiesta : {};
      const quien = texto(p.corto) || texto(p.nombre);
      const mes = typeof f.mes === 'number' ? MESES[f.mes - 1] : undefined;
      const fecha = typeof f.dia === 'number' && mes ? `${f.dia} de ${mes}` : '';
      return `${[quien, fecha].filter(Boolean).join(' · ')} · ${texto(f.lema) ? 'con lema' : 'sin lema'}.`;
    }
    case 'pantallas': {
      const pa = esObjeto(borrador.pantallas) ? borrador.pantallas : {};
      const k = VISTAS_RESUMEN.filter((v) => esObjeto(pa[v]) && (pa[v] as Config).modo === 'personalizada').length;
      const n = VISTAS_RESUMEN.length;
      if (k === 0) return `Las ${n}, como vienen.`;
      if (k === n) return `Las ${n} personalizadas.`;
      return `${k} de ${n} personalizadas; el resto, como vienen.`;
    }
    case 'rotulos': {
      const r = esObjeto(borrador.rotulos) ? borrador.rotulos : {};
      const tipo = nombreTipografia(r.tipografia);
      const esquinas = ESQUINAS[String(r.esquinas)] ?? 'suaves';
      const diseno = disenoDe(r);
      if (diseno === 'clasico') return `Tipografía ${tipo}, esquinas ${esquinas}.`;
      if (diseno === 'minimal') return `Diseño Minimal, tipografía ${tipo}.`;
      return `Diseño ${nombreDiseno(diseno)}, tipografía ${tipo}, esquinas ${esquinas}.`;
    }
    case 'tipos': {
      // Plan 4, Decisión 16: cuenta filas de la tabla (el grupo de la novena es una), más los propios.
      const t = esObjeto(borrador.tipos) ? borrador.tipos : {};
      const propios = lista(t.propios).length;
      const n = filasActivas(t);
      const m = propios === 0 ? 'sin propios' : plural(propios, 'propio', 'propios');
      return `${n} activos, ${m}.`;
    }
    case 'galeria': {
      const n = lista(borrador.galeria).length;
      return n === 0 ? 'Sin imágenes todavía.' : `${plural(n, 'imagen', 'imágenes')}.`;
    }
    case 'horarios-y-redes': {
      const h = lista(borrador.horarios).length;
      const redes = lista(borrador.redes)
        .map((r) => (esObjeto(r) ? NOMBRES_REDES[String(r.red)] : undefined))
        .filter((x): x is string => !!x);
      const partes = [h ? plural(h, 'horario', 'horarios') : '', redes.length ? unirLista(redes) : ''].filter(Boolean);
      return partes.length ? `${partes.join(', ')}.` : 'Sin horarios ni redes todavía.';
    }
    case 'avisos': {
      const l = lista(borrador.avisos);
      if (l.length === 0) return 'Sin avisos todavía.';
      return '';
    }
    default:
      return '';
  }
}

function fraseAvisos(borrador: Config, hoy: string): string {
  const l = lista(borrador.avisos);
  if (l.length === 0) return 'Sin avisos todavía.';
  // Solo los que salen hoy en la pantalla: encendidos, ya empezados y sin terminar.
  const k = l.filter((a) => activo(a) && !vencidoAviso(a, hoy) && !futuroAviso(a, hoy)).length;
  return `${plural(l.length, 'aviso fijo', 'avisos fijos')}; ${k} ${k === 1 ? 'se muestra' : 'se muestran'}.`;
}

function vacia(borrador: Config, id: IdSeccion): boolean {
  if (id === 'avisos') return lista(borrador.avisos).length === 0;
  if (id === 'galeria') return lista(borrador.galeria).length === 0;
  if (id === 'horarios-y-redes') return lista(borrador.horarios).length === 0 && lista(borrador.redes).length === 0;
  return false;
}

export function estadoDeSeccion(borrador: Config, id: IdSeccion, errores: string[], hoy: string): EstadoSeccion {
  if (id === 'resumen' || id === 'publicar') return { estado: 'listo', frase: '', errores: [], avisos: [] };
  const sec = SECCIONES.find((s) => s.id === id);
  const bloques = (sec?.bloques ?? []) as string[];
  const propios = errores.filter((m) => {
    const b = bloqueDeError(m);
    return b !== null && bloques.includes(b);
  });
  const problemas = propios.map((m) => problemaDeError(m, borrador, id));
  const avisos =
    id === 'avisos' ? avisosDeAvisos(borrador, hoy) : id === 'rotulos' ? avisosDeRotulos(borrador) : id === 'pantallas' ? avisosDePantallas(borrador) : [];

  if (problemas.length) {
    let frase = `${limpiarMensaje(propios[0])}`;
    if (id === 'galeria') {
      const sinAlt = lista(borrador.galeria).filter((im) => !esObjeto(im) || !texto(im.alt)).length;
      if (sinAlt > 0) frase = `${plural(sinAlt, 'imagen', 'imágenes')} sin descripción (alt).`;
    }
    return { estado: 'falta', frase, errores: problemas, avisos };
  }
  if (avisos.length) return { estado: 'revisar', frase: `${avisos[0].titulo}.`, errores: [], avisos };
  const frase = id === 'avisos' ? fraseAvisos(borrador, hoy) : fraseLista(borrador, id);
  return { estado: vacia(borrador, id) ? 'opcional' : 'listo', frase, errores: [], avisos: [] };
}

export function estadosDelEditor(
  borrador: Config,
  errores: string[],
  hoy: string,
): Record<IdSeccionBorrador, EstadoSeccion> {
  const salida = {} as Record<IdSeccionBorrador, EstadoSeccion>;
  for (const s of SECCIONES) {
    if (!usaBorrador(s.id)) continue;
    salida[s.id] = estadoDeSeccion(borrador, s.id, errores, hoy);
  }
  return salida;
}
