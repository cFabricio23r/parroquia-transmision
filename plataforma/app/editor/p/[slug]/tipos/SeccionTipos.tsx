'use client';
// F7 · Tipos de transmisión (AB/VicEdTipos): la tabla de los comunes (con el grupo de la novena) y
// los propios, con su interruptor «En el panel», «Textos e imagen» y «+ Nuevo tipo» (plan 4,
// Decisiones 13–16). Los interruptores escriben enseguida; abrir la página no escribe nada.
import { useMemo } from 'react';
import {
  conFila,
  filaEncendida,
  filasComunes,
  MAX_PROPIOS,
  MENSAJE_MAX_PROPIOS,
  MENSAJE_ULTIMO_TIPO,
  puedeApagar,
} from '../../../../../lib/editor/tipos';
import { Boton } from '../../../../componentes/Boton';
import { CajaInfo } from '../../../../componentes/CajaInfo';
import { Chip } from '../../../../componentes/Chip';
import { Interruptor } from '../../../../componentes/Interruptor';
import { Tabla } from '../../../../componentes/Tabla';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';

export const TEXTO_TIPOS = 'Los que aparecen en el panel al preparar una transmisión. Los apagados no se ven.';
export const NOTA_TIPOS =
  'Los comunes los mantiene la Pastoral de Comunicaciones para todas las parroquias. Si cambias sus textos o su imagen, el cambio es solo para tu parroquia.';
export const NOTA_PROPIO_SIEMPRE = 'Los tipos propios siempre están en el panel. Para quitarlo, bórralo desde «Textos e imagen».';

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});

function NombreTipo({ nombre, descripcion }: { nombre: string; descripcion: string }) {
  return (
    <>
      <b className="pv-tipo-nombre">{nombre}</b>
      <span className="pv-tipo-descripcion">{descripcion}</span>
    </>
  );
}

export function SeccionTipos() {
  const { datos, borrador, cambiar } = useBorrador();
  const filas = useMemo(() => filasComunes(datos.tiposComunes), [datos.tiposComunes]);
  const tipos = borrador.tipos;
  const propios = (Array.isArray(objeto(tipos).propios) ? (objeto(tipos).propios as unknown[]) : []).map(objeto);
  const lleno = propios.length >= MAX_PROPIOS;
  const bloqueadas = filas.filter((f) => filaEncendida(tipos, f) && !puedeApagar(tipos, f));
  const base = `/editor/p/${datos.slug}/tipos`;

  const filasTabla = [
    ...filas.map((f) => {
      const activa = filaEncendida(tipos, f);
      const bloqueada = activa && !puedeApagar(tipos, f);
      return {
        clave: f.id,
        celdas: [
          <NombreTipo key="n" nombre={f.nombre} descripcion={f.descripcion} />,
          <Chip key="c" tono="gris">
            Común
          </Chip>,
          <Boton key="b" variante="secundario" compacto anchoCompleto href={`${base}/${f.id}`} aria-label={`Textos e imagen de ${f.nombre}`}>
            Textos e imagen
          </Boton>,
          <Interruptor
            key="i"
            etiqueta={`Mostrar ${f.nombre} en el panel`}
            activo={activa}
            bloqueado={bloqueada}
            describidoPor={bloqueada ? 'pv-tipos-ultimo' : undefined}
            onCambiar={(v) => cambiar('tipos', conFila(tipos, f, v))}
          />,
        ],
      };
    }),
    ...propios.map((p, i) => {
      const clave = String(p.clave ?? i);
      const nombre = typeof p.nombre === 'string' && p.nombre ? p.nombre : clave;
      return {
        clave: `propio:${clave}`,
        celdas: [
          <NombreTipo key="n" nombre={nombre} descripcion="Creado por la parroquia." />,
          <Chip key="c" tono="azul">
            Propio
          </Chip>,
          <Boton key="b" variante="secundario" compacto anchoCompleto href={`${base}/${clave}`} aria-label={`Textos e imagen de ${nombre}`}>
            Textos e imagen
          </Boton>,
          <Interruptor key="i" etiqueta={`Mostrar ${nombre} en el panel`} activo bloqueado describidoPor="pv-tipos-propio" onCambiar={() => {}} />,
        ],
      };
    }),
  ];

  return (
    <>
      <div className="pv-tipos-cabeza">
        <CabezaSeccion titulo="Tipos de transmisión" texto={TEXTO_TIPOS} />
        <div className="pv-tipos-nuevo">
          {lleno ? (
            <>
              <Boton aria-disabled="true" aria-describedby="pv-tipos-lleno">
                + Nuevo tipo
              </Boton>
              <span id="pv-tipos-lleno" className="pv-campo-ayuda">
                {MENSAJE_MAX_PROPIOS}
              </span>
            </>
          ) : (
            <Boton href={`${base}/nuevo`}>+ Nuevo tipo</Boton>
          )}
        </div>
      </div>
      <div className="pv-tabla-tipos">
        <Tabla
          etiqueta="Tipos de transmisión"
          columnas={[
            { titulo: 'Tipo', ancho: 'minmax(0, 1fr)' },
            { titulo: 'Origen', ancho: '110px' },
            { titulo: '', ancho: '170px' },
            { titulo: 'En el panel', ancho: '70px' },
          ]}
          filas={filasTabla}
        />
      </div>
      <span id="pv-tipos-propio" className="pv-solo-lectores">
        {NOTA_PROPIO_SIEMPRE}
      </span>
      {bloqueadas.length > 0 && (
        <p id="pv-tipos-ultimo" className="pv-nota-campo pv-tipos-ultimo" role="status">
          {MENSAJE_ULTIMO_TIPO}
        </p>
      )}
      <CajaInfo>{NOTA_TIPOS}</CajaInfo>
    </>
  );
}
