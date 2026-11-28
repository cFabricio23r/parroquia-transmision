'use client';
// F5 · Editar una pantalla (AB/VicEdPantallaEditar): fondo, imagen grande, distribución, qué se
// muestra, los textos y «Volver a como venía». Todo se escribe con las ayudas de lib/editor/pantallas
// (plan 4, Decisiones 1–5 y 27): cualquier cambio pone `modo: 'personalizada'` y conserva lo que el
// editor no muestra. Abrir la página no escribe nada.
import Link from 'next/link';
import { useState } from 'react';
import { contraste, MIN_CONTRASTE } from '../../../../../../lib/contraste';
import { avisosDePantallas } from '../../../../../../lib/editor/estados';
import { MENSAJE_HEX, RE_HEX } from '../../../../../../lib/editor/imagen';
import {
  conEncuadre,
  conInterruptor,
  conLetra,
  conTamano,
  encendido,
  letraDe,
  LETRAS_DE_VISTA,
  OPCIONES_LETRA_FRASE_VISTA,
  OPCIONES_LETRA_TITULO_VISTA,
  FAMILIA_LETRA_FRASE,
  encuadreDe,
  fotoEncuadrable,
  OPCIONES_TAMANO_TEXTO,
  tamanoDe,
  type CualFoto,
  type CualTamano,
  fondoGaleriaInicial,
  imagenFijaInicial,
  opcionesFondoGaleria,
  opcionesImagenFija,
  opcionFondo,
  opcionImagen,
  ponerEnPantalla,
  ponerTexto,
  vistaEditor,
  volverComoVenia,
  type OpcionFondo,
  type OpcionImagen,
} from '../../../../../../lib/editor/pantallas';
import { hrefSeccion } from '../../../../../../lib/editor/secciones';
import { Boton } from '../../../../../componentes/Boton';
import { CajaRevisar } from '../../../../../componentes/CajaRevisar';
import { CampoColor } from '../../../../../componentes/CampoColor';
import { CampoSelect } from '../../../../../componentes/CampoSelect';
import { CampoTextoDePantalla } from './CampoTextoDePantalla';
import { DeslizadoresFoto } from '../../../../../componentes/DeslizadoresFoto';
import { Dialogo } from '../../../../../componentes/Dialogo';
import { Interruptor } from '../../../../../componentes/Interruptor';
import { ListaTipografias } from '../../../../../componentes/ListaTipografias';
import { Segmentado } from '../../../../../componentes/Segmentado';
import { FAMILIA_TIPOGRAFIA, OPCIONES_TIPOGRAFIA } from '../../../../../../lib/editor/rotulos';
import { CabezaSeccion } from '../../CabezaSeccion';
import { Migas } from '../../Migas';
import { useBorrador, useNotaVistaPrevia } from '../../ProveedorBorrador';

export const NOTA_VISTA_PREVIA = 'La vista previa usa las pantallas de verdad, con el borrador.';
export const MENSAJE_SIN_CONTRASTE = 'El texto blanco no se lee sobre este color. Elige uno más oscuro.';
export const MENSAJE_SIN_FOTOS = 'Todavía no hay fotos en la galería.';

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});
const texto = (v: unknown) => (typeof v === 'string' ? v : '');

const OPCIONES_FONDO: { valor: OpcionFondo; texto: string }[] = [
  { valor: 'parroquia', texto: 'Colores de la parroquia' },
  { valor: 'galeria', texto: 'Foto de la galería' },
  { valor: 'color', texto: 'Color liso' },
];
const OPCIONES_IMAGEN: { valor: OpcionImagen; texto: string }[] = [
  { valor: 'tipo', texto: 'La del tipo de transmisión' },
  { valor: 'fija', texto: 'Siempre la misma' },
  { valor: 'ninguna', texto: 'Sin imagen' },
];
const OPCIONES_DISTRIBUCION = [
  { valor: 'derecha', texto: 'Imagen a la derecha' },
  { valor: 'izquierda', texto: 'Imagen a la izquierda' },
  { valor: 'centro', texto: 'Centrado' },
];

/** Los tamaños de texto de cada pantalla (Avisos no tiene frase; Producción, solo el nombre; EN VIVO, ninguno; Horarios no está en el editor). */
const TAMANOS_DE_VISTA: Record<string, { cual: CualTamano; etiqueta: string }[]> = {
  inicio: [{ cual: 'titulo', etiqueta: 'Tamaño del título' }, { cual: 'frase', etiqueta: 'Tamaño de la frase' }],
  portada: [{ cual: 'titulo', etiqueta: 'Tamaño del título' }, { cual: 'frase', etiqueta: 'Tamaño de la frase' }],
  evento: [{ cual: 'titulo', etiqueta: 'Tamaño del título' }, { cual: 'frase', etiqueta: 'Tamaño de la frase' }],
  gracias: [{ cual: 'titulo', etiqueta: 'Tamaño del título' }, { cual: 'frase', etiqueta: 'Tamaño de la frase' }],
  avisos: [{ cual: 'titulo', etiqueta: 'Tamaño del título' }],
  comunion: [{ cual: 'titulo', etiqueta: 'Tamaño del título' }, { cual: 'frase', etiqueta: 'Tamaño de la oración' }],
  produccion: [{ cual: 'titulo', etiqueta: 'Tamaño del nombre' }],
};

/** El color de «Color liso» al elegirlo: el oscuro de la parroquia si se lee con blanco; si no, #0c3562. */
function colorInicial(colores: unknown): string {
  const oscuro = objeto(colores).oscuro;
  return typeof oscuro === 'string' && RE_HEX.test(oscuro) && contraste('#ffffff', oscuro) >= MIN_CONTRASTE ? oscuro : '#0c3562';
}

/** Decisión 2: el error de «Color del fondo», o nada si se puede escribir. */
export function errorColorFondo(v: string): string | undefined {
  if (!RE_HEX.test(v)) return MENSAJE_HEX;
  if (contraste('#ffffff', v) < MIN_CONTRASTE) return MENSAJE_SIN_CONTRASTE;
  return undefined;
}

export function SeccionPantallaEditar({ vista }: { vista: string }) {
  const { datos, borrador, cambiar } = useBorrador();
  const v = vistaEditor(vista);
  useNotaVistaPrevia(NOTA_VISTA_PREVIA, 'pantalla');
  const [sinFotos, setSinFotos] = useState(false);
  const [textoColor, setTextoColor] = useState<string | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState(false);
  const hrefPantallas = hrefSeccion(datos.slug, 'pantallas');

  if (!v) {
    return (
      <section className="pv-seccion-form">
        <CabezaSeccion titulo="Esa pantalla no existe" texto="Vuelve a la lista de pantallas.">
          <Link href={hrefPantallas} className="pv-enlace">
            Pantallas
          </Link>
        </CabezaSeccion>
      </section>
    );
  }

  const todas = objeto(borrador.pantallas);
  const existe = Object.hasOwn(todas, vista);
  const p = objeto(todas[vista]);
  const fondo = objeto(p.fondo);
  const poner = (cambio: Objeto) => cambiar('pantallas', ponerEnPantalla(borrador.pantallas, vista, cambio));

  const elegirFondo = (o: OpcionFondo) => {
    setTextoColor(null);
    if (o !== 'galeria') setSinFotos(false);
    if (o === opcionFondo(p)) return;
    if (o === 'parroquia') return poner({ fondo: undefined });
    if (o === 'color') return poner({ fondo: { tipo: 'color', color: colorInicial(borrador.colores) } });
    const id = fondoGaleriaInicial(borrador);
    if (!id) return setSinFotos(true);
    poner({ fondo: { tipo: 'imagen', imagen: id } });
  };
  const elegirImagen = (o: OpcionImagen) => {
    if (o === opcionImagen(p)) return;
    if (o === 'tipo') return poner({ imagen: undefined });
    if (o === 'ninguna') return poner({ imagen: 'ninguna' });
    poner({ imagen: imagenFijaInicial(borrador) });
  };
  const ponerInterruptor = (e: Parameters<typeof encendido>[1], valor: boolean) => {
    const nuevo = conInterruptor(p, e, valor);
    poner({ ocultar: nuevo.ocultar, mostrar: nuevo.mostrar });
  };
  const imagenPatrono = (borrador.patrono as { imagen?: { src?: unknown } } | undefined)?.imagen?.src;
  const conImagenPatrono = typeof imagenPatrono === 'string' && imagenPatrono !== '';
  const deslizadores = (cual: CualFoto, titulo: string) =>
    fotoEncuadrable(p, cual, vista, conImagenPatrono) !== null && (
      <DeslizadoresFoto
        titulo={titulo}
        valores={encuadreDe(p, cual, vista)}
        onCambiar={(valores) => poner({ encuadre: conEncuadre(p, cual, valores, vista).encuadre })}
        onVolver={() => poner({ encuadre: conEncuadre(p, cual, null, vista).encuadre })}
      />
    );
  const escribir = (clave: string, valor: string) => {
    setTextos((t) => ({ ...t, [clave]: valor }));
    poner({ textos: ponerTexto(p, clave, valor).textos });
  };

  const colorMostrado = textoColor ?? texto(fondo.color);
  const errorColor = textoColor !== null ? errorColorFondo(textoColor) : undefined;
  const opcionesFoto = opcionesFondoGaleria(borrador);
  const fotoActual = texto(fondo.imagen);
  const imagenActual = texto(p.imagen);
  const opcionesImagen = opcionesImagenFija(borrador, imagenActual);

  return (
    <section className="pv-seccion-form" aria-labelledby="pv-titulo-pantalla">
      <Migas items={[{ texto: 'Pantallas', href: hrefPantallas }, { texto: v.nombre }]} />
      <h1 id="pv-titulo-pantalla" className="pv-seccion-titulo">
        {v.titulo}
      </h1>

      {v.conFondoEImagen && (
        <>
          <div className="pv-estilo-grupo">
            <Segmentado etiqueta="Fondo" opciones={OPCIONES_FONDO} valor={opcionFondo(p)} onCambiar={elegirFondo} />
            {opcionFondo(p) === 'galeria' && (
              <CampoSelect
                id="pantalla-foto"
                etiqueta="¿Cuál foto?"
                value={fotoActual}
                onChange={(e) => poner({ fondo: { ...fondo, tipo: 'imagen', imagen: e.target.value } })}
              >
                {!opcionesFoto.some((o) => o.valor === fotoActual) && <option value={fotoActual}>{fotoActual}</option>}
                {opcionesFoto.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </CampoSelect>
            )}
            {opcionFondo(p) === 'color' && (
              <CampoColor
                id="pantalla-color"
                etiqueta="Color del fondo"
                valor={colorMostrado}
                error={errorColor}
                onCambiar={(c) => {
                  setTextoColor(c);
                  if (!errorColorFondo(c)) poner({ fondo: { tipo: 'color', color: c } });
                }}
              />
            )}
            {deslizadores('fondo', 'Mover la foto del fondo')}
            {sinFotos && opcionFondo(p) !== 'galeria' && (
              <p className="pv-nota-campo" role="status">
                {MENSAJE_SIN_FOTOS}{' '}
                <Link href={hrefSeccion(datos.slug, 'galeria')} className="pv-enlace pv-enlace--12">
                  Ir a Galería
                </Link>
              </p>
            )}
          </div>
          <div className="pv-estilo-grupo">
            <Segmentado etiqueta="Imagen grande" opciones={OPCIONES_IMAGEN} valor={opcionImagen(p)} onCambiar={elegirImagen} />
            {opcionImagen(p) === 'fija' && (
              <CampoSelect id="pantalla-imagen" etiqueta="¿Cuál imagen?" value={imagenActual} onChange={(e) => poner({ imagen: e.target.value })}>
                {!opcionesImagen.some((o) => o.valor === imagenActual) && <option value={imagenActual}>{imagenActual}</option>}
                {opcionesImagen.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </CampoSelect>
            )}
            {deslizadores('imagen', 'Mover la foto')}
            <CajaRevisar problemas={avisosDePantallas(borrador, vista)} />
          </div>
          <Segmentado
            etiqueta="Distribución"
            opciones={OPCIONES_DISTRIBUCION}
            valor={texto(p.distribucion) || 'izquierda'}
            onCambiar={(d) => poner({ distribucion: d })}
          />
        </>
      )}

      <section className="pv-tarjeta-opciones" aria-labelledby="pv-que-se-muestra">
        <h2 id="pv-que-se-muestra" className="pv-subtitulo">
          Qué se muestra
        </h2>
        {v.interruptores.map((i) => (
          <div key={i.elemento} className="pv-opcion-fila">
            <span className="pv-opcion-texto">
              <span className="pv-opcion-etiqueta" aria-hidden="true">
                {i.etiqueta}
              </span>
              {i.ayuda && (
                <span id={`pv-ayuda-${i.elemento}`} className="pv-opcion-ayuda">
                  {i.ayuda}
                </span>
              )}
            </span>
            <Interruptor
              etiqueta={i.etiqueta}
              activo={encendido(p, i.elemento)}
              describidoPor={i.ayuda ? `pv-ayuda-${i.elemento}` : undefined}
              onCambiar={(valor) => ponerInterruptor(i.elemento, valor)}
            />
          </div>
        ))}
      </section>

      {(TAMANOS_DE_VISTA[vista] ?? []).map((t) => (
        <Segmentado
          key={t.cual}
          etiqueta={t.etiqueta}
          opciones={OPCIONES_TAMANO_TEXTO}
          valor={tamanoDe(p, t.cual)}
          onCambiar={(valor) => poner({ tamanos: conTamano(p, t.cual, valor).tamanos })}
        />
      ))}

      {(LETRAS_DE_VISTA[vista] ?? []).map((cual) => {
        // Producción no sigue el estilo de todas las pantallas: su letra de siempre es Montserrat.
        const enProduccion = vista === 'produccion';
        const deSiempre = enProduccion ? 'montserrat' : '';
        const titulo = cual === 'titulo';
        return (
          <ListaTipografias
            key={cual}
            etiqueta={enProduccion ? 'Letra del nombre' : titulo ? 'Letra del título' : 'Letra de la frase'}
            nombre={`pantalla-letra-${cual}`}
            opciones={enProduccion ? OPCIONES_TIPOGRAFIA : titulo ? OPCIONES_LETRA_TITULO_VISTA : OPCIONES_LETRA_FRASE_VISTA}
            familias={titulo ? FAMILIA_TIPOGRAFIA : FAMILIA_LETRA_FRASE}
            valor={letraDe(p, cual, deSiempre)}
            onCambiar={(valor) => poner({ letras: conLetra(p, cual, valor, deSiempre).letras })}
          />
        );
      })}

      {v.textos.map((t) => (
        <CampoTextoDePantalla
          key={t.clave}
          campo={t}
          valor={textos[t.clave] ?? texto(objeto(p.textos)[t.clave])}
          onCambiar={(valor) => escribir(t.clave, valor)}
        />
      ))}

      {existe && (
        <div>
          <Boton variante="secundario" onClick={() => setConfirmar(true)}>
            Volver a como venía
          </Boton>
        </div>
      )}
      <Dialogo abierto={confirmar} titulo="Volver a como venía" onCerrar={() => setConfirmar(false)}>
        <p className="pv-dialogo-texto">La pantalla de {v.nombre} vuelve a verse como viene. Lo que cambiaste aquí se borra.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
          <Boton
            onClick={() => {
              setConfirmar(false);
              setTextos({});
              setTextoColor(null);
              setSinFotos(false);
              cambiar('pantallas', volverComoVenia(borrador.pantallas, vista));
            }}
          >
            Sí, volver
          </Boton>
        </div>
      </Dialogo>
    </section>
  );
}
