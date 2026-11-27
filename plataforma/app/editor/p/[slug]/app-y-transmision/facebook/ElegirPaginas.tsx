'use client';
// «¿Dónde sale la misa?» (artboard C3). Fuera del borrador: guarda al tocar «Guardar páginas», por
// app/editor/api/[slug]/app/facebook/paginas. Nada de tokens: la página solo recibe nombres, ids y estados.
import Link from 'next/link';
import { useState } from 'react';
import type { VistaAsignacion } from '../../../../../../lib/facebook/asignaciones';
import type { VistaConexion } from '../../../../../../lib/facebook/conexion';
import { Boton } from '../../../../../componentes/Boton';
import { CajaInfo } from '../../../../../componentes/CajaInfo';
import { CampoSelect } from '../../../../../componentes/CampoSelect';
import { Chip } from '../../../../../componentes/Chip';
import { Dialogo } from '../../../../../componentes/Dialogo';
import { Tarjeta } from '../../../../../componentes/Tarjeta';
import { useEnvio } from '../../../../../componentes/useEnvio';

export const TITULO_ELEGIR = '¿Dónde sale la misa?';
export const TEXTO_PRINCIPAL = 'Ahí va la transmisión. Tiene que tener 100 seguidores o más.';
export const TEXTO_EXTRAS = 'La app ofrece estas páginas al voluntario. Las «marcadas por defecto» ya salen elegidas.';
export const TEXTO_AL_GUARDAR =
  'Al guardar, la plataforma pide a Facebook que esas páginas compartan los vivos de la principal. Se hace una sola vez por página.';
export const MENSAJE_ELEGIR_PRINCIPAL = 'Elige la página principal.';
export const MENSAJE_GUARDADO = 'Páginas guardadas.';
const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo';
const MINIMO_SEGUIDORES = 100;

const conPuntos = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const etiquetaPagina = (p: VistaConexion['paginas'][number]) =>
  p.seguidores === null ? p.nombre : `${p.nombre} · ${conPuntos(p.seguidores)} seguidores`;
const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

type Marca = { marcada: boolean; porDefecto: boolean };

export function ElegirPaginas({ slug, conexion, asignacion }: { slug: string; conexion: VistaConexion; asignacion: VistaAsignacion }) {
  const visibles = conexion.paginas.filter((p) => p.visible).sort(porNombre);
  const perdidas = conexion.paginas.filter((p) => !p.visible);
  const idsVisibles = new Set(visibles.map((p) => p.id));
  const volver = `/editor/p/${encodeURIComponent(slug)}/app-y-transmision`;

  const [guardada, setGuardada] = useState(asignacion);
  const [principal, setPrincipal] = useState(asignacion.principal && idsVisibles.has(asignacion.principal) ? asignacion.principal : '');
  const [marcas, setMarcas] = useState<Record<string, Marca>>(() =>
    Object.fromEntries(
      asignacion.extras.filter((e) => idsVisibles.has(e.pageId)).map((e) => [e.pageId, { marcada: true, porDefecto: e.porDefecto }]),
    ),
  );
  const [errorPrincipal, setErrorPrincipal] = useState<string | undefined>();
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ayuda, setAyuda] = useState(false);
  const { ocupado, enviar } = useEnvio();

  const elegida = visibles.find((p) => p.id === principal);
  const pocos = elegida !== undefined && elegida.seguidores !== null && elegida.seguidores < MINIMO_SEGUIDORES;
  const extrasVisibles = visibles.filter((p) => p.id !== principal);
  const crosspostDe = (id: string) => guardada.extras.find((e) => e.pageId === id)?.crosspost;
  // El permiso era de la principal anterior: si la cambió, todas se comprueban de nuevo al guardar.
  const principalCambio = principal !== guardada.principal;

  const marca = (id: string): Marca => marcas[id] ?? { marcada: false, porDefecto: false };
  const cambiarMarca = (id: string, cambio: Partial<Marca>) => {
    setEstado(null);
    setMarcas((m) => ({ ...m, [id]: { ...marca(id), ...cambio } }));
  };

  async function guardar() {
    setEstado(null);
    if (!principal) {
      setErrorPrincipal(MENSAJE_ELEGIR_PRINCIPAL);
      document.getElementById('principal')?.focus();
      return;
    }
    const extras = extrasVisibles.filter((p) => marca(p.id).marcada).map((p) => ({ pageId: p.id, porDefecto: marca(p.id).porDefecto }));
    const r = await enviar(async () => {
      const res = await fetch(`/editor/api/${encodeURIComponent(slug)}/app/facebook/paginas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal, extras }),
      });
      let cuerpo: Record<string, unknown> = {};
      try {
        cuerpo = (await res.json()) as Record<string, unknown>;
      } catch {
        // sin cuerpo
      }
      return { estado: res.status, cuerpo };
    });
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') return setEstado({ tipo: 'error', texto: MENSAJE_SIN_CONEXION });
    const { estado: codigo, cuerpo } = r.valor;
    if (codigo === 200 && Array.isArray(cuerpo.extras)) {
      setGuardada(cuerpo as unknown as VistaAsignacion);
      setEstado({ tipo: 'ok', texto: MENSAJE_GUARDADO });
    } else {
      setEstado({ tipo: 'error', texto: typeof cuerpo.error === 'string' ? cuerpo.error : MENSAJE_SIN_CONEXION });
    }
  }

  return (
    <div className="pv-fb">
      <Link href={volver} className="pv-fb-volver">
        ‹ App y transmisión
      </Link>
      <div className="pv-fb-cabeza">
        <h1 className="pv-fb-titulo">{TITULO_ELEGIR}</h1>
        <div className="pv-fb-cuenta">
          <Chip tono="verde">Conectado</Chip>
          <span>
            con la cuenta <b>{conexion.nombre}</b> · ve {visibles.length} {visibles.length === 1 ? 'página' : 'páginas'}
          </span>
        </div>
      </div>

      <Tarjeta como="section" etiqueta="Página principal" relleno={22}>
        <div className="pv-fb-principal">
          <CampoSelect
            id="principal"
            etiqueta="Página principal"
            ayuda={TEXTO_PRINCIPAL}
            error={errorPrincipal}
            className="pv-fb-select"
            value={principal}
            onChange={(e) => {
              setPrincipal(e.target.value);
              setErrorPrincipal(undefined);
              setEstado(null);
            }}
          >
            <option value="">Elige una página</option>
            {visibles.map((p) => {
              const deOtra = p.uso === 'Principal de otra parroquia';
              return (
                <option key={p.id} value={p.id} disabled={deOtra}>
                  {deOtra ? `${p.nombre} · Principal de otra parroquia` : etiquetaPagina(p)}
                </option>
              );
            })}
          </CampoSelect>
          {pocos && <Chip tono="ambar">Menos de 100 seguidores: Facebook no deja transmitir</Chip>}
        </div>
      </Tarjeta>

      <Tarjeta como="section" etiqueta="También se puede mostrar en" relleno={22}>
        <div className="pv-fb-extras">
          <h2 className="pv-subtitulo">También se puede mostrar en</h2>
          <p className="pv-fb-extras-texto">{TEXTO_EXTRAS}</p>
          {extrasVisibles.map((p) => {
            const m = marca(p.id);
            const id = `extra-${p.id}`;
            const hecho = crosspostDe(p.id);
            return (
              <div key={p.id} className="pv-fb-fila">
                <label className="pv-fb-marca" htmlFor={id}>
                  <input id={id} type="checkbox" checked={m.marcada} onChange={(e) => cambiarMarca(p.id, { marcada: e.target.checked })} />
                  {p.nombre}
                </label>
                {!m.marcada && <span className="pv-fb-estado">No marcada: no se ofrece en la app</span>}
                {m.marcada && (!hecho || principalCambio) && <span className="pv-fb-estado">Se comprueba al guardar</span>}
                {m.marcada && hecho === 'listo' && !principalCambio && <Chip tono="verde">Listo para compartir</Chip>}
                {m.marcada && hecho === 'falta' && !principalCambio && (
                  <>
                    <Chip tono="ambar">Falta permitir que comparta</Chip>
                    <button type="button" className="pv-enlace" onClick={() => setAyuda(true)}>
                      Cómo hacerlo
                    </button>
                  </>
                )}
                {m.marcada && (
                  <label className="pv-fb-defecto">
                    <input type="checkbox" checked={m.porDefecto} onChange={(e) => cambiarMarca(p.id, { porDefecto: e.target.checked })} />
                    Marcada por defecto
                  </label>
                )}
              </div>
            );
          })}
          {perdidas.map((p) => (
            <div key={p.id} className="pv-fb-fila">
              <span className="pv-fb-marca">{p.uso === 'Principal' ? 'La principal de antes' : 'Una extra de antes'}</span>
              <Chip tono="gris">Esta cuenta ya no la ve</Chip>
              <span className="pv-fb-estado">Se quita al guardar. Si la quieres, vuelve a conectar con la cuenta que la administra.</span>
            </div>
          ))}
          {extrasVisibles.length === 0 && perdidas.length === 0 && <p className="pv-fb-estado">Esta cuenta no tiene más páginas.</p>}
        </div>
      </Tarjeta>

      <CajaInfo>{TEXTO_AL_GUARDAR}</CajaInfo>
      {estado?.tipo === 'error' && (
        <div role="alert" className="pv-alerta">
          {estado.texto}
        </div>
      )}
      {estado?.tipo === 'ok' && (
        <div role="status" className="pv-fb-estado">
          {estado.texto}
        </div>
      )}
      <div className="pv-fb-acciones">
        <Boton variante="secundario" href={volver}>
          Cancelar
        </Boton>
        <Boton ocupado={ocupado} onClick={guardar}>
          Guardar páginas
        </Boton>
      </div>

      <Dialogo abierto={ayuda} titulo="Cómo permitir que la página comparta" onCerrar={() => setAyuda(false)}>
        {/* NO VERIFICADO (Tarea 0 Paso 2): el camino exacto dentro de Facebook no se comprobó. */}
        <ol className="pv-fb-pasos">
          <li>En Facebook, abre la página que falta y entra a su configuración.</li>
          <li>Busca la opción de publicaciones cruzadas y permite que la página principal comparta sus vivos ahí.</li>
          <li>Vuelve aquí y toca «Guardar páginas»: se comprueba otra vez.</li>
        </ol>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setAyuda(false)}>
            Cerrar
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}
