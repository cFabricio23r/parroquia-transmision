export const metadata = { title: 'Parroquias · Administración · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** D1 · Parroquias (AB/VicAdminParroquias). */
export default async function Parroquias() {
  return (
    <main className="pv-admin">
      <div className="pv-admin-cabeza">
        <h1 className="pv-admin-titulo">Parroquias de la vicaría</h1>
      </div>
    </main>
  );
}
