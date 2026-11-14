'use client';
// F10 · Horarios y redes (AB/VicEdDatos): tabla de horarios con su diálogo y los campos de redes,
// que se convierten en direcciones https:// al escribir (Decisión 13).
import { useEffect, useRef, useState } from 'react';
import { aFormaNueva, MAX_HORARIOS, textoHoras } from '../../../../../lib/editor/horarios';
import { CAMPOS_REDES, normalizarRed, ponerRed, type EntradaRed, type Red } from '../../../../../lib/editor/redes';
import { Boton } from '../../../../componentes/Boton';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Tabla } from '../../../../componentes/Tabla';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';
import { DialogoHorario } from './DialogoHorario';

export const TEXTO_HORARIOS = 'Aparecen en las pantallas de Avisos y Gracias, si los activas en cada pantalla.';

/** Un campo de red: guarda su texto local; solo lo que se puede convertir llega al borrador. */
function CampoRed({ red, etiqueta, ayuda }: { red: Red; etiqueta: string; ayuda?: string }) {
  const { borrador, cambiar } = useBorrador();
  const redes = Array.isArray(borrador.redes) ? (borrador.redes as EntradaRed[]) : undefined;
  const enBorrador = redes?.find((r) => r?.red === red)?.texto ?? '';
  const [valor, setValor] = useState(enBorrador);
  const [error, setError] = useState<string | undefined>();
  const ultimo = useRef(enBorrador);
  useEffect(() => {
    if (enBorrador !== ultimo.current) {
      ultimo.current = enBorrador;
      setValor(enBorrador);
      setError(undefined);
    }
  }, [enBorrador]);

  return (
    <CampoTexto
      id={`red-${red}`}
      etiqueta={etiqueta}
      ayuda={ayuda}
      value={valor}
      error={error}
      onChange={(e) => {
        setValor(e.target.value);
        const r = normalizarRed(red, e.target.value);
        if (r && 'error' in r) return setError(r.error);
        setError(undefined);
        ultimo.current = r ? r.texto : '';
        cambiar('redes', ponerRed(Array.isArray(borrador.redes) ? (borrador.redes as EntradaRed[]) : undefined, red, r));
      }}
    />
  );
}

export function SeccionHorariosRedes() {
  const { borrador } = useBorrador();
  const horarios = (Array.isArray(borrador.horarios) ? borrador.horarios : []).map((h) => aFormaNueva(h));
  const [dialogo, setDialogo] = useState<{ abierto: boolean; indice: number | null }>({ abierto: false, indice: null });
  const lleno = horarios.length >= MAX_HORARIOS;

  const filas = horarios.length
    ? horarios.map((h, i) => ({
        clave: String(i),
        celdas: [
          <strong key="d">{h.dia}</strong>,
          textoHoras(h),
          <span key="l" className="pv-horario-lugar">
            {h.lugar ?? ''}
          </span>,
          <Boton key="e" variante="secundario" compacto className="pv-boton-fila" aria-label={`Editar ${h.dia}`} onClick={() => setDialogo({ abierto: true, indice: i })}>
            Editar
          </Boton>,
        ],
      }))
    : [{ clave: 'vacia', celdas: [<span key="v" className="pv-horario-lugar">Todavía no hay horarios.</span>, '', '', ''] }];

  return (
    <>
      <CabezaSeccion titulo="Horarios y redes" texto={TEXTO_HORARIOS} />
      <div className="pv-fila-titulo">
        <h2 className="pv-subtitulo">Horarios de misa</h2>
        <div className="pv-galeria-subir">
          <Boton
            variante="secundario"
            ocupado={lleno}
            aria-describedby={lleno ? 'pv-horarios-lleno' : undefined}
            onClick={() => !lleno && setDialogo({ abierto: true, indice: null })}
          >
            + Agregar horario
          </Boton>
          {lleno && (
            <span id="pv-horarios-lleno" className="pv-nota-campo">
              Hasta 12 horarios.
            </span>
          )}
        </div>
      </div>
      <div className="pv-tabla-horarios">
        <Tabla
          etiqueta="Horarios de misa"
          columnas={[
            { titulo: 'Día', ancho: '160px' },
            { titulo: 'Horas', ancho: '1fr' },
            { titulo: 'Lugar', ancho: '1fr' },
            { titulo: '', ancho: '90px' },
          ]}
          filas={filas}
        />
      </div>
      <h2 className="pv-subtitulo">Redes y contacto</h2>
      <div className="pv-redes">
        {CAMPOS_REDES.map((c) => (
          <CampoRed key={c.red} red={c.red} etiqueta={c.etiqueta} ayuda={c.ayuda} />
        ))}
      </div>
      <DialogoHorario abierto={dialogo.abierto} indice={dialogo.indice} onCerrar={() => setDialogo({ abierto: false, indice: dialogo.indice })} />
    </>
  );
}
