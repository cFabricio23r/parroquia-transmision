// La tarea 'guardadas' del sincronizador (Tarea 6): sube lo que el panel de la app dejó pendiente,
// baja las misas listas de la parroquia y se las devuelve al panel. Las reglas son las de
// vicaria/guardadas-sync.js (la referencia):
//   - un pendiente sale de la cola solo cuando la subida se confirmó, y solo hasta el `cuando` que se subió;
//   - 23505 (el nombre ya está en la nube): «(copia)» con nombreLibre y un solo reintento;
//   - otro 4xx de PostgREST: queda `rechazado`, nunca se reintenta y la guardada sigue a la vista (el panel
//     dice «No se guardó en la nube» en su fila y cuántas son en la línea de estado);
//   - Auth (la renovación de la sesión), un 403 de PostgREST (la cuenta), un 408, 425 o 429, o sin red: se corta y
//     la cola queda;
//   - un guardar cuya guardada no está en la lista del panel queda en la cola: no hay nada que subir ahora;
//   - varios «usar» de una guardada van en un solo rpc usar_guardada, con el último.
// Nada corre en vivo. El panel nunca ve tokens: lo nativo sube y baja, y le inyecta solo la lista y la cola.
import type { ContextoSincronizar, Limpiezas, Sincronizador, TareaSincronizar } from '../sincronizar/sincronizar';
import type { Resultado, SesionSupabase } from '../supabase/cliente';
import { GUARDADAS, type FilaGuardada, type Guardada, type PendienteGuardada } from './nucleo';
import { scriptPonerGuardadas, type CanalGuardadas, type MensajeGuardadas } from './puente';

export interface DepsGuardadas {
  canal: CanalGuardadas;
  /** En ms, como `Date.now`. */
  ahora?: () => number;
}

type Base = Omit<ContextoSincronizar, 'momento'>;

/** Las bajas más viejas que esto ya no hacen falta (como listarGuardadasNube del panel). */
const DIAS_BAJAS = 30;
/** Después de un mensaje del panel con pendientes. */
export const ESPERA_TRAS_CAMBIO_MS = 2000;

const igual = (a: PendienteGuardada, b: PendienteGuardada) => a.op === b.op && a.id === b.id;
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Corre `fn` con la sesión. `deAuth`: el error no es la respuesta de PostgREST a este pedido sino de la
 * sesión (no había, o la renovación falló), así que no habla de esta guardada.
 */
async function pedir<T>(c: Base, fn: (s: SesionSupabase) => Promise<Resultado<T>>): Promise<{ r: Resultado<T>; deAuth: boolean }> {
  let deFn: Resultado<T> | null = null;
  const r = await c.sesion.conSesion(async (s) => (deFn = await fn(s)));
  return { r, deAuth: r !== deFn };
}

/** Respuestas pasajeras de PostgREST: cortan y se reintenta después. */
const PASAJEROS: readonly number[] = [408, 425, 429];

/** 'ok', 'rechazar' (la respuesta de PostgREST a esta guardada, un 4xx) o 'cortar'. */
function clasificar(x: { r: Resultado<unknown>; deAuth: boolean }): 'ok' | 'rechazar' | 'cortar' {
  if (x.r.ok) return 'ok';
  if (x.deAuth) return 'cortar';
  const e = x.r.error;
  // Un 403 de PostgREST ('permiso') es de la cuenta, no de esta guardada: corta y la cola queda, como en el panel.
  // 408, 425 y 429 son pasajeros (plazo, «muy temprano», límite de pedidos): también cortan.
  if (e.tipo === 'servidor' && !PASAJEROS.includes(e.estado) && e.estado >= 400 && e.estado < 500) return 'rechazar';
  return 'cortar';
}

function listar(c: Base, ahora: number) {
  const desde = iso(ahora - DIAS_BAJAS * 86400000);
  return pedir(c, (s) =>
    c.cliente.seleccionar<FilaGuardada>(s, 'guardadas', {
      select: '*',
      parroquia_id: 'eq.' + c.parroquia.id,
      or: `(borrada_en.is.null,borrada_en.gte.${desde})`,
    }),
  );
}

const subir = (c: Base, f: object) => pedir(c, (s) => c.cliente.upsert<unknown>(s, 'guardadas', [f], 'parroquia_id,id'));

/** Lo que ya se confirmó o se rechazó en esta sesión de la app, hasta que el panel lo refleje. */
type Memoria = { hechos: PendienteGuardada[]; rechazados: PendienteGuardada[] };

function crearCorredor(d: DepsGuardadas) {
  const ahora = d.ahora ?? Date.now;
  const memorias = new Map<string, Memoria>();

  async function correr(c: Base): Promise<void> {
    if (c.enVivo()) return;
    const slug = c.parroquia.slug;
    const pid = c.parroquia.id;
    const m: MensajeGuardadas | null = d.canal.ultimo(slug);
    const lista: Guardada[] = m ? m.lista : [];
    const enPanel = m ? m.pendientes : [];

    // Lo que ya se subió (o se rechazó) en una corrida anterior y el panel todavía no reflejó no se
    // vuelve a subir: solo se le vuelve a avisar. Lo que el panel ya reflejó se olvida.
    const anterior = memorias.get(slug) ?? { hechos: [], rechazados: [] };
    const memoria: Memoria = {
      hechos: anterior.hechos.filter((h) => enPanel.some((p) => igual(p, h) && p.cuando <= h.cuando)),
      rechazados: anterior.rechazados.filter((r) => enPanel.some((p) => igual(p, r) && p.cuando === r.cuando && !p.rechazado)),
    };
    memorias.set(slug, memoria);
    const hechos: PendienteGuardada[] = [];
    const rechazados: PendienteGuardada[] = [];
    const cola = enPanel.filter((p) => {
      if (p.rechazado) return false;
      const h = memoria.hechos.find((x) => igual(p, x) && p.cuando <= x.cuando);
      if (h) {
        hechos.push(h);
        return false;
      }
      const r = memoria.rechazados.find((x) => igual(p, x) && p.cuando === x.cuando);
      if (r) {
        rechazados.push(r);
        return false;
      }
      return true;
    });
    const hecho = (p: PendienteGuardada) => {
      hechos.push(p);
      memoria.hechos.push(p);
    };
    const rechazado = (p: PendienteGuardada) => {
      rechazados.push(p);
      memoria.rechazados.push(p);
    };

    /** null si se sigue con el próximo; true si hay que cortar. */
    const terminar = (p: PendienteGuardada, x: { r: Resultado<unknown>; deAuth: boolean }): true | null => {
      const k = clasificar(x);
      if (k === 'ok') hecho(p);
      else if (k === 'rechazar') rechazado(p);
      else return true;
      return null;
    };

    let nubeAntes: Promise<{ r: Resultado<FilaGuardada[]>; deAuth: boolean }> | null = null;
    const nube = () => (nubeAntes = nubeAntes ?? listar(c, ahora()));

    async function subirGuardar(p: PendienteGuardada): Promise<true | null> {
      const g = lista.find((x) => x.id === p.id);
      // Ya no está en la copia del panel: no hay nada que subir ahora, pero tampoco se descarta ni se rechaza
      // (la nube no dijo nada). Queda en la cola, como en vicaria/guardadas-sync.js.
      if (!g) return null;
      let fila = GUARDADAS.aFila(g, 'app', pid);
      let x = await subir(c, fila);
      if (!x.r.ok && !x.deAuth && x.r.error.tipo === 'servidor' && x.r.error.codigo === '23505') {
        // Otro aparato ya tiene una guardada con ese nombre: esta pasa a «(copia)» y se reintenta una vez.
        const n = await nube();
        if (!n.r.ok) return true;
        const ocupados = n.r.valor
          .filter((f) => !f.borrada_en && f.id !== g.id)
          .map((f) => f.nombre)
          .concat(lista.filter((o) => o.id !== g.id).map((o) => o.nombre));
        fila = { ...fila, nombre: GUARDADAS.nombreLibre(g.nombre, ocupados) };
        x = await subir(c, fila);
      }
      return terminar(p, x);
    }

    /** La baja necesita la fila completa: sale de la nube, porque el panel ya no la tiene. */
    async function subirBorrar(p: PendienteGuardada): Promise<true | null> {
      const n = await nube();
      if (!n.r.ok) return true;
      const f = n.r.valor.find((x) => x.id === p.id);
      if (!f || f.borrada_en) {
        hecho(p);   // nunca subió, o ya está borrada
        return null;
      }
      const cuando = iso(p.cuando);
      const { actualizado_por: _p, ...resto } = f;   // lo pone el servidor
      const baja = { ...resto, parroquia_id: pid, borrada_en: cuando, actualizado_en: cuando, actualizado_desde: 'app' as const };
      return terminar(p, await subir(c, baja));
    }

    /** Guardar y borrar primero, en orden; después un solo «usar» por guardada (el último). */
    async function subirPendientes(): Promise<true | null> {
      for (const p of cola.filter((x) => x.op !== 'usar')) {
        if (c.enVivo() || !c.sigueElegida()) return true;
        const corte = p.op === 'guardar' ? await subirGuardar(p) : await subirBorrar(p);
        if (corte) return corte;
      }
      const ultimos = new Map<string, PendienteGuardada>();
      for (const p of cola.filter((x) => x.op === 'usar')) {
        const ya = ultimos.get(p.id);
        if (!ya || ya.cuando < p.cuando) ultimos.set(p.id, p);
      }
      for (const p of ultimos.values()) {
        if (c.enVivo() || !c.sigueElegida()) return true;
        if (enPanel.some((x) => x.op === 'borrar' && x.id === p.id)) {
          hecho(p);   // se borró: usarla no importa
          continue;
        }
        const x = await pedir(c, (s) => c.cliente.rpc(s, 'usar_guardada', { p_parroquia: pid, p_id: p.id, p_cuando: iso(p.cuando) }));
        if (terminar(p, x)) return true;
      }
      return null;
    }

    /** Le pasa al panel lo que se sabe: la cola siempre; la lista solo si se bajó la nube. */
    const avisarPanel = (filas: FilaGuardada[] | null) => {
      if (filas === null && hechos.length === 0 && rechazados.length === 0) return;
      if (c.enVivo() || !c.sigueElegida()) return;
      d.canal.inyectar(slug, scriptPonerGuardadas(slug, filas, { hechos, rechazados }));
    };

    if (await subirPendientes()) {
      console.warn('guardadas: sincronización cortada');
      avisarPanel(null);
      return;
    }
    if (c.enVivo() || !c.sigueElegida()) return;

    // Una bajada nueva (no la de antes de subir): trae lo que se acaba de subir.
    const r = await listar(c, ahora());
    if (!r.r.ok) {
      console.warn('guardadas: sincronización cortada');
      avisarPanel(null);
      return;
    }
    avisarPanel(r.r.valor);
  }

  // Una sola corrida a la vez; un pedido durante una corrida hace otra al terminar (con el último mensaje).
  let enCurso: Promise<void> | null = null;
  let siguiente: Promise<void> | null = null;
  return function correrUna(c: Base): Promise<void> {
    if (!enCurso) {
      const esta = correr(c).finally(() => {
        if (enCurso === esta) enCurso = null;
      });
      enCurso = esta;
      return esta;
    }
    if (!siguiente) {
      const previa = enCurso;
      const esta: Promise<void> = previa
        .catch(() => undefined)
        .then(() => {
          siguiente = null;
          const p = correr(c);
          enCurso = p.finally(() => {
            if (enCurso === p) enCurso = null;
          });
          return p;
        });
      siguiente = esta;
    }
    return siguiente;
  };
}

export function crearTareaGuardadas(d: DepsGuardadas): TareaSincronizar {
  const correr = crearCorredor(d);
  return (c) => correr(c);
}

export interface DepsRegistroGuardadas extends DepsGuardadas {
  /** El contexto de ahora (parroquia, sesión, cliente, enVivo…), o null si no se puede sincronizar (sin red, sin parroquia). */
  contexto(): Base | null;
}

/**
 * La tarea 'guardadas' en abrir, antes de iniciar y al terminar (como 'semana'), y también
 * ESPERA_TRAS_CAMBIO_MS después de cada mensaje del panel con pendientes (y del primero de cada parroquia,
 * aunque no traiga pendientes), si no está en vivo.
 */
export function registrarGuardadas(s: Sincronizador, l: Limpiezas, d: DepsRegistroGuardadas): void {
  const correr = crearCorredor(d);
  s.registrarTarea('guardadas', ['abrir', 'antes-de-iniciar', 'al-terminar'], (c) => correr(c));

  // El primer mensaje de cada parroquia (el panel recién abierto) corre aunque no haya pendientes: 'abrir'
  // puede haber corrido antes de que la vista estuviera conectada, y así las misas del otro aparato se ven al abrir.
  const primeros = new Set<string>();
  l.registrar('guardadas', async (a) => {
    const slug = a.tipo === 'parroquia' ? a.parroquia.slug : undefined;
    d.canal.olvidar(slug);
    if (slug === undefined) primeros.clear();
    else primeros.delete(slug);
  });
  let espera: ReturnType<typeof setTimeout> | undefined;
  d.canal.alMensaje((slug, m) => {
    const primero = !primeros.has(slug);
    if (!primero && !m.pendientes.some((p) => !p.rechazado)) return;
    if (espera !== undefined) clearTimeout(espera);
    espera = setTimeout(() => {
      espera = undefined;
      let c: Base | null = null;
      try {
        c = d.contexto();
        if (!c || c.parroquia.slug !== slug || c.enVivo() || !c.sigueElegida()) return;
      } catch {
        return;   // si no se puede saber, no se corre: nunca se sube nada en vivo por error
      }
      primeros.add(slug);
      correr(c).catch(() => console.warn('sincronizar: guardadas falló'));
    }, ESPERA_TRAS_CAMBIO_MS);
  });
}
