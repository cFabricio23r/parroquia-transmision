'use client';
// Formulario de identidad y patrono. Conserva lo escrito pase lo que pase con el guardado:
// nunca navega ni recarga (sesión vencida, conflicto, red caída).
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { mensajeContraste, MIN_CONTRASTE, contraste } from '../../../../lib/contraste';
import { Resumen } from '../../formularios';

export interface Imagen {
  src: string;
  alt: string;
}
type Objeto = Record<string, unknown>;

/** Lo que el servidor sabe de la identidad del borrador (puede estar incompleto en una parroquia nueva). */
export interface IdentidadInicial {
  nombre?: string;
  nombreCorto?: string;
  lugar?: string;
  colores?: Objeto & { principal?: string; oscuro?: string };
  logos?: Objeto & { blanco?: Imagen; color?: Imagen };
  fachada?: Imagen;
  patrono?: Objeto & { nombre?: string; corto?: string; imagen?: Imagen };
  fiesta?: Objeto & { dia?: number; mes?: number; lema?: string };
}

export const MENSAJE_SESION_VENCIDA =
  'Tu sesión venció. Entra de nuevo en otra pestaña (en /editor/entrar) y luego vuelve aquí y guarda otra vez. Lo que escribiste sigue en esta página.';
const MENSAJE_SIN_PERMISO = 'No tienes permiso para guardar los cambios de esta parroquia.';
const MENSAJE_CONFLICTO =
  'Otra persona guardó cambios mientras editabas. Copia lo que escribiste, recarga la página para ver la versión nueva y vuelve a aplicar tus cambios.';
const MENSAJE_RED = 'No se pudo guardar. Revisa tu conexión y vuelve a intentarlo. Lo que escribiste sigue en esta página.';
const MENSAJE_FALLO = 'No se pudo guardar. Intenta de nuevo.';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const COLOR_PRINCIPAL = '#1155a4';
const COLOR_OSCURO = '#0c3562';
const RE_HEX = /^#[0-9a-fA-F]{6}$/;

interface EstadoImagen {
  src: string;
  alt: string;
  url?: string;
}
const estadoImagen = (i: Imagen | undefined, urls: Record<string, string>): EstadoImagen => ({
  src: i?.src ?? '',
  alt: i?.alt ?? '',
  url: i?.src ? urls[i.src] : undefined,
});
const imagenOCero = (e: EstadoImagen): Imagen | undefined => (e.src ? { src: e.src, alt: e.alt } : undefined);
const numero = (t: string): number | undefined => (t.trim() === '' ? undefined : Number(t));
const colorInicial = (c: string | undefined, porDefecto: string) => (c && RE_HEX.test(c) ? c : porDefecto);

function Texto(props: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  ayuda?: string;
  tipo?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
}) {
  const ayudaId = props.ayuda ? `${props.id}-ayuda` : undefined;
  return (
    <div className="campo">
      <label htmlFor={props.id}>{props.etiqueta}</label>
      <input
        id={props.id}
        name={props.id}
        type={props.tipo ?? 'text'}
        value={props.valor}
        min={props.min}
        max={props.max}
        autoComplete={props.autoComplete ?? 'off'}
        aria-describedby={ayudaId}
        onChange={(e) => props.alCambiar(e.target.value)}
      />
      {props.ayuda && (
        <p id={ayudaId} className="ayuda">
          {props.ayuda}
        </p>
      )}
    </div>
  );
}

function Color(props: { id: string; etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  const mensaje = mensajeContraste(props.valor);
  const bien = contraste('#ffffff', props.valor) >= MIN_CONTRASTE;
  return (
    <div className="campo campo-color">
      <label htmlFor={props.id}>{props.etiqueta}</label>
      <input
        id={props.id}
        name={props.id}
        type="color"
        value={props.valor}
        aria-describedby={`${props.id}-contraste`}
        onChange={(e) => props.alCambiar(e.target.value)}
      />
      <p id={`${props.id}-contraste`} className={bien ? 'contraste-bien' : 'contraste-mal'} aria-live="polite">
        Texto blanco sobre este color: {mensaje}
      </p>
    </div>
  );
}

function CampoImagen(props: {
  id: string;
  etiqueta: string; // «el logo en blanco»
  campo: string; // nombre para el archivo en el servidor
  slug: string;
  valor: EstadoImagen;
  opcional?: boolean;
  alCambiar: (v: EstadoImagen) => void;
  alErrorSesion: () => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string>();
  const errorId = error ? `${props.id}-error` : undefined;

  async function subir(e: ChangeEvent<HTMLInputElement>) {
    const entrada = e.target;
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    setError(undefined);
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append('archivo', archivo);
      datos.append('campo', props.campo);
      const r = await fetch(`/editor/api/${props.slug}/imagen`, { method: 'POST', body: datos });
      const cuerpo = (await r.json().catch(() => ({}))) as { src?: string; url?: string; error?: string };
      if (r.status === 401) {
        setError(MENSAJE_SESION_VENCIDA);
        props.alErrorSesion();
      } else if (r.ok && cuerpo.src) {
        props.alCambiar({ src: cuerpo.src, alt: props.valor.alt, url: cuerpo.url });
      } else {
        setError(cuerpo.error ?? MENSAJE_FALLO);
      }
    } catch {
      setError(MENSAJE_RED);
    } finally {
      setSubiendo(false);
      entrada.value = ''; // permite volver a elegir el mismo archivo
    }
  }

  return (
    <fieldset className="grupo-imagen">
      <legend>{props.etiqueta}</legend>
      {props.valor.src && (
        <div className="miniatura">
          {props.valor.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal; next/image no aplica
            <img src={props.valor.url} alt={props.valor.alt || `Imagen actual de ${props.etiqueta}`} />
          ) : (
            <p className="ayuda">Imagen actual: {props.valor.src}</p>
          )}
        </div>
      )}
      <div className="campo">
        <label htmlFor={`${props.id}-archivo`}>{props.valor.src ? 'Cambiar la imagen' : 'Subir la imagen'}</label>
        <input
          id={`${props.id}-archivo`}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={subiendo}
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${props.id}-ayuda`, errorId].filter(Boolean).join(' ')}
          onChange={subir}
        />
        <p id={`${props.id}-ayuda`} className="ayuda">
          PNG, JPG, WebP o SVG, hasta 3 MB.
        </p>
        {subiendo && (
          <p role="status" className="ayuda">
            Subiendo la imagen…
          </p>
        )}
        {error && (
          <p id={errorId} className="error-campo">
            {error}
          </p>
        )}
      </div>
      <Texto
        id={`${props.id}-alt`}
        etiqueta="Descripción de la imagen"
        valor={props.valor.alt}
        alCambiar={(alt) => props.alCambiar({ ...props.valor, alt })}
        ayuda="Para quien no puede verla. Por ejemplo: «Fachada del templo con la torre a la izquierda»."
      />
      {props.opcional && props.valor.src && (
        <button type="button" className="boton boton-neutro boton-corto" onClick={() => props.alCambiar({ src: '', alt: '' })}>
          Quitar esta imagen
        </button>
      )}
    </fieldset>
  );
}

export function FormularioIdentidad(props: {
  slug: string;
  inicial: IdentidadInicial;
  actualizadoEn: string;
  errores: string[];
  urls: Record<string, string>;
}) {
  const ini = props.inicial;
  const [nombre, setNombre] = useState(ini.nombre ?? '');
  const [nombreCorto, setNombreCorto] = useState(ini.nombreCorto ?? '');
  const [lugar, setLugar] = useState(ini.lugar ?? '');
  const [principal, setPrincipal] = useState(colorInicial(ini.colores?.principal, COLOR_PRINCIPAL));
  const [oscuro, setOscuro] = useState(colorInicial(ini.colores?.oscuro, COLOR_OSCURO));
  const [logoBlanco, setLogoBlanco] = useState(estadoImagen(ini.logos?.blanco, props.urls));
  const [logoColor, setLogoColor] = useState(estadoImagen(ini.logos?.color, props.urls));
  const [fachada, setFachada] = useState(estadoImagen(ini.fachada, props.urls));
  const [patronoNombre, setPatronoNombre] = useState(ini.patrono?.nombre ?? '');
  const [patronoCorto, setPatronoCorto] = useState(ini.patrono?.corto ?? '');
  const [patronoImagen, setPatronoImagen] = useState(estadoImagen(ini.patrono?.imagen, props.urls));
  const [dia, setDia] = useState(ini.fiesta?.dia === undefined ? '' : String(ini.fiesta.dia));
  const [mes, setMes] = useState(ini.fiesta?.mes === undefined ? '' : String(ini.fiesta.mes));
  const [lema, setLema] = useState(ini.fiesta?.lema ?? '');

  const [actualizadoEn, setActualizadoEn] = useState(props.actualizadoEn);
  const [errores, setErrores] = useState(props.errores);
  const [error, setError] = useState<string>();
  const [guardado, setGuardado] = useState<string>();
  const [ocupado, setOcupado] = useState(false);

  function armarCambios() {
    // Se parte de lo que ya había para no perder claves que este formulario no muestra
    // (otros colores, fiesta.cuentaDesdeDias…). Lo vacío se manda como null o se omite.
    return {
      nombre: nombre.trim(),
      nombreCorto: nombreCorto.trim() || null,
      lugar: lugar.trim(),
      colores: { ...ini.colores, principal, oscuro },
      logos: { ...ini.logos, blanco: imagenOCero(logoBlanco), color: imagenOCero(logoColor) },
      fachada: imagenOCero(fachada) ?? null,
      patrono: { ...ini.patrono, nombre: patronoNombre.trim(), corto: patronoCorto.trim(), imagen: imagenOCero(patronoImagen) },
      fiesta: { ...ini.fiesta, dia: numero(dia), mes: numero(mes), lema: lema.trim() || undefined },
    };
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined); // se vuelve a anunciar y enfocar aunque el mensaje sea el mismo
    setGuardado(undefined);
    setOcupado(true);
    try {
      const r = await fetch(`/editor/api/${props.slug}/borrador`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cambios: armarCambios(), actualizadoEn }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as { actualizadoEn?: string; errores?: string[] };
      if (r.ok && cuerpo.actualizadoEn) {
        setActualizadoEn(cuerpo.actualizadoEn);
        setErrores(cuerpo.errores ?? []);
        setGuardado('Borrador guardado.');
      } else if (r.status === 401) setError(MENSAJE_SESION_VENCIDA);
      else if (r.status === 403) setError(MENSAJE_SIN_PERMISO);
      else if (r.status === 409) setError(MENSAJE_CONFLICTO);
      else setError(MENSAJE_FALLO);
    } catch {
      setError(MENSAJE_RED);
    } finally {
      setOcupado(false);
    }
  }

  const sesionVencida = () => setError(MENSAJE_SESION_VENCIDA);

  return (
    <form onSubmit={guardar} noValidate>
      <Resumen mensaje={error} />

      <fieldset className="grupo">
        <legend>La parroquia</legend>
        <Texto id="nombre" etiqueta="Nombre de la parroquia" valor={nombre} alCambiar={setNombre} />
        <Texto id="nombreCorto" etiqueta="Nombre corto (opcional)" valor={nombreCorto} alCambiar={setNombreCorto} ayuda="Se usa donde el nombre completo no cabe." />
        <Texto id="lugar" etiqueta="Lugar" valor={lugar} alCambiar={setLugar} ayuda="Ciudad o población. Por ejemplo: Ciudad Arce." />
      </fieldset>

      <fieldset className="grupo">
        <legend>Colores</legend>
        <Color id="color-principal" etiqueta="Color principal" valor={principal} alCambiar={setPrincipal} />
        <Color id="color-oscuro" etiqueta="Color oscuro" valor={oscuro} alCambiar={setOscuro} />
      </fieldset>

      <fieldset className="grupo">
        <legend>Imágenes</legend>
        <CampoImagen id="logo-blanco" etiqueta="Logo en blanco" campo="logo-blanco" slug={props.slug} valor={logoBlanco} alCambiar={setLogoBlanco} alErrorSesion={sesionVencida} />
        <CampoImagen id="logo-color" etiqueta="Logo a color (opcional)" campo="logo-color" slug={props.slug} valor={logoColor} opcional alCambiar={setLogoColor} alErrorSesion={sesionVencida} />
        <CampoImagen id="fachada" etiqueta="Fachada del templo" campo="fachada" slug={props.slug} valor={fachada} alCambiar={setFachada} alErrorSesion={sesionVencida} />
      </fieldset>

      <fieldset className="grupo">
        <legend>Patrono</legend>
        <Texto id="patrono-nombre" etiqueta="Nombre del patrono" valor={patronoNombre} alCambiar={setPatronoNombre} ayuda="Por ejemplo: Inmaculada Concepción de María." />
        <Texto id="patrono-corto" etiqueta="Nombre corto del patrono" valor={patronoCorto} alCambiar={setPatronoCorto} ayuda="Por ejemplo: Inmaculada." />
        <CampoImagen id="patrono-imagen" etiqueta="Imagen del patrono (opcional)" campo="patrono" slug={props.slug} valor={patronoImagen} opcional alCambiar={setPatronoImagen} alErrorSesion={sesionVencida} />
      </fieldset>

      <fieldset className="grupo">
        <legend>Fiesta patronal</legend>
        <Texto id="fiesta-dia" etiqueta="Día de la fiesta" tipo="number" min={1} max={31} valor={dia} alCambiar={setDia} />
        <div className="campo">
          <label htmlFor="fiesta-mes">Mes de la fiesta</label>
          <select id="fiesta-mes" name="fiesta-mes" value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Elige el mes</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <Texto id="fiesta-lema" etiqueta="Lema de la fiesta (opcional)" valor={lema} alCambiar={setLema} />
      </fieldset>

      {guardado && (
        <p role="status" className="aviso">
          {guardado}
        </p>
      )}
      <button className="boton" type="submit" disabled={ocupado}>
        Guardar borrador
      </button>

      <section aria-labelledby="falta-titulo" className="falta">
        <h2 id="falta-titulo">{errores.length ? 'Para poder publicar falta:' : 'Para poder publicar'}</h2>
        {errores.length ? (
          <ul>
            {errores.map((m, i) => (
              <li key={`${i}-${m}`}>{m}</li>
            ))}
          </ul>
        ) : (
          <p>No falta nada.</p>
        )}
      </section>
    </form>
  );
}
