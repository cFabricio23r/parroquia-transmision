'use client';
// «App y transmisión» (etapa 3c, Decisiones 6, 8 y 9). Sin artboard: se arma con los componentes del
// editor. Fuera del borrador: guarda al tocar Guardar, por las rutas de app/editor/api/[slug]/app/.
// La clave: el navegador la manda una vez y nunca la vuelve a recibir (solo `guardadaEn`); el campo se
// vacía al guardar y `recordarFormulario` recibe `valor: null`, nunca el texto.
// Sin type="password" (2026-11-23): con uno en la pantalla, Chrome la trataba como login y llenaba el servidor
// con el correo y la clave con la contraseña guardados; autocomplete="off" no vale en campos de login (MDN).
// La clave es texto tapado con `pv-campo-oculto` (-webkit-text-security).
// La tarjeta «Facebook de la parroquia» (Tarea 6 del plan de Facebook en vivo) va arriba de todo, con los
// artboards C1, C4 y D1; con `?error=no-invitada` la pantalla es D2. Solo recibe nombres, nunca tokens ni page_id.
import { useEffect, useRef, useState } from 'react';
import {
  type CalidadApp,
  type CampoApp,
  type EstadoAppTransmision,
  type EstiloFinalApp,
  type FacebookApp,
} from '../../../../../lib/app-transmision-reglas';
import { fechaCompleta, fechaDiaMesCorta } from '../../../../../lib/fecha';
import { Boton, clasesBoton } from '../../../../componentes/Boton';
import { CajaInfo } from '../../../../componentes/CajaInfo';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { Segmentado } from '../../../../componentes/Segmentado';
import { Tarjeta } from '../../../../componentes/Tarjeta';
import { useEnvio } from '../../../../componentes/useEnvio';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';

export const TEXTO_APP =
  'Lo que baja la app Parroquia en vivo en los celulares de la parroquia. Se guarda al tocar Guardar y no pasa por Publicar: la app lo baja la próxima vez que se abre con internet.';
export const MENSAJE_GUARDADO_APP = 'Guardado. Los celulares lo bajan la próxima vez que abren la app con internet.';
export const MENSAJE_SIN_LEER_APP = 'No se pudieron leer los ajustes de la app. Recarga la página.';
const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo';
const CLAVE_FORMULARIO = 'app';

export const TEXTO_FB_SIN_CONECTAR =
  'Conecta la cuenta de Facebook que administra las páginas de la parroquia. Después eliges en qué página sale la misa y en cuáles más se muestra.';
export const NOTA_FB_INVITAR =
  'Antes, la Pastoral de Comunicaciones tiene que invitar la cuenta de Facebook de la parroquia. Se pide una sola vez.';
export const TEXTO_FB_RECONECTAR =
  'Facebook ya no acepta el acceso guardado. Pasa si se cambió la contraseña de la cuenta o se quitó el permiso. Las páginas elegidas se mantienen.';
export const AVISO_FB_RECONECTAR =
  'Facebook se desconectó. La app transmite con la clave de transmisión de respaldo hasta que vuelvas a conectar.';
export const MENSAJE_FB_SIN_LEER = 'No se pudo leer el estado de Facebook. Recarga la página.';
export const MENSAJE_FB_ERROR = 'No se pudo conectar con Facebook. Intenta de nuevo';
export const TITULO_FB_NO_INVITADA = 'Esta cuenta de Facebook todavía no puede conectarse';
const NOTA_RESPALDO_SIN_CONECTAR = 'Mientras no conectes Facebook, la app transmite con esta clave de transmisión, como hoy.';
const NOTA_RESPALDO_RECONECTAR = 'Mientras tanto, la app transmite con esta clave de transmisión a la página principal.';
const notaRespaldoConectado = (principal: string | null) =>
  `Se usa solo si Facebook no responde al iniciar. Tiene que ser la clave de transmisión de la página principal${principal ? `, ${principal}` : ''}.`;

type Cuerpo = { error?: string; errores?: Partial<Record<CampoApp, string>>; guardadaEn?: string } & Record<string, unknown>;

async function pedir(url: string, metodo: 'PUT' | 'DELETE', cuerpo?: unknown): Promise<{ estado: number; cuerpo: Cuerpo }> {
  const r = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let c: Cuerpo = {};
  try {
    c = (await r.json()) as Cuerpo;
  } catch {
    // sin cuerpo
  }
  return { estado: r.status, cuerpo: c };
}

const pila = { display: 'grid', gap: 16 } as const;
const fila = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' } as const;

const FB_VACIO: FacebookApp = { estado: 'sin-conectar', cuenta: null, conectadoPor: null, conectadoEn: null, principal: null, extras: [] };

function ChipEstadoFacebook({ estado }: { estado: FacebookApp['estado'] }) {
  if (estado === 'conectado') return <span className="pv-chip pv-chip--verde">Conectado</span>;
  if (estado === 'reconectar') return <span className="pv-chip pv-chip--ambar">Hay que volver a conectar</span>;
  return <span className="pv-chip pv-chip--gris">Sin conectar</span>;
}

/** «También se puede mostrar en: Vicaría (marcada por defecto), Sector 3.» */
const textoExtras = (extras: FacebookApp['extras']) =>
  `También se puede mostrar en: ${extras.map((e) => (e.porDefecto ? `${e.nombre} (marcada por defecto)` : e.nombre)).join(', ')}.`;

export function SeccionAppTransmision({
  inicial,
  errorFacebook = null,
}: {
  inicial: EstadoAppTransmision | null;
  /** `?error=` de la vuelta de Facebook: «no-invitada» (D2) o «1» (otra falla). */
  errorFacebook?: string | null;
}) {
  const { datos, recordarFormulario } = useBorrador();
  const base = `/editor/api/${encodeURIComponent(datos.slug)}/app`;
  const seccion = `/editor/p/${encodeURIComponent(datos.slug)}/app-y-transmision`;
  const rutaConectar = `${seccion}/facebook/conectar`;
  const [facebook, setFacebook] = useState<FacebookApp | null>(inicial?.facebook ?? null);
  const [desconectando, setDesconectando] = useState(false);
  const [errorFb, setErrorFb] = useState<string | null>(null);
  const enfocarConectar = useRef(false);
  const envioFb = useEnvio();

  const [guardados, setGuardados] = useState({
    servidor: inicial?.ajustes?.servidor ?? '',
    calidadDefecto: (inicial?.ajustes?.calidadDefecto ?? '720p') as CalidadApp,
    estiloFinal: (inicial?.ajustes?.estiloFinal ?? 'azul') as EstiloFinalApp,
  });
  const [servidor, setServidor] = useState(guardados.servidor);
  const [calidad, setCalidad] = useState<CalidadApp>(guardados.calidadDefecto);
  const [estilo, setEstilo] = useState<EstiloFinalApp>(guardados.estiloFinal);
  const [errores, setErrores] = useState<Partial<Record<CampoApp, string>>>({});
  const [estadoAjustes, setEstadoAjustes] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [guardadaEn, setGuardadaEn] = useState<string | null>(inicial?.clave?.guardadaEn ?? null);
  const [reemplazando, setReemplazando] = useState(false);
  const [clave, setClave] = useState('');
  const [errorClave, setErrorClave] = useState<string | undefined>();
  const [errorGeneralClave, setErrorGeneralClave] = useState<string | null>(null);
  const [quitando, setQuitando] = useState(false);
  const enfocarReemplazar = useRef(false);

  const envioAjustes = useEnvio();
  const envioClave = useEnvio();

  const sucio =
    servidor.trim() !== guardados.servidor || calidad !== guardados.calidadDefecto || estilo !== guardados.estiloFinal || clave !== '';
  useEffect(() => {
    recordarFormulario(CLAVE_FORMULARIO, sucio ? { valor: null, sucio: true } : undefined);
    // recordarFormulario hace siempre lo mismo, pero cambia de identidad en cada render del proveedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucio]);
  // Al salir de la sección no queda nada que recuperar (valor: null): se olvida.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => recordarFormulario(CLAVE_FORMULARIO, undefined), []);

  useEffect(() => {
    if (enfocarReemplazar.current && guardadaEn && !reemplazando) {
      enfocarReemplazar.current = false;
      document.getElementById('app-reemplazar')?.focus();
    }
  }, [guardadaEn, reemplazando]);

  useEffect(() => {
    if (enfocarConectar.current && facebook?.estado === 'sin-conectar') {
      enfocarConectar.current = false;
      document.getElementById('fb-conectar')?.focus();
    }
  }, [facebook]);

  if (errorFacebook === 'no-invitada') {
    return (
      <div className="pv-fbt-pantalla">
        <a href={seccion} className="pv-fb-volver">
          ‹ App y transmisión
        </a>
        <section role="alert" className="pv-fbt-no-invitada">
          <h1 className="pv-fbt-titulo">{TITULO_FB_NO_INVITADA}</h1>
          <p className="pv-fbt-no-invitada-texto">
            Pide a la Pastoral de Comunicaciones que invite la cuenta de Facebook de la parroquia. Cuando la cuenta acepte la invitación en Facebook,
            vuelve a intentarlo.
          </p>
          <div className="pv-fbt-acciones">
            {/* <a> y no <Link>: es una ruta que redirige a Facebook y no se debe precargar. */}
            <a href={rutaConectar} className={clasesBoton()}>
              Intentar de nuevo
            </a>
            <a href={seccion} className={clasesBoton('secundario')}>
              Volver
            </a>
          </div>
        </section>
        <div className="pv-fbt-nota">Mientras tanto, la app sigue transmitiendo con la clave de transmisión de la parroquia.</div>
      </div>
    );
  }

  if (!inicial) {
    return (
      <>
        <CabezaSeccion titulo="App y transmisión" texto={TEXTO_APP} />
        <div className="pv-alerta" role="alert">
          {MENSAJE_SIN_LEER_APP}
        </div>
      </>
    );
  }

  async function guardarAjustes() {
    setEstadoAjustes(null);
    const r = await envioAjustes.enviar(() => pedir(base, 'PUT', { servidor, calidadDefecto: calidad, estiloFinal: estilo }));
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') return setEstadoAjustes({ tipo: 'error', texto: MENSAJE_SIN_CONEXION });
    const { estado, cuerpo } = r.valor;
    if (estado === 200) {
      const s = typeof cuerpo.servidor === 'string' ? cuerpo.servidor : '';
      setGuardados({ servidor: s, calidadDefecto: calidad, estiloFinal: estilo });
      setServidor(s);
      setErrores({});
      setEstadoAjustes({ tipo: 'ok', texto: MENSAJE_GUARDADO_APP });
    } else {
      setErrores(cuerpo.errores ?? {});
      setEstadoAjustes({ tipo: 'error', texto: cuerpo.error ?? MENSAJE_SIN_CONEXION });
    }
  }

  async function guardarLaClave() {
    setErrorGeneralClave(null);
    const r = await envioClave.enviar(() => pedir(`${base}/clave`, 'PUT', { clave }));
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') return setErrorGeneralClave(MENSAJE_SIN_CONEXION);
    const { estado, cuerpo } = r.valor;
    if (estado === 200 && typeof cuerpo.guardadaEn === 'string') {
      setClave('');
      setErrorClave(undefined);
      setReemplazando(false);
      enfocarReemplazar.current = true;
      setGuardadaEn(cuerpo.guardadaEn);
    } else if (estado === 422) {
      setErrorClave(cuerpo.error);
    } else {
      setErrorGeneralClave(cuerpo.error ?? MENSAJE_SIN_CONEXION);
    }
  }

  async function quitarLaClave() {
    setErrorGeneralClave(null);
    const r = await envioClave.enviar(() => pedir(`${base}/clave`, 'DELETE'));
    if (r.tipo === 'ocupado') return;
    setQuitando(false);
    if (r.tipo === 'fallo') return setErrorGeneralClave(MENSAJE_SIN_CONEXION);
    if (r.valor.estado === 200) {
      setGuardadaEn(null);
      setReemplazando(false);
      setClave('');
    } else setErrorGeneralClave(r.valor.cuerpo.error ?? MENSAJE_SIN_CONEXION);
  }

  async function desconectarFacebook() {
    setErrorFb(null);
    const r = await envioFb.enviar(() => pedir(`${base}/facebook/conexion`, 'DELETE'));
    if (r.tipo === 'ocupado') return;
    setDesconectando(false);
    if (r.tipo === 'fallo') return setErrorFb(MENSAJE_SIN_CONEXION);
    if (r.valor.estado === 200) {
      enfocarConectar.current = true;
      setFacebook(FB_VACIO);
    } else setErrorFb(r.valor.cuerpo.error ?? MENSAJE_SIN_CONEXION);
  }

  const conCampo = !guardadaEn || reemplazando;
  const estadoFb = facebook?.estado ?? null;

  return (
    <>
      {estadoFb === 'reconectar' && (
        <div role="alert" className="pv-fbt-aviso">
          {AVISO_FB_RECONECTAR}
        </div>
      )}
      <CabezaSeccion titulo="App y transmisión" texto={TEXTO_APP} />
      <div style={pila}>
        <Tarjeta como="section" etiqueta="Facebook de la parroquia" relleno={22}>
          <div className="pv-fbt-tarjeta">
            <div className="pv-fbt-cabeza">
              <h2 className="pv-subtitulo pv-fbt-cabeza-titulo">Facebook de la parroquia</h2>
              {estadoFb && <ChipEstadoFacebook estado={estadoFb} />}
            </div>
            {errorFacebook === '1' && (
              <div className="pv-alerta" role="alert">
                {MENSAJE_FB_ERROR}
              </div>
            )}
            {!facebook && (
              <div className="pv-alerta" role="alert">
                {MENSAJE_FB_SIN_LEER}
              </div>
            )}
            {facebook?.estado === 'sin-conectar' && (
              <>
                <p className="pv-fbt-texto">{TEXTO_FB_SIN_CONECTAR}</p>
                <div>
                  {/* <a> y no <Link>: es una ruta que redirige a Facebook y no se debe precargar. */}
                  <a id="fb-conectar" href={rutaConectar} className={clasesBoton()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                    Conectar con Facebook
                  </a>
                </div>
                <CajaInfo>{NOTA_FB_INVITAR}</CajaInfo>
              </>
            )}
            {facebook?.estado === 'conectado' && (
              <>
                <div className="pv-fbt-cuenta">
                  Con la cuenta {facebook.cuenta}
                  {' · '}
                  {facebook.conectadoPor ? `la conectó ${facebook.conectadoPor}` : 'conectada'}
                  {facebook.conectadoEn ? ` el ${fechaDiaMesCorta(facebook.conectadoEn)}` : ''}
                </div>
                <div className="pv-fbt-sale">
                  <div className="pv-fbt-sale-rotulo">SALE EN</div>
                  <div className="pv-fbt-sale-principal">{facebook.principal ?? 'Todavía no elegiste dónde sale la misa.'}</div>
                  {facebook.extras.length > 0 && <div className="pv-fbt-sale-extras">{textoExtras(facebook.extras)}</div>}
                </div>
                <div className="pv-fbt-acciones">
                  <Boton href={`${seccion}/facebook`}>Cambiar páginas</Boton>
                  <a href={rutaConectar} className={clasesBoton('secundario')}>
                    Volver a conectar
                  </a>
                  <Boton variante="peligro" onClick={() => setDesconectando(true)}>
                    Desconectar Facebook
                  </Boton>
                </div>
              </>
            )}
            {facebook?.estado === 'reconectar' && (
              <>
                <p className="pv-fbt-texto">{TEXTO_FB_RECONECTAR}</p>
                <div>
                  <a href={rutaConectar} className={clasesBoton()}>
                    Volver a conectar
                  </a>
                </div>
              </>
            )}
            {errorFb && (
              <div className="pv-alerta" role="alert">
                {errorFb}
              </div>
            )}
          </div>
        </Tarjeta>

        <Tarjeta como="section" etiqueta="Clave de transmisión de respaldo" relleno={22}>
          <div style={pila}>
            <h2 className="pv-subtitulo">Clave de transmisión de respaldo</h2>
            {facebook?.estado === 'sin-conectar' && <p className="pv-fbt-texto">{NOTA_RESPALDO_SIN_CONECTAR}</p>}
            {facebook?.estado === 'conectado' && <CajaInfo>{notaRespaldoConectado(facebook.principal)}</CajaInfo>}
            {facebook?.estado === 'reconectar' && <p className="pv-fbt-texto">{NOTA_RESPALDO_RECONECTAR}</p>}
            <CampoTexto
              id="app-servidor"
              etiqueta="Servidor (lo muestra Facebook)"
              placeholder="rtmps://…"
              ayuda="Empieza con rtmps://. Si lo dejas vacío, cada celular pone el suyo."
              error={errores.servidor}
              value={servidor}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                setServidor(e.target.value);
                if (errores.servidor) setErrores((x) => ({ ...x, servidor: undefined }));
              }}
            />
            {conCampo ? (
              <div style={pila}>
                <CampoTexto
                  id="app-clave"
                  etiqueta="Clave de transmisión de la página"
                  type="text"
                  className="pv-campo-oculto"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  ayuda="Se escribe o se pega una vez. Después no se vuelve a mostrar."
                  error={errorClave}
                  value={clave}
                  onChange={(e) => {
                    setClave(e.target.value);
                    setErrorClave(undefined);
                  }}
                />
                <div style={fila}>
                  <Boton variante="secundario" ocupado={envioClave.ocupado} onClick={guardarLaClave}>
                    {reemplazando ? 'Guardar la clave nueva' : 'Guardar la clave'}
                  </Boton>
                  {reemplazando && (
                    <Boton
                      variante="secundario"
                      onClick={() => {
                        setReemplazando(false);
                        setClave('');
                        setErrorClave(undefined);
                        enfocarReemplazar.current = true;
                      }}
                    >
                      Cancelar
                    </Boton>
                  )}
                </div>
              </div>
            ) : (
              <div style={fila}>
                <span>Clave guardada el {fechaCompleta(guardadaEn as string)} ·</span>
                <Boton id="app-reemplazar" variante="secundario" compacto onClick={() => setReemplazando(true)}>
                  Reemplazar
                </Boton>
                <Boton variante="peligro" compacto onClick={() => setQuitando(true)}>
                  Quitar
                </Boton>
              </div>
            )}
            {errorGeneralClave && (
              <div className="pv-alerta" role="alert">
                {errorGeneralClave}
              </div>
            )}
          </div>
        </Tarjeta>

        <Tarjeta como="section" etiqueta="Video y pantalla final" relleno={22}>
          <div style={pila}>
            <h2 className="pv-subtitulo">Video y pantalla final</h2>
            <div>
              <Segmentado<CalidadApp>
                etiqueta="Calidad por defecto"
                opciones={[
                  { valor: '720p', texto: '720p · recomendado' },
                  { valor: '1080p', texto: '1080p' },
                ]}
                valor={calidad}
                onCambiar={setCalidad}
              />
              <p className="pv-campo-ayuda">Cada celular puede cambiarla.</p>
            </div>
            <Segmentado<EstiloFinalApp>
              etiqueta="Pantalla final"
              opciones={[
                { valor: 'claro', texto: 'Claro' },
                { valor: 'azul', texto: 'Azul' },
              ]}
              valor={estilo}
              onCambiar={setEstilo}
            />
            <CajaInfo>El micrófono se elige en cada celular.</CajaInfo>
          </div>
        </Tarjeta>

        <div style={fila}>
          <Boton ocupado={envioAjustes.ocupado} onClick={guardarAjustes}>
            Guardar
          </Boton>
          {estadoAjustes?.tipo === 'ok' && <span role="status">{estadoAjustes.texto}</span>}
        </div>
        {estadoAjustes?.tipo === 'error' && (
          <div className="pv-alerta" role="alert">
            {estadoAjustes.texto}
          </div>
        )}
      </div>

      <Dialogo abierto={desconectando} titulo="¿Desconectar Facebook?" onCerrar={() => setDesconectando(false)}>
        <p className="pv-dialogo-texto">
          La app transmite con la clave de transmisión de respaldo hasta que vuelvas a conectar. Las páginas elegidas se mantienen.
        </p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setDesconectando(false)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" ocupado={envioFb.ocupado} onClick={desconectarFacebook}>
            Desconectar Facebook
          </Boton>
        </div>
      </Dialogo>

      <Dialogo abierto={quitando} titulo="¿Quitar la clave?" onCerrar={() => setQuitando(false)}>
        <p className="pv-dialogo-texto">Los celulares que la usan la van a pedir la próxima vez que abran la app con internet.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setQuitando(false)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" ocupado={envioClave.ocupado} onClick={quitarLaClave}>
            Quitar la clave
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
