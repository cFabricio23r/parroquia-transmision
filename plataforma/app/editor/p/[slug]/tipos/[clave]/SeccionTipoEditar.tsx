'use client';
// F8 · Editar tipo (AB/VicEdTipoEditar): uno nuevo, un propio o el ajuste de un común (plan 4,
// Decisiones 17–24). Lo escrito es local hasta «Guardar tipo»: se recuerda al cambiar de sección
// (el encabezado dice «Sin guardar») y la vista previa lo muestra antes de guardar.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bloqueGuardado } from '../../../../../../lib/editor/guardado';
import { hrefSeccion } from '../../../../../../lib/editor/secciones';
import {
  aplicarTipo,
  borrarPropio,
  CASILLAS_PROPIO,
  erroresTipo,
  formularioDeTipo,
  puedeBorrarPropio,
  quitarAjustes,
  textoNoSeBorroTipo,
  type ErroresTipo,
  type FormularioTipo,
  type Portada,
} from '../../../../../../lib/editor/tipos';
import { Boton } from '../../../../../componentes/Boton';
import { CampoTexto } from '../../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../../componentes/Dialogo';
import { Segmentado } from '../../../../../componentes/Segmentado';
import { CabezaSeccion } from '../../CabezaSeccion';
import { ImagenDeGaleria } from '../../ImagenDeGaleria';
import { Migas } from '../../Migas';
import { useBorrador, useNotaVistaPrevia } from '../../ProveedorBorrador';

export const NOTA_VISTA_PREVIA_TIPO = 'La vista previa usa las pantallas de verdad, con el borrador.';
export const OPCIONES_PORTADA: { valor: Portada; texto: string }[] = [
  { valor: 'ninguna', texto: 'Sin portada' },
  { valor: 'fiesta', texto: 'Portada de la fiesta' },
  { valor: 'evento', texto: 'Portada de evento' },
];

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});
interface Recuerdo {
  formulario: FormularioTipo;
  original: FormularioTipo;
}

export function SeccionTipoEditar({ clave }: { clave: string }) {
  const { datos, borrador, cambiar, guardarYa, guardadoAhora, formularios, recordarFormulario, ponerVistaPreviaExtra } = useBorrador();
  useNotaVistaPrevia(NOTA_VISTA_PREVIA_TIPO, 'tipo');
  const router = useRouter();
  const base = hrefSeccion(datos.slug, 'tipos');
  const claveRecuerdo = `tipo:${clave}`;
  const recuerdo = formularios[claveRecuerdo]?.valor as Recuerdo | undefined;
  const inicial = useMemo(() => formularioDeTipo(borrador, clave, datos.tiposComunes), [borrador, clave, datos.tiposComunes]);
  const [formulario, setFormulario] = useState<FormularioTipo | null>(() => recuerdo?.formulario ?? inicial);
  const [original, setOriginal] = useState<FormularioTipo | null>(() => recuerdo?.original ?? inicial);
  const [errores, setErrores] = useState<ErroresTipo>({});
  const [confirmar, setConfirmar] = useState<'volver' | 'borrar' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const saliendo = useRef(false);
  const sucio = !!formulario && JSON.stringify(formulario) !== JSON.stringify(original);

  useEffect(() => {
    if (saliendo.current) return;
    recordarFormulario(claveRecuerdo, sucio && formulario && original ? { valor: { formulario, original } satisfies Recuerdo, sucio: true } : undefined);
    // recordarFormulario cambia de identidad en cada render del proveedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucio, formulario, original, claveRecuerdo]);

  const tipos = borrador.tipos;
  const propios = Array.isArray(objeto(tipos).propios) ? (objeto(tipos).propios as unknown[]).map(objeto) : [];
  const clavesPropias = propios.map((p) => String(p.clave ?? ''));

  // Decisión 24: la vista previa muestra el tipo con lo escrito, antes de guardar.
  const poner = useRef(ponerVistaPreviaExtra);
  poner.current = ponerVistaPreviaExtra;
  useEffect(() => {
    if (!formulario) return;
    const a = aplicarTipo(tipos, formulario, datos.tiposComunes, clavesPropias);
    const config: Objeto = { ...borrador };
    if (a.tipos) config.tipos = a.tipos;
    else delete config.tipos;
    poner.current({ config, tipo: a.clave });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulario, borrador, datos.tiposComunes]);
  useEffect(() => () => poner.current(null), []);

  if (!formulario || !original) {
    return (
      <section className="pv-seccion-form" aria-labelledby="pv-titulo-tipo">
        <CabezaSeccion titulo={<span id="pv-titulo-tipo">Ese tipo no existe</span>} texto="Vuelve a la lista de tipos.">
          <Link href={base} className="pv-enlace">
            Tipos de transmisión
          </Link>
        </CabezaSeccion>
      </section>
    );
  }

  const f = formulario;
  const comun = f.clase === 'comun';
  const poner1 = <K extends keyof FormularioTipo>(k: K, v: FormularioTipo[K]) => setFormulario({ ...f, [k]: v });
  const titulo = f.clase === 'nuevo' ? f.nombre.trim() || 'Nuevo tipo' : f.clase === 'propio' ? original.nombre || f.id : f.nombre;
  const miga = f.clase === 'nuevo' ? 'Nuevo tipo' : titulo;
  const rotulosComun = comun ? (datos.tiposComunes.find((c) => c.clave === f.id)?.rotulos ?? []) : [];
  const casillas = comun ? rotulosComun.map((r) => ({ id: r.id, texto: r.nombre })) : CASILLAS_PROPIO;
  const panelDefecto = comun ? datos.tiposComunes.find((c) => c.clave === f.id)?.nombrePanel : undefined;
  const ajusteGuardado = comun && f.claves.some((k) => objeto(objeto(tipos).ajustes)[k] !== undefined);
  const sePuedeBorrar = f.clase === 'propio' && puedeBorrarPropio(tipos, f.id);

  const salir = () => {
    saliendo.current = true;
    recordarFormulario(claveRecuerdo, undefined);
    router.push(base);
  };

  const guardar = async () => {
    const e = erroresTipo(f, tipos);
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    cambiar('tipos', aplicarTipo(tipos, f, datos.tiposComunes, clavesPropias).tipos);
    await guardarYa();
    setGuardando(false);
    // Solo se sale si el tipo quedó guardado. Si no (sin conexión, rechazado, conflicto…), se queda
    // aquí con lo escrito y el aviso del guardado dice qué pasó y cómo seguir (revisión).
    if (bloqueGuardado(guardadoAhora(), 'tipos')) salir();
  };

  const volver = () => {
    setConfirmar(null);
    const t = quitarAjustes(tipos, f.claves);
    cambiar('tipos', t);
    const nuevo = formularioDeTipo({ ...borrador, tipos: t }, clave, datos.tiposComunes);
    setFormulario(nuevo);
    setOriginal(nuevo);
    setErrores({});
  };

  const borrar = async () => {
    setConfirmar(null);
    const antes = tipos;
    cambiar('tipos', borrarPropio(tipos, f.id));
    await guardarYa();
    const ahora = guardadoAhora();
    if (bloqueGuardado(ahora, 'tipos')) return salir();
    // El borrado no llegó: el tipo vuelve al borrador (si no, se borraría solo más tarde, con esta
    // página abierta) y se dice por qué, aquí mismo (revisión).
    cambiar('tipos', antes);
    setErrores({ general: textoNoSeBorroTipo(ahora.estado) });
  };

  return (
    <section className="pv-seccion-form pv-tipo-form" aria-labelledby="pv-titulo-tipo">
      <Migas items={[{ texto: 'Tipos de transmisión', href: base }, { texto: miga }]} />
      <h1 id="pv-titulo-tipo" className="pv-seccion-titulo">
        {titulo}
      </h1>
      {errores.general && (
        <div role="alert" className="pv-alerta">
          {errores.general}
        </div>
      )}
      <div className="pv-fila-campos">
        {!comun && (
          <CampoTexto id="tipo-nombre" etiqueta="Nombre" value={f.nombre} error={errores.nombre} onChange={(e) => poner1('nombre', e.target.value)} />
        )}
        <CampoTexto
          id="tipo-panel"
          etiqueta="Nombre en el panel"
          ayuda="Corto, para el botón."
          placeholder={panelDefecto}
          value={f.nombrePanel}
          error={errores.nombrePanel}
          onChange={(e) => poner1('nombrePanel', e.target.value)}
        />
      </div>
      <div className="pv-fila-campos">
        <CampoTexto
          id="tipo-inicio"
          etiqueta="Texto de arriba en Inicio"
          value={f.textoInicio}
          error={errores.textoInicio}
          onChange={(e) => poner1('textoInicio', e.target.value)}
        />
        <CampoTexto
          id="tipo-gracias"
          etiqueta="Texto de Gracias"
          value={f.textoGracias}
          error={errores.textoGracias}
          onChange={(e) => poner1('textoGracias', e.target.value)}
        />
      </div>
      <ImagenDeGaleria
        id="tipo-imagen"
        etiqueta="Imagen"
        valor={f.imagen}
        textoSinValor={comun ? 'La de siempre' : 'Imagen del patrono'}
        onCambiar={(v) => poner1('imagen', v)}
      />
      {!comun && <Segmentado etiqueta="Portada" opciones={OPCIONES_PORTADA} valor={f.portada} onCambiar={(v) => poner1('portada', v)} />}
      <fieldset className="pv-tarjeta-opciones pv-tipo-rotulos">
        <legend className="pv-subtitulo">Rótulos que se ofrecen en el panel</legend>
        <div className="pv-casillas">
          {casillas.map((c) => (
            <label key={c.id} className="pv-casilla">
              <input
                type="checkbox"
                checked={!!f.casillas[c.id]}
                onChange={(e) => poner1('casillas', { ...f.casillas, [c.id]: e.target.checked })}
              />
              {c.texto}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="pv-tipo-acciones">
        <Boton onClick={() => void guardar()} ocupado={guardando}>
          Guardar tipo
        </Boton>
        <Boton variante="secundario" onClick={salir}>
          Cancelar
        </Boton>
        {f.clase === 'propio' && (
          <>
            <Boton
              variante="peligro"
              aria-disabled={sePuedeBorrar ? undefined : 'true'}
              aria-describedby={sePuedeBorrar ? undefined : 'pv-tipo-no-borrar'}
              onClick={() => sePuedeBorrar && setConfirmar('borrar')}
            >
              Borrar tipo
            </Boton>
            {!sePuedeBorrar && (
              <span id="pv-tipo-no-borrar" className="pv-campo-ayuda">
                Tiene que quedar al menos un tipo en el panel.
              </span>
            )}
          </>
        )}
        {ajusteGuardado && (
          <Boton variante="secundario" onClick={() => setConfirmar('volver')}>
            Volver a como venía
          </Boton>
        )}
      </div>
      <Dialogo abierto={confirmar === 'volver'} titulo="Volver a como venía" onCerrar={() => setConfirmar(null)}>
        <p className="pv-dialogo-texto">«{titulo}» vuelve a como lo mantiene la Pastoral. Tus cambios a este tipo se borran.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setConfirmar(null)}>
            Cancelar
          </Boton>
          <Boton onClick={volver}>Sí, volver</Boton>
        </div>
      </Dialogo>
      <Dialogo abierto={confirmar === 'borrar'} titulo="Borrar tipo" onCerrar={() => setConfirmar(null)}>
        <p className="pv-dialogo-texto">¿Borrar el tipo «{titulo}»? Deja de aparecer en el panel.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setConfirmar(null)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={() => void borrar()}>
            Sí, borrar
          </Boton>
        </div>
      </Dialogo>
    </section>
  );
}
