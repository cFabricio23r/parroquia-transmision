-- Límites del bucket borradores, aplicados por Storage a toda subida (también a la de un miembro
-- con su sesión que no pasa por la app): hasta 3 MB (igual que MAX_BYTES_IMAGEN de lib/imagenes.ts)
-- y solo tipos de imagen. El tipo lo declara quien sube, así que esto no reemplaza a revisarImagen:
-- publicar vuelve a revisar cada imagen (lib/publicar.ts) antes de copiarla a publicado.
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where id = 'borradores';
