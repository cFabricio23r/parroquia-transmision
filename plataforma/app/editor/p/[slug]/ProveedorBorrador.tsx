'use client';
// Contexto del borrador para todas las secciones del editor. Vive en el layout: no se desmonta al
// navegar entre secciones, así el temporizador del guardado (800 ms) y la vista previa siguen.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cambiosEntre, type CambiosSeccion } from '../../../../lib/editor/cambios';
import { estadosDelEditor, type EstadoSeccion } from '../../../../lib/editor/estados';
import {
  crearGuardador,
  type EstadoGuardado,
  type Guardador,
  type InstantaneaGuardado,
  type RespuestaHttp,
} from '../../../../lib/editor/guardado';
import type { Bloque, IdSeccion } from '../../../../lib/editor/secciones';
import { hoyIso } from '../../../../lib/fecha';
import type { TipoComun } from '../../../../lib/validar-nucleo.mjs';

/** Una fila de «Versiones publicadas» (F12). Fecha y autor ya armados en el servidor: así no hay diferencias al hidratar. */
export interface VersionPublicada {
  numero: number;
  /** `cuandoVersion(publicada_en)`: «hoy 18:42», «ayer 20:05», «2 nov». */
  fecha: string;
  /** `autorDeVersion(…)`: «Pastoral (admin)», el nombre o el correo, o «—». */
  quien: string;
  origen: number | null;
}

export interface DatosEditor {
  slug: string;
  parroquiaId: string;
  nombreParroquia: string;
  config: Record<string, unknown>;
  actualizadoEn: string;
  errores: string[];
  urls: Record<string, string>;
  publicada: { numero: number; config: Record<string, unknown>; urls: Record<string, string> } | null;
  versiones: VersionPublicada[];
  /** El número que va a tener la próxima publicación (Review Focus 5 del plan 5). */
  siguienteVersion: number;
  /** La parroquia está desactivada: no se puede publicar (Decisión 3 del plan 5). */
  desactivada: boolean;
  tiposComunes: TipoComun[];
  usuario: { etiqueta: string; inicial: string };
}

export interface ContextoBorrador {
  datos: DatosEditor;
  borrador: Record<string, unknown>;
  guardado: InstantaneaGuardado;
  estados: Record<Exclude<IdSeccion, 'publicar'>, EstadoSeccion>;
  cambios: CambiosSeccion[];
  cambiar(b: Bloque, v: unknown): void;
  cambiarVarios(c: Partial<Record<Bloque, unknown>>): void;
  guardarYa(): Promise<EstadoGuardado>;
  /** La foto del guardado en este momento (después de un `await guardarYa()`, la de ahora y no la del render). */
  guardadoAhora(): InstantaneaGuardado;
  usarLoMio(): void;
  verLoSuyo(): void;
  urls: Record<string, string>;
  agregarUrl(src: string, url: string): void;
  /** Nota debajo de la vista previa (Decisión 19): la pone cada sección. */
  notaVistaPrevia: ReactNode;
  ponerNotaVistaPrevia(n: ReactNode): void;
  /** Tipo elegido en «Ver con el tipo»: persiste entre secciones. */
  tipoVistaPrevia: string | null;
  elegirTipoVistaPrevia(t: string): void;
  /**
   * Formularios que todavía no entraron al borrador (por ejemplo «Editar aviso»): lo escrito se
   * recuerda aquí al cambiar de sección, y mientras esté sin guardar el encabezado dice «Sin guardar»
   * y cerrar la pestaña pide confirmación. `undefined` lo olvida.
   */
  formularios: Record<string, FormularioPendiente>;
  recordarFormulario(clave: string, f: FormularioPendiente | undefined): void;
  /**
   * Un borrador y un tipo propios de la página para la vista previa (plan 4, Decisión 24): F8 muestra
   * el tipo que se está escribiendo antes de «Guardar tipo». `null` vuelve al borrador.
   */
  vistaPreviaExtra: VistaPreviaExtra | null;
  ponerVistaPreviaExtra(v: VistaPreviaExtra | null): void;
  /**
   * Un formulario montado con lo escrito sin guardar y con su propio botón de guardar (por ejemplo
   * «Guardar aviso»): mientras esté puesto, seguir un enlace del editor pregunta antes de salir
   * (`GuardiaSalida`). `null` lo quita. No vuelve a dibujar nada: se guarda en una referencia.
   */
  protegerSalida(clave: string, s: SalidaProtegida | null): void;
  salidaProtegida(): SalidaProtegida | null;
}

export interface SalidaProtegida {
  /** El texto del diálogo «Cambios sin guardar». */
  texto: string;
  /** El botón que guarda, como el de la sección: «Guardar aviso». */
  etiquetaGuardar: string;
  /** Guarda; `false` si el formulario tiene errores (entonces no se sale). */
  guardar(): boolean;
  descartar(): void;
}

export interface VistaPreviaExtra {
  config?: Record<string, unknown>;
  tipo?: string;
}

export interface FormularioPendiente {
  valor: unknown;
  sucio: boolean;
}

const Contexto = createContext<ContextoBorrador | null>(null);

export function useBorrador(): ContextoBorrador {
  const c = useContext(Contexto);
  if (!c) throw new Error('useBorrador fuera de ProveedorBorrador');
  return c;
}

async function aRespuesta(r: Response): Promise<RespuestaHttp> {
  let cuerpo: unknown = {};
  try {
    cuerpo = await r.json();
  } catch {
    // sin cuerpo JSON: la máquina usa el mensaje genérico
  }
  return { estado: r.status, cuerpo };
}

export function ProveedorBorrador({ datos, children }: { datos: DatosEditor; children: ReactNode }) {
  const guardador = useRef<Guardador | null>(null);
  const [guardado, setGuardado] = useState<InstantaneaGuardado | null>(null);
  if (!guardador.current) {
    const ruta = `/editor/api/${datos.slug}/borrador`;
    guardador.current = crearGuardador(
      { config: datos.config, actualizadoEn: datos.actualizadoEn, errores: datos.errores },
      {
        guardar: async (c) =>
          aRespuesta(await fetch(ruta, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })),
        leer: async () => aRespuesta(await fetch(ruta, { cache: 'no-store' })),
        programar: (fn, ms) => window.setTimeout(fn, ms),
        cancelar: (id) => window.clearTimeout(id as number),
        alCambiar: (i) => setGuardado(i),
      },
    );
  }
  const g = guardador.current;
  const actual = guardado ?? g.instantanea();
  const [urls, setUrls] = useState(datos.urls);
  const [notaVistaPrevia, ponerNotaVistaPrevia] = useState<ReactNode>(null);
  const [tipoVistaPrevia, elegirTipoVistaPrevia] = useState<string | null>(null);
  const [formularios, setFormularios] = useState<Record<string, FormularioPendiente>>({});
  const [vistaPreviaExtra, ponerVistaPreviaExtra] = useState<VistaPreviaExtra | null>(null);
  const salidas = useRef(new Map<string, SalidaProtegida>());
  const formulariosSucios = useRef(false);
  formulariosSucios.current = Object.values(formularios).some((f) => f.sucio);

  // Cerrar la pestaña o recargar con cambios sin guardar pide confirmación (Decisión 26).
  useEffect(() => {
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      if (!g.hayCambiosSinGuardar() && !formulariosSucios.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', antesDeSalir);
    return () => window.removeEventListener('beforeunload', antesDeSalir);
  }, [g]);

  const borrador = actual.local;
  const hoy = hoyIso();
  const estados = useMemo(() => estadosDelEditor(borrador, actual.errores, hoy), [borrador, actual.errores, hoy]);
  const nombresTipos = useMemo(() => Object.fromEntries(datos.tiposComunes.map((t) => [t.clave, t.nombre])), [datos.tiposComunes]);
  const publicadaConfig = datos.publicada?.config ?? null;
  const cambios = useMemo(() => cambiosEntre(publicadaConfig, borrador, nombresTipos), [publicadaConfig, borrador, nombresTipos]);

  const valor: ContextoBorrador = {
    datos,
    borrador,
    guardado: actual,
    estados,
    cambios,
    cambiar: (b, v) => g.cambiar(b, v),
    cambiarVarios: (c) => g.cambiarVarios(c),
    guardarYa: () => g.guardarYa(),
    guardadoAhora: () => g.instantanea(),
    usarLoMio: () => g.usarLoMio(),
    verLoSuyo: () => g.verLoSuyo(),
    urls,
    agregarUrl: (src, url) => setUrls((u) => ({ ...u, [src]: url })),
    notaVistaPrevia,
    ponerNotaVistaPrevia,
    tipoVistaPrevia,
    elegirTipoVistaPrevia,
    formularios,
    vistaPreviaExtra,
    ponerVistaPreviaExtra,
    protegerSalida: (clave, s) => {
      if (s) salidas.current.set(clave, s);
      else salidas.current.delete(clave);
    },
    salidaProtegida: () => salidas.current.values().next().value ?? null,
    recordarFormulario: (clave, f) =>
      setFormularios((x) => {
        if (f === undefined) {
          if (!(clave in x)) return x;
          const copia = { ...x };
          delete copia[clave];
          return copia;
        }
        return { ...x, [clave]: f };
      }),
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Pone la nota de la vista previa mientras la sección está montada. */
export function useNotaVistaPrevia(nota: ReactNode, clave: string) {
  const { ponerNotaVistaPrevia } = useBorrador();
  useEffect(() => {
    ponerNotaVistaPrevia(nota);
    return () => ponerNotaVistaPrevia(null);
    // La nota cambia con `clave` (un texto): así no se reinstala en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, ponerNotaVistaPrevia]);
}
