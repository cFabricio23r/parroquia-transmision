'use client';
// «App y transmisión» (etapa 3c, Decisiones 6, 8 y 9). Sin artboard: se arma con los componentes del
// editor. Fuera del borrador: guarda al tocar Guardar, por las rutas de app/editor/api/[slug]/app/.
// La clave: el navegador la manda una vez y nunca la vuelve a recibir (solo `guardadaEn`); el campo se
// vacía al guardar y `recordarFormulario` recibe `valor: null`, nunca el texto.
// Sin type="password" (2026-11-23): con uno en la pantalla, Chrome la trataba como login y llenaba el servidor
// con el correo y la clave con la contraseña guardados; autocomplete="off" no vale en campos de login (MDN).
// La clave es texto tapado con `pv-campo-oculto` (-webkit-text-security).
import { useEffect, useRef, useState } from 'react';
import {
  type CalidadApp,
  type CampoApp,
  type EstadoAppTransmision,
  type EstiloFinalApp,
} from '../../../../../lib/app-transmision-reglas';
import { fechaCompleta } from '../../../../../lib/fecha';
import { Boton } from '../../../../componentes/Boton';
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

export function SeccionAppTransmision({ inicial }: { inicial: EstadoAppTransmision | null }) {
  const { datos, recordarFormulario } = useBorrador();
  const base = `/editor/api/${encodeURIComponent(datos.slug)}/app`;

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

  const conCampo = !guardadaEn || reemplazando;

  return (
    <>
      <CabezaSeccion titulo="App y transmisión" texto={TEXTO_APP} />
      <div style={pila}>
        <Tarjeta como="section" etiqueta="Facebook Live" relleno={22}>
          <div style={pila}>
            <h2 className="pv-subtitulo">Facebook Live</h2>
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
