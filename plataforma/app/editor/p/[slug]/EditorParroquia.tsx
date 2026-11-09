'use client';
// Une el formulario de identidad y «Publicar»: publicar sube lo último guardado, así que mientras el
// formulario tenga cambios sin guardar, «Publicar» queda bloqueado (ver Versiones.tsx).
import { useState } from 'react';
import { FormularioIdentidad, type IdentidadInicial } from './FormularioIdentidad';
import { Versiones, type VersionPublicada } from './Versiones';

export function EditorParroquia(props: {
  slug: string;
  inicial: IdentidadInicial;
  actualizadoEn: string;
  errores: string[];
  urls: Record<string, string>;
  versiones: VersionPublicada[];
}) {
  const [sinGuardar, setSinGuardar] = useState(false);
  return (
    <>
      <FormularioIdentidad
        slug={props.slug}
        inicial={props.inicial}
        actualizadoEn={props.actualizadoEn}
        errores={props.errores}
        urls={props.urls}
        alCambiarSinGuardar={setSinGuardar}
      />
      <Versiones slug={props.slug} versiones={props.versiones} sinGuardar={sinGuardar} />
    </>
  );
}
