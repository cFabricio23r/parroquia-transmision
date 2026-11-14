import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Ruta vieja de la administración de una parroquia: ahora es Coordinadores filtrado (spec, sección 2). */
export default async function PaginaParroquiaVieja({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/editor/admin/coordinadores?parroquia=${encodeURIComponent(slug)}`);
}
