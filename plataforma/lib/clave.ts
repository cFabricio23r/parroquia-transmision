// Requisitos de la contraseña, para mostrarlos mientras se escribe (A2, A4, C2).
// Sin dependencias: lo importan componentes de cliente. MINIMO_CLAVE vive aquí y lib/sesion.ts lo
// reexporta (sesion.ts importa el envío de correo, que no puede entrar al bundle del navegador).
export const MINIMO_CLAVE = 8;

/** Texto bajo «Repite la contraseña» cuando no coincide (A4). */
export const MENSAJE_CLAVES_NO_IGUALES = 'Las dos contraseñas no son iguales.';

export interface Requisito {
  texto: string;
  cumplido: boolean;
}

export function requisitosClave(clave: string, repetida: string): Requisito[] {
  return [
    { texto: 'Al menos 8 caracteres', cumplido: clave.length >= MINIMO_CLAVE },
    { texto: 'Las dos son iguales', cumplido: clave.length > 0 && clave === repetida },
  ];
}

export function claveValida(clave: string, repetida: string): boolean {
  return requisitosClave(clave, repetida).every((r) => r.cumplido);
}
