'use client';
// F11 · Avisos fijos (AB/VicEdAvisos): lista ordenable (teclado con el menú del tirador y arrastre),
// interruptor por aviso y el formulario «Editar aviso» / «Nuevo aviso» junto a la vista previa.
// Al cargar no se reescribe nada: la lista se muestra ordenada y se numera al primer cambio.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  clavesDeFilas,
  erroresAviso,
  MAX_AVISOS,
  mover,
  moverA,
  numerar,
  ordenarAvisos,
  textoLugar,
  textoRango,
  vencido,
  type AvisoFijo,
} from '../../../../../lib/editor/avisos';
import { hoyIso } from '../../../../../lib/fecha';
import { Boton } from '../../../../componentes/Boton';
import { CajaRevisar } from '../../../../componentes/CajaRevisar';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { Interruptor } from '../../../../componentes/Interruptor';
import { useBorrador, useNotaVistaPrevia } from '../ProveedorBorrador';

export const TEXTO_AVISOS = 'Salen en la pantalla de Avisos, en este orden. Se apagan solos al pasar la fecha.';

type Seleccion = number | 'nuevo' | null;
type Formulario = { texto: string; detalle: string; desde: string; hasta: string };
const VACIO: Formulario = { texto: '', detalle: '', desde: '', hasta: '' };

const aFormulario = (a: AvisoFijo | undefined): Formulario =>
  a ? { texto: a.texto ?? '', detalle: a.detalle ?? '', desde: a.desde ?? '', hasta: a.hasta ?? '' } : VACIO;

/** Menú del tirador: «Subir», «Bajar», «Borrar aviso». Esc lo cierra y el foco vuelve al tirador. */
function MenuTirador({
  texto,
  onSubir,
  onBajar,
  onBorrar,
  arrastre,
}: {
  texto: string;
  onSubir: () => void;
  onBajar: () => void;
  onBorrar: () => void;
  arrastre: { onDragStart: () => void; onDragEnd: () => void };
}) {
  const [abierto, setAbierto] = useState(false);
  const tirador = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!abierto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fuera = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && e.target !== tirador.current) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    tirador.current?.focus();
  };
  const elegir = (accion: () => void) => {
    accion();
    cerrar();
  };
  const teclado = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setAbierto(false);
    }
  };

  return (
    <span className="pv-tirador-caja">
      <button
        ref={tirador}
        type="button"
        className="pv-tirador"
        aria-label={`Mover ${texto}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', texto);
          arrastre.onDragStart();
        }}
        onDragEnd={arrastre.onDragEnd}
        onClick={() => setAbierto((a) => !a)}
      >
        ⋮⋮
      </button>
      {abierto && (
        <ul ref={menu} role="menu" aria-label={`Mover ${texto}`} className="pv-menu-tirador" onKeyDown={teclado}>
          <li role="none">
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => elegir(onSubir)}>
              Subir
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => elegir(onBajar)}>
              Bajar
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" tabIndex={-1} className="pv-menu-tirador-peligro" onClick={() => elegir(onBorrar)}>
              Borrar aviso
            </button>
          </li>
        </ul>
      )}
    </span>
  );
}

export const CLAVE_FORMULARIO_AVISOS = 'avisos';
export const TEXTO_SIN_GUARDAR = 'Este aviso tiene cambios sin guardar.';

/** Lo que se recuerda del formulario al cambiar de sección (vive en el proveedor). */
type Recuerdo = { seleccion: Seleccion; formulario: Formulario; original: Formulario };

const mismo = (a: Formulario, b: Formulario) => a.texto === b.texto && a.detalle === b.detalle && a.desde === b.desde && a.hasta === b.hasta;

/** El texto de la confirmación de «Borrar aviso». */
export const textoBorrarAviso = (texto: string) => `¿Borrar el aviso «${texto}»?`;

/** El texto del diálogo de cambios sin guardar al elegir otro aviso. */
export function textoSinGuardar(texto: string): string {
  const t = texto.trim();
  return t ? `Lo que escribiste en «${t}» todavía no está guardado.` : 'Lo que escribiste en el aviso nuevo todavía no está guardado.';
}

export function SeccionAvisos() {
  const { borrador, cambiar, guardarYa, estados, formularios, recordarFormulario, protegerSalida } = useBorrador();
  useNotaVistaPrevia(null, 'avisos');
  const crudos = Array.isArray(borrador.avisos) ? (borrador.avisos as AvisoFijo[]) : [];
  const lista = ordenarAvisos(crudos.filter((a) => a && typeof a === 'object'));
  const hoy = hoyIso();
  const lleno = lista.length >= MAX_AVISOS;

  // Lo escrito y no guardado vuelve al volver a la sección (spec, sección 3: lo escrito no se pierde).
  const recuerdo = formularios[CLAVE_FORMULARIO_AVISOS]?.valor as Recuerdo | undefined;
  const [seleccion, setSeleccion] = useState<Seleccion>(() => recuerdo?.seleccion ?? null);
  // Sin elección: el primero; con la lista vacía, «Nuevo aviso».
  const efectiva: number | 'nuevo' = seleccion === 'nuevo' || lista.length === 0 ? 'nuevo' : seleccion !== null && seleccion < lista.length ? seleccion : 0;
  const [formulario, setFormulario] = useState<Formulario>(() => recuerdo?.formulario ?? aFormulario(lista[0]));
  // Lo que el formulario tenía al cargarse: si lo escrito difiere, está sin guardar.
  const [original, setOriginal] = useState<Formulario>(() => recuerdo?.original ?? aFormulario(lista[0]));
  const sucio = !mismo(formulario, original);
  const [errores, setErrores] = useState<ReturnType<typeof erroresAviso>>({});
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [pendiente, setPendiente] = useState<Seleccion>(null);
  const [borrando, setBorrando] = useState<number | null>(null);
  // Después de «Subir» o «Bajar», el foco vuelve al tirador del aviso movido (ya redibujado) y se
  // anuncia su lugar nuevo (spec, sección 5: el teclado es la forma accesible de reordenar).
  const [movido, setMovido] = useState<{ clave: string; n: number } | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const filas = clavesDeFilas(lista);
  const listaRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!movido) return;
    const fila = [...(listaRef.current?.querySelectorAll<HTMLElement>('.pv-aviso-fila') ?? [])].find((li) => li.dataset.clave === movido.clave);
    fila?.querySelector<HTMLElement>('.pv-tirador')?.focus();
  }, [movido]);

  useEffect(() => {
    recordarFormulario(CLAVE_FORMULARIO_AVISOS, sucio ? { valor: { seleccion, formulario, original } satisfies Recuerdo, sucio: true } : undefined);
    // recordarFormulario hace siempre lo mismo, pero cambia de identidad en cada render del proveedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucio, seleccion, formulario, original]);

  const clave = (s: number | 'nuevo', l: AvisoFijo[]) => (s === 'nuevo' ? 'nuevo' : `${s}:${l[s]?.texto ?? ''}`);

  // El formulario se carga al elegir otro aviso, o si el elegido cambia desde afuera (por ejemplo
  // «Ver lo suyo»), pero nunca pisa lo escrito sin guardar.
  const claveElegida = clave(efectiva, lista);
  const ultimaClave = useRef(claveElegida);
  useEffect(() => {
    if (ultimaClave.current === claveElegida) return;
    ultimaClave.current = claveElegida;
    if (sucio) return;
    const f = efectiva === 'nuevo' ? VACIO : aFormulario(lista[efectiva]);
    setFormulario(f);
    setOriginal(f);
    setErrores({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveElegida]);

  const escribir = (nueva: AvisoFijo[]) => cambiar('avisos', nueva.length ? numerar(nueva) : undefined);

  /** Carga en el formulario el aviso `s` de `l` (o el formulario vacío), descartando lo escrito. */
  const cargar = (s: number | 'nuevo', l: AvisoFijo[] = lista) => {
    const f = s === 'nuevo' ? VACIO : aFormulario(l[s]);
    setSeleccion(s);
    setFormulario(f);
    setOriginal(f);
    setErrores({});
    ultimaClave.current = clave(s, l);
  };

  const elegir = (s: number | 'nuevo') => {
    if (s === efectiva) return;
    if (sucio) setPendiente(s);
    else cargar(s);
  };

  const reordenar = (nueva: AvisoFijo[], desde: number, hasta: number) => {
    cambiar('avisos', nueva);
    if (efectiva === desde) {
      setSeleccion(hasta);
      ultimaClave.current = `${hasta}:${nueva[hasta]?.texto ?? ''}`;
    } else if (typeof efectiva === 'number' && efectiva === hasta) {
      setSeleccion(desde);
      ultimaClave.current = `${desde}:${nueva[desde]?.texto ?? ''}`;
    }
  };

  /** «Subir» / «Bajar» desde el menú del tirador. */
  const moverConMenu = (i: number, delta: -1 | 1) => {
    const hasta = Math.min(lista.length - 1, Math.max(0, i + delta));
    const nueva = mover(lista, i, delta);
    reordenar(nueva, i, hasta);
    setMovido((m) => ({ clave: clavesDeFilas(nueva)[hasta], n: (m?.n ?? 0) + 1 }));
    setAnuncio(textoLugar(lista[i]?.texto ?? '', hasta, lista.length));
  };

  const borrar = (i: number) => {
    const nueva = lista.filter((_, j) => j !== i);
    escribir(nueva);
    setBorrando(null);
    if (efectiva === i) cargar(nueva.length ? 0 : 'nuevo', nueva);
    else if (typeof efectiva === 'number' && i < efectiva) {
      // El aviso que se está editando sube un lugar: el formulario lo sigue, con lo escrito.
      setSeleccion(efectiva - 1);
      ultimaClave.current = clave(efectiva - 1, nueva);
    }
  };

  /** Guarda el formulario en el borrador; `false` si tiene errores. */
  const guardar = (): boolean => {
    const aviso: AvisoFijo = { texto: formulario.texto.trim() };
    if (formulario.detalle.trim()) aviso.detalle = formulario.detalle.trim();
    if (formulario.desde) aviso.desde = formulario.desde;
    if (formulario.hasta) aviso.hasta = formulario.hasta;
    const e = erroresAviso(aviso);
    setErrores(e);
    if (Object.keys(e).length) return false;
    if (efectiva === 'nuevo') {
      if (lleno) return false;
      escribir([...lista, aviso]);
      setSeleccion(lista.length);
      ultimaClave.current = `${lista.length}:${aviso.texto}`;
    } else {
      const anterior = lista[efectiva];
      const actualizado: AvisoFijo = { ...aviso };
      if (anterior?.activo === false) actualizado.activo = false;
      escribir(lista.map((a, i) => (i === efectiva ? actualizado : a)));
      ultimaClave.current = `${efectiva}:${aviso.texto}`;
    }
    // El formulario queda como quedó en el borrador (recortado): ya no está sin guardar.
    const f = aFormulario(aviso);
    setFormulario(f);
    setOriginal(f);
    void guardarYa();
    return true;
  };

  // Ir a otra sección con lo escrito sin guardar pregunta antes (GuardiaSalida, ronda final): «Editar
  // aviso» no se guarda solo. Se pone en cada render, así la guardia usa siempre lo escrito de ahora.
  useEffect(() => {
    protegerSalida(
      CLAVE_FORMULARIO_AVISOS,
      sucio
        ? {
            texto: textoSinGuardar(formulario.texto),
            etiquetaGuardar: 'Guardar aviso',
            guardar: () => {
              if (!guardar()) return false;
              recordarFormulario(CLAVE_FORMULARIO_AVISOS, undefined);
              return true;
            },
            descartar: () => {
              cargar(efectiva);
              recordarFormulario(CLAVE_FORMULARIO_AVISOS, undefined);
            },
          }
        : null,
    );
  });
  useEffect(
    () => () => protegerSalida(CLAVE_FORMULARIO_AVISOS, null),
    // protegerSalida escribe en una referencia del proveedor, pero cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const resolverPendiente = (accion: 'guardar' | 'descartar') => {
    const destino = pendiente;
    setPendiente(null);
    if (destino === null) return;
    if (accion === 'guardar' && !guardar()) return;
    cargar(destino);
  };

  return (
    <>
      <div className="pv-avisos-cabeza">
        <div className="pv-seccion-cabeza">
          <h1 className="pv-seccion-titulo">Avisos fijos</h1>
          <p className="pv-seccion-texto">{TEXTO_AVISOS}</p>
        </div>
        <div className="pv-galeria-subir">
          <Boton ocupado={lleno} aria-describedby={lleno ? 'pv-avisos-lleno' : undefined} onClick={() => !lleno && elegir('nuevo')}>
            + Nuevo aviso
          </Boton>
          {lleno && (
            <span id="pv-avisos-lleno" className="pv-nota-campo">
              Hasta 10 avisos.
            </span>
          )}
        </div>
      </div>
      <CajaRevisar problemas={estados.avisos.avisos} etiqueta="Avisos para revisar" />
      <p id="pv-avisos-anuncio" className="pv-solo-lectores" aria-live="polite">
        {anuncio}
      </p>
      <ul ref={listaRef} className="pv-avisos-lista" aria-label="Avisos fijos">
        {lista.length === 0 && <li className="pv-avisos-vacia">Todavía no hay avisos fijos.</li>}
        {lista.map((a, i) => {
          const termino = a.activo !== false && vencido(a, hoy);
          return (
            <li
              key={filas[i]}
              data-clave={filas[i]}
              className={['pv-aviso-fila', efectiva === i && 'pv-aviso-fila--elegido', sobre === i && arrastrando !== null && arrastrando !== i && 'pv-aviso-fila--sobre']
                .filter(Boolean)
                .join(' ')}
              onDragOver={(e) => {
                if (arrastrando === null) return;
                e.preventDefault();
                setSobre(i);
              }}
              onDragLeave={() => setSobre((s) => (s === i ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastrando !== null && arrastrando !== i) reordenar(moverA(lista, arrastrando, i), arrastrando, i);
                setArrastrando(null);
                setSobre(null);
              }}
            >
              <MenuTirador
                texto={a.texto}
                onSubir={() => moverConMenu(i, -1)}
                onBajar={() => moverConMenu(i, 1)}
                onBorrar={() => setBorrando(i)}
                arrastre={{ onDragStart: () => setArrastrando(i), onDragEnd: () => (setArrastrando(null), setSobre(null)) }}
              />
              <button type="button" className="pv-aviso-editar" aria-label={`Editar ${a.texto}`} aria-pressed={efectiva === i} onClick={() => elegir(i)}>
                <span className="pv-aviso-titulo">{a.texto}</span>
                {a.detalle && <span className="pv-aviso-detalle">{a.detalle}</span>}
              </button>
              <span className={termino ? 'pv-aviso-rango pv-aviso-rango--vencido' : 'pv-aviso-rango'}>{textoRango(a, hoy)}</span>
              <span className="pv-aviso-interruptor">
                <Interruptor
                  etiqueta={`Mostrar ${a.texto}`}
                  activo={a.activo !== false}
                  onCambiar={(v) =>
                    escribir(
                      lista.map((x, j) => {
                        if (j !== i) return x;
                        const copia: AvisoFijo = { ...x };
                        if (v) delete copia.activo;
                        else copia.activo = false;
                        return copia;
                      }),
                    )
                  }
                />
              </span>
            </li>
          );
        })}
      </ul>
      <section className="pv-avisos-form" aria-labelledby="pv-avisos-form-titulo">
        <h2 id="pv-avisos-form-titulo" className="pv-subtitulo">
          {efectiva === 'nuevo' ? 'Nuevo aviso' : 'Editar aviso'}
        </h2>
        <CampoTexto id="aviso-texto" etiqueta="Título" value={formulario.texto} error={errores.texto} onChange={(e) => setFormulario({ ...formulario, texto: e.target.value })} />
        <CampoTexto
          id="aviso-detalle"
          etiqueta="Texto"
          value={formulario.detalle}
          error={errores.detalle}
          onChange={(e) => setFormulario({ ...formulario, detalle: e.target.value })}
        />
        <div className="pv-fila-campos">
          <CampoTexto id="aviso-desde" etiqueta="Desde" type="date" value={formulario.desde} onChange={(e) => setFormulario({ ...formulario, desde: e.target.value })} />
          <CampoTexto
            id="aviso-hasta"
            etiqueta="Hasta"
            type="date"
            value={formulario.hasta}
            error={errores.fechas}
            onChange={(e) => setFormulario({ ...formulario, hasta: e.target.value })}
          />
        </div>
        <div className="pv-avisos-acciones">
          <Boton onClick={() => void guardar()}>Guardar aviso</Boton>
          {sucio && (
            <span className="pv-avisos-sin-guardar" role="status">
              {TEXTO_SIN_GUARDAR}
            </span>
          )}
        </div>
      </section>
      <Dialogo abierto={pendiente !== null} titulo="Cambios sin guardar" onCerrar={() => setPendiente(null)}>
        <p className="pv-dialogo-texto">{textoSinGuardar(formulario.texto)}</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setPendiente(null)}>
            Seguir editando
          </Boton>
          <Boton variante="secundario" onClick={() => resolverPendiente('descartar')}>
            Descartar cambios
          </Boton>
          <Boton onClick={() => resolverPendiente('guardar')}>Guardar aviso</Boton>
        </div>
      </Dialogo>
      <Dialogo abierto={borrando !== null} titulo="Borrar aviso" onCerrar={() => setBorrando(null)}>
        <p className="pv-dialogo-texto">{borrando !== null ? textoBorrarAviso(lista[borrando]?.texto ?? '') : ''}</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setBorrando(null)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={() => borrando !== null && borrar(borrando)}>
            Sí, borrar
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
