// Registro de rendimiento (Tarea 9): una línea CSV cada 30 s mientras se transmite, para estudiar
// el calor de una misa entera sin computadora. TypeScript puro, con tests.
//
// Seguridad: la línea se arma solo con números y con valores de listas cerradas (conexión y
// escena). Ningún texto que llegue de afuera pasa a la línea, así que ni la clave ni la URL del
// servidor pueden terminar en el archivo, aunque se las pasen por error.
import type { Conexion } from '../../modules/transmisor/src/eventos';
import type { Escena, Fase } from '../estado/transmision';

/** Una muestra cada 30 s. */
export const CADA_MS = 30_000;

export type Medida = {
  hora: Date;
  /** Estado térmico del sistema (0 a 6). */
  termico: number | null;
  /** Temperatura de la batería, °C. */
  temperatura: number | null;
  /** De 0 a 1. */
  bateria: number | null;
  cargando: boolean | null;
  fpsCapa: number | null;
  fpsVideo: number | null;
  /** Memoria del proceso de la app (PSS), MB. */
  memoriaMb: number | null;
  conexion: Conexion | null;
  mbps: number | null;
  escena: Escena | null;
};

export const ENCABEZADO_REGISTRO =
  'hora,termico,temperatura_c,bateria_pct,cargando,fps_capa,fps_video,memoria_mb,conexion,mbps,escena';

const CONEXIONES: readonly string[] = ['conectado', 'reconectando', 'cortado'];
const ESCENAS: readonly string[] = ['camara', 'inicio', 'portada', 'avisos', 'gracias'];

const dos = (n: number) => String(n).padStart(2, '0');

function hora(d: unknown): string {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/** Un número con `decimales` (punto decimal), o vacío si no es un número de verdad. */
function num(x: unknown, decimales: number): string {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '';
  return x.toFixed(decimales);
}

function deLista(x: unknown, lista: readonly string[]): string {
  return typeof x === 'string' && lista.includes(x) ? x : '';
}

function siNo(x: unknown): string {
  return x === true ? 'si' : x === false ? 'no' : '';
}

/** La línea del registro (sin salto de línea), en el orden de ENCABEZADO_REGISTRO. */
export function lineaRegistro(m: Medida): string {
  const bateria = typeof m.bateria === 'number' && Number.isFinite(m.bateria) ? m.bateria * 100 : null;
  return [
    hora(m.hora),
    num(m.termico, 0),
    num(m.temperatura, 1),
    num(bateria, 0),
    siNo(m.cargando),
    num(m.fpsCapa, 1),
    num(m.fpsVideo, 1),
    num(m.memoriaMb, 0),
    deLista(m.conexion, CONEXIONES),
    num(m.mbps, 1),
    deLista(m.escena, ESCENAS),
  ].join(',');
}

/** Nombre del archivo de una transmisión: registro-AAAAMMDD-HHMMSS.csv (hora local). */
export function nombreRegistro(d: Date): string {
  return `registro-${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}.csv`;
}

export interface DepsRegistrador {
  /** La muestra de ahora (nativo, batería y estado de la pantalla). */
  medir(): Promise<Medida>;
  /** Crea el archivo nuevo con el encabezado (el nativo deja solo los últimos 10). */
  abrir(nombre: string, encabezado: string): Promise<void>;
  anotar(linea: string): Promise<void>;
  cerrar(): Promise<void>;
  ahora(): Date;
}

export interface Registrador {
  /** Al salir al aire: archivo nuevo, una muestra enseguida y después cada 30 s. */
  empezar(): void;
  /** Al dejar el aire: no anota más y cierra el archivo. */
  parar(): void;
}

/**
 * Las escrituras van en fila (abrir, anotar…, cerrar). Una falla se ignora: el registro nunca
 * puede cortar ni frenar la transmisión.
 */
export function crearRegistrador(d: DepsRegistrador, cadaMs: number = CADA_MS): Registrador {
  let activo = false;
  // Cada empezar() es una sesión nueva; lo que llegue de una sesión vieja se descarta.
  let sesion = 0;
  let abierto = false;
  let reloj: ReturnType<typeof setInterval> | null = null;
  let fila: Promise<void> = Promise.resolve();

  const encolar = (f: () => Promise<void>) => {
    fila = fila.then(f).catch(() => undefined);
  };

  return {
    empezar() {
      if (activo) return;
      activo = true;
      const mia = ++sesion;
      abierto = false;
      encolar(async () => {
        await d.abrir(nombreRegistro(d.ahora()), ENCABEZADO_REGISTRO);
        if (mia === sesion) abierto = true;
      });
      const tomar = () => {
        d.medir().then(
          (m) => {
            if (mia !== sesion) return;
            encolar(async () => {
              if (mia !== sesion || !abierto) return;
              await d.anotar(lineaRegistro(m));
            });
          },
          () => undefined,
        );
      };
      tomar();
      reloj = setInterval(tomar, cadaMs);
    },
    parar() {
      if (!activo) return;
      activo = false;
      sesion++;
      abierto = false;
      if (reloj !== null) clearInterval(reloj);
      reloj = null;
      encolar(() => d.cerrar());
    },
  };
}

/** Lo que manda el nativo en medir() (ver modules/transmisor/src/TransmisorModule.ts). */
export type MedidaDelNativo = {
  termico: number | null;
  temperatura: number | null;
  memoriaMb: number | null;
  fpsVideo: number | null;
  fpsCapa: number | null;
};

/** Lo último que sabe la pantalla de la batería y la subida. */
export type UltimoDePantalla = { bateria: number | null; cargando: boolean | null; mbps: number | null };

/**
 * Arma la muestra del registro (review M10). La conexión sale de la fase: «conectado» solo en
 * en_vivo (con los Mbps), «reconectando» sin Mbps, y vacía al conectar o al terminar.
 */
export function medidaDesde(
  estado: { fase: Fase; escena: Escena },
  n: MedidaDelNativo,
  u: UltimoDePantalla,
  ahora: Date,
): Medida {
  const conexion: Conexion | null =
    estado.fase === 'reconectando' ? 'reconectando' : estado.fase === 'en_vivo' ? 'conectado' : null;
  return {
    hora: ahora,
    termico: n.termico,
    temperatura: n.temperatura,
    bateria: u.bateria,
    cargando: u.cargando,
    fpsCapa: n.fpsCapa,
    fpsVideo: n.fpsVideo,
    memoriaMb: n.memoriaMb,
    conexion,
    mbps: conexion === 'conectado' ? u.mbps : null,
    escena: estado.escena,
  };
}

/**
 * Qué hacer con el registro en cada fase (review M2). El archivo se abre recién en en_vivo, así
 * un arranque que falla no deja un archivo vacío que tape el de la misa.
 */
export function accionRegistro(fase: Fase): 'empezar' | 'parar' | null {
  if (fase === 'en_vivo') return 'empezar';
  if (fase === 'preparando' || fase === 'terminado') return 'parar';
  return null;
}
