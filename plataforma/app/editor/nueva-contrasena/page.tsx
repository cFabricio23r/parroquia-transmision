import { FormNuevaClave } from '../formularios';

export const metadata = { title: 'Elige tu contraseña nueva' };

export default function NuevaContrasena() {
  return (
    <main className="tarjeta">
      <h1>Elige tu contraseña nueva</h1>
      <FormNuevaClave />
    </main>
  );
}
