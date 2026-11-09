// Arma el borrador que se manda a la vista previa: cambia cada `src: 'medios/x'` por su URL firmada
// (el iframe no tiene sesión para pedir al Storage privado) y quita los vacíos del formulario.
// Sin dependencias de React ni de Next: se prueba sola.

/** Copia el valor sin null ni undefined y con los `src` conocidos reemplazados por su URL firmada. */
export function prepararVistaPrevia(valor: unknown, urls: Record<string, string>): unknown {
  if (Array.isArray(valor)) return valor.map((v) => prepararVistaPrevia(v, urls)).filter((v) => v !== undefined);
  if (valor !== null && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      if (clave === 'src' && typeof v === 'string' && Object.hasOwn(urls, v)) {
        salida[clave] = urls[v];
        continue;
      }
      const limpio = prepararVistaPrevia(v, urls);
      if (limpio !== undefined) salida[clave] = limpio;
    }
    return salida;
  }
  return valor === null ? undefined : valor;
}
