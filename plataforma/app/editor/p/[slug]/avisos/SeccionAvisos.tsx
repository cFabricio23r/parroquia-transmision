'use client';
// F11 · Avisos fijos (AB/VicEdAvisos): lista ordenable (teclado con el menú del tirador y arrastre),
// interruptor por aviso y el formulario «Editar aviso» / «Nuevo aviso» junto a la vista previa.
// Al cargar no se reescribe nada: la lista se muestra ordenada y se numera al primer cambio.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { erroresAviso, MAX_AVISOS, mover, moverA, numerar, ordenarAvisos, textoRango, type AvisoFijo } from '../../../../../lib/editor/avisos';
import { hoyIso } from '../../../../../lib/fecha';
import { Boton } from '../../../../componentes/Boton';
import { CampoTexto } from '../../../../componentes/CampoTexto';
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

export function SeccionAvisos() {
  const { borrador, cambiar, guardarYa } = useBorrador();
  useNotaVistaPrevia(null, 'avisos');
  const crudos = Array.isArray(borrador.avisos) ? (borrador.avisos as AvisoFijo[]) : [];
  const lista = ordenarAvisos(crudos.filter((a) => a && typeof a === 'object'));
  const hoy = hoyIso();
  const lleno = lista.length >= MAX_AVISOS;

  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  // Sin elección: el primero; con la lista vacía, «Nuevo aviso».
  const efectiva: number | 'nuevo' = seleccion === 'nuevo' || lista.length === 0 ? 'nuevo' : seleccion !== null && seleccion < lista.length ? seleccion : 0;
  const [formulario, setFormulario] = useState<Formulario>(() => aFormulario(lista[0]));
  const [errores, setErrores] = useState<ReturnType<typeof erroresAviso>>({});
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  // El formulario se carga al elegir otro aviso (no con cada cambio del borrador: no pisa lo escrito).
  const claveElegida = efectiva === 'nuevo' ? 'nuevo' : `${efectiva}:${lista[efectiva]?.texto ?? ''}`;
  const ultimaClave = useRef(claveElegida);
  useEffect(() => {
    if (ultimaClave.current === claveElegida) return;
    ultimaClave.current = claveElegida;
    setFormulario(efectiva === 'nuevo' ? VACIO : aFormulario(lista[efectiva]));
    setErrores({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveElegida]);

  const escribir = (nueva: AvisoFijo[]) => cambiar('avisos', nueva.length ? numerar(nueva) : undefined);

  const elegir = (s: number | 'nuevo') => {
    setSeleccion(s);
    if (s === 'nuevo' || s !== efectiva) {
      setFormulario(s === 'nuevo' ? VACIO : aFormulario(lista[s]));
      setErrores({});
      ultimaClave.current = s === 'nuevo' ? 'nuevo' : `${s}:${lista[s]?.texto ?? ''}`;
    }
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

  const borrar = (i: number) => {
    escribir(lista.filter((_, j) => j !== i));
    setSeleccion(null);
  };

  const guardar = () => {
    const aviso: AvisoFijo = { texto: formulario.texto.trim() };
    if (formulario.detalle.trim()) aviso.detalle = formulario.detalle.trim();
    if (formulario.desde) aviso.desde = formulario.desde;
    if (formulario.hasta) aviso.hasta = formulario.hasta;
    const e = erroresAviso(aviso);
    setErrores(e);
    if (Object.keys(e).length) return;
    if (efectiva === 'nuevo') {
      if (lleno) return;
      escribir([...lista, aviso]);
      setSeleccion(lista.length);
      ultimaClave.current = `${lista.length}:${aviso.texto}`;
    } else {
      const original = lista[efectiva];
      const actualizado: AvisoFijo = { ...aviso };
      if (original?.activo === false) actualizado.activo = false;
      escribir(lista.map((a, i) => (i === efectiva ? actualizado : a)));
      ultimaClave.current = `${efectiva}:${aviso.texto}`;
    }
    void guardarYa();
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
      <ul className="pv-avisos-lista" aria-label="Avisos fijos">
        {lista.length === 0 && <li className="pv-avisos-vacia">Todavía no hay avisos fijos.</li>}
        {lista.map((a, i) => (
          <li
            key={`${i}-${a.texto}`}
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
              onSubir={() => reordenar(mover(lista, i, -1), i, Math.max(0, i - 1))}
              onBajar={() => reordenar(mover(lista, i, 1), i, Math.min(lista.length - 1, i + 1))}
              onBorrar={() => borrar(i)}
              arrastre={{ onDragStart: () => setArrastrando(i), onDragEnd: () => (setArrastrando(null), setSobre(null)) }}
            />
            <button type="button" className="pv-aviso-editar" aria-label={`Editar ${a.texto}`} aria-pressed={efectiva === i} onClick={() => elegir(i)}>
              <span className="pv-aviso-titulo">{a.texto}</span>
              {a.detalle && <span className="pv-aviso-detalle">{a.detalle}</span>}
            </button>
            <span className="pv-aviso-rango">{textoRango(a, hoy)}</span>
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
        ))}
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
        <div>
          <Boton onClick={guardar}>Guardar aviso</Boton>
        </div>
      </section>
    </>
  );
}
