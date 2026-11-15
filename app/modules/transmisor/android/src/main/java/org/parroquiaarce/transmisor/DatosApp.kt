package org.parroquiaarce.transmisor

import android.content.Context
import android.util.Log
import java.io.File

/*
 * Archivos de datos privados de la app (etapa 3b): la semana bajada y los cambios pendientes.
 *
 * - La raíz es `filesDir/datos-app/`; cada archivo es `<nombre>.json`.
 * - El nombre cumple `^[a-z0-9-]{1,80}$`: sin puntos ni barras, no sale de la carpeta.
 * - Se escribe en `<nombre>.json.tmp` y se renombra, así un corte no deja un archivo a medias.
 * - `borrar`: con «-» al final es un prefijo (`semana-`); sin él, el nombre exacto (un slug
 *   nunca termina en «-», así que `semana-ciudad-arce` no borra `semana-ciudad-arce-norte`).
 * - El log lleva solo el nombre y el tamaño, nunca el contenido.
 */
object DatosApp {
  private const val TAG = "Transmisor"
  private val RE_NOMBRE = Regex("^[a-z0-9-]{1,80}$")

  private fun raiz(ctx: Context): File = File(ctx.filesDir, "datos-app").apply { mkdirs() }

  private fun validar(nombre: String) {
    if (!RE_NOMBRE.matches(nombre)) throw IllegalArgumentException("Nombre de datos inválido.")
  }

  @Synchronized
  fun leer(ctx: Context, nombre: String): String? {
    validar(nombre)
    val f = File(raiz(ctx), "$nombre.json")
    if (!f.isFile) return null
    return f.readText(Charsets.UTF_8)
  }

  @Synchronized
  fun guardar(ctx: Context, nombre: String, texto: String) {
    validar(nombre)
    val dir = raiz(ctx)
    val tmp = File(dir, "$nombre.json.tmp")
    val destino = File(dir, "$nombre.json")
    tmp.writeText(texto, Charsets.UTF_8)
    if (!tmp.renameTo(destino)) {
      destino.delete()
      if (!tmp.renameTo(destino)) {
        tmp.delete()
        throw IllegalStateException("No se pudo guardar $nombre.")
      }
    }
    Log.i(TAG, "datos-app: guardado $nombre (${texto.length} caracteres)")
  }

  @Synchronized
  fun borrar(ctx: Context, prefijo: String) {
    validar(prefijo)
    val archivos = raiz(ctx).listFiles() ?: return
    for (f in archivos) {
      val base = f.name.removeSuffix(".tmp").removeSuffix(".json")
      val toca = if (prefijo.endsWith("-")) base.startsWith(prefijo) else base == prefijo
      if (toca) f.delete()
    }
    Log.i(TAG, "datos-app: borrado $prefijo")
  }
}
