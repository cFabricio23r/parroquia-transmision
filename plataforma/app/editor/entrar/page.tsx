import Link from 'next/link';
import { FormEntrar } from '../formularios';

export const metadata = { title: 'Entrar al editor' };

export default function Entrar() {
  return (
    <main className="tarjeta">
      <h1>Entrar al editor</h1>
      <FormEntrar />
      <p className="enlaces">
        <Link href="/editor/olvide">Olvidé mi contraseña</Link>
      </p>
    </main>
  );
}
