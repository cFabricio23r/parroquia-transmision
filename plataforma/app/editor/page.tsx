import { salir } from './acciones-sesion';

export default function Editor() {
  return (
    <main className="tarjeta">
      <h1>Editor de la plataforma</h1>
      <form action={salir}>
        <button className="boton" type="submit">
          Salir
        </button>
      </form>
    </main>
  );
}
