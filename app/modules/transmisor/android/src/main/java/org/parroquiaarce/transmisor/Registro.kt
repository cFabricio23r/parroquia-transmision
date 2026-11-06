package org.parroquiaarce.transmisor

import android.content.Context
import java.io.File

/*
 * Archivos del registro de rendimiento (Tarea 9). La línea la arma JS (src/registro/registro.ts,
 * con tests): acá solo se escribe.
 *
 * - Carpeta: getExternalFilesDir("registros"), es decir
 *   /sdcard/Android/data/org.parroquiaarce.envivo/files/registros/ (sale con `adb pull`). Si no
 *   hay almacenamiento externo, filesDir/registros.
 * - Un archivo por transmisión, registro-AAAAMMDD-HHMMSS.csv. Al abrir uno nuevo se dejan los
 *   últimos 10.
 * - Defensa extra: se rechaza una línea con salto de línea, demasiado larga o que contenga la URL
 *   o la clave de la transmisión en curso (Motor.contieneSecreto). La línea nunca va a logcat.
 */
object Registro {
  private const val MAX_ARCHIVOS = 10
  private const val MAX_LINEA = 400
  private val NOMBRE = Regex("^registro-\\d{8}-\\d{6}\\.csv$")

  private var archivo: File? = null

  fun carpeta(ctx: Context): File {
    val c = ctx.getExternalFilesDir("registros") ?: File(ctx.filesDir, "registros")
    c.mkdirs()
    return c
  }

  @Synchronized
  fun abrir(ctx: Context, nombre: String, encabezado: String) {
    require(NOMBRE.matches(nombre)) { "Nombre de registro inválido." }
    revisar(encabezado)
    val c = carpeta(ctx)
    val f = File(c, nombre)
    f.writeText(encabezado + "\n")
    archivo = f
    podar(c)
  }

  @Synchronized
  fun anotar(linea: String) {
    val f = archivo ?: return
    revisar(linea)
    f.appendText(linea + "\n")
  }

  @Synchronized
  fun cerrar() {
    archivo = null
  }

  /**
   * Ruta absoluta del registro más nuevo que tenga al menos una muestra, o null si no hay.
   * Uno que solo tiene el encabezado se saltea (review M2 de la Tarea 9).
   */
  fun ultimo(ctx: Context): String? =
    carpeta(ctx).listFiles()
      ?.filter { NOMBRE.matches(it.name) && tieneMuestras(it) }
      ?.maxByOrNull { it.name }
      ?.absolutePath

  private fun tieneMuestras(f: File): Boolean =
    try {
      f.bufferedReader().useLines { lineas -> lineas.take(2).count() >= 2 }
    } catch (e: Exception) {
      false
    }

  private fun podar(c: File) {
    val todos = c.listFiles()?.filter { NOMBRE.matches(it.name) } ?: return
    // El nombre lleva la fecha y la hora: ordenar por nombre es ordenar por tiempo.
    todos.sortedByDescending { it.name }.drop(MAX_ARCHIVOS).forEach { it.delete() }
  }

  private fun revisar(linea: String) {
    require(linea.length <= MAX_LINEA && linea.none { it == '\n' || it == '\r' }) { "Línea de registro inválida." }
    require(!Motor.contieneSecreto(linea)) { "Línea de registro inválida." }
  }
}
