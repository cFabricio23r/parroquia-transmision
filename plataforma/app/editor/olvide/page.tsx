import Link from 'next/link';
import { AvisoEnlace, FormOlvide } from '../formularios';

export const metadata = { title: 'Recuperar la contraseña' };

export default async function Olvide({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="tarjeta">
      <h1>Recupera tu contraseña</h1>
      {error === 'enlace' && <AvisoEnlace />}
      <FormOlvide />
      <p className="enlaces">
        <Link href="/editor/entrar">Volver a entrar</Link>
      </p>
    </main>
  );
}
