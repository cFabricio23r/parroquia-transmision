package org.parroquiaarce.transmisor

import android.content.Context
import android.util.Log
import expo.modules.kotlin.exception.CodedException
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/*
 * La copia guardada de cada parroquia (etapa 3a, decisiones 1 a 3 del plan).
 *
 * - `filesDir/copias/<slug>/actual/` es la copia que se sirve; `nueva/` es la que se está bajando.
 * - Una copia tiene las páginas comunes (`manifiesto.paginas`), el `config.json` que la app ya
 *   bajó y validó, y las imágenes que nombra (`medios/…`). `fuentes/` e `img/` salen siempre
 *   del respaldo (`assets/vicaria/`), que arma scripts/copiar-vicaria.js.
 * - Con la copia congelada (en vivo) nada cambia: `descargar` descarta lo bajado y rechaza
 *   EN_VIVO, y `fijar`, `borrar` y `borrarTodo` también rechazan.
 *
 * Seguro entre hilos: `fijar` y `fijarEnVivo` corren en el principal, `descargar` en la cola de
 * fondo y `abrir` en el hilo de red del WebView. El cambio de `nueva` por `actual` y el
 * congelado usan el mismo bloqueo (`synchronized(this)`).
 */
object Copias {
  private const val TAG = "Transmisor"
  private const val PLAZO_MS = 20_000
  private const val MAX_ARCHIVO = 15L * 1024 * 1024
  private const val MAX_COPIA = 80L * 1024 * 1024

  // Las mismas reglas que src/plataforma/direcciones.ts (Tarea 4).
  private val RE_ORIGEN = Regex("^https://[a-z0-9.-]+(:\\d{1,5})?$")
  private val RE_SLUG = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
  val RE_MEDIO = Regex("^medios/[A-Za-z0-9._-]+\\.(png|jpe?g|webp|svg)$", RegexOption.IGNORE_CASE)
  // Imágenes con nombre con hash (vicaria/vercel.json): no cambian nunca, se reutilizan.
  private val RE_MEDIO_CON_HASH = Regex("^medios/v\\d+-[a-z0-9-]+-[0-9a-f]{8}\\.(png|jpg|webp|svg)$")

  private class Manifiesto(val paginas: List<String>, val estaticos: Set<String>)

  @Volatile var origen: String? = null
    private set
  @Volatile var slug: String? = null
    private set
  @Volatile var congelada = false
    private set
  @Volatile private var manifiesto: Manifiesto? = null
  @Volatile private var raiz: File? = null

  // Una descarga a la vez: dos a la vez de la misma parroquia se pisarían en `nueva/`.
  private val bajando = Any()

  fun esSlugValido(s: String): Boolean = s.length in 3..40 && RE_SLUG.matches(s)

  /** Lee el manifiesto del respaldo y fija la raíz. Sin efecto si ya se hizo. */
  fun preparar(ctx: Context) {
    if (raiz != null && manifiesto != null) return
    synchronized(this) {
      if (raiz == null) raiz = File(ctx.applicationContext.filesDir, "copias")
      if (manifiesto == null) manifiesto = leerManifiesto(ctx)
    }
  }

  private fun leerManifiesto(ctx: Context): Manifiesto {
    return try {
      val texto = ctx.assets.open("vicaria/manifiesto.json").bufferedReader().use { it.readText() }
      val j = JSONObject(texto)
      Manifiesto(lista(j.optJSONArray("paginas")), lista(j.optJSONArray("estaticos")).toSet())
    } catch (e: Exception) {
      // Sin respaldo (no se corrió copiar-vicaria): se sigue, pero sin páginas que servir ni bajar.
      Log.w(TAG, "copias: sin manifiesto del respaldo")
      Manifiesto(emptyList(), emptySet())
    }
  }

  private fun lista(a: JSONArray?): List<String> {
    if (a == null) return emptyList()
    return (0 until a.length()).mapNotNull { a.opt(it) as? String }
  }

  /** true si `resto` es una de las páginas comunes. */
  fun esPagina(resto: String): Boolean = manifiesto?.paginas?.contains(resto) == true

  /** true si `resto` está en el respaldo dentro de la app (`assets/vicaria/`). */
  fun enPaquete(resto: String): Boolean {
    val m = manifiesto ?: return false
    return resto in m.paginas || resto in m.estaticos
  }

  /**
   * Elige la plataforma y la parroquia. Devuelve true si cambió algo. Lanza si el origen o el
   * slug no valen, y EN_VIVO con la copia congelada.
   */
  fun fijar(nuevoOrigen: String, nuevoSlug: String): Boolean {
    if (!RE_ORIGEN.matches(nuevoOrigen) || !esSlugValido(nuevoSlug)) {
      throw CodedException("ERR_PARROQUIA", "Parroquia inválida.", null)
    }
    synchronized(this) {
      if (congelada) throw enVivo()
      val cambio = nuevoOrigen != origen || nuevoSlug != slug
      origen = nuevoOrigen
      slug = nuevoSlug
      return cambio
    }
  }

  /** Olvida la plataforma y la parroquia (cierre de sesión). Lanza EN_VIVO con la copia congelada. */
  fun olvidarParroquia() {
    synchronized(this) {
      if (congelada) throw enVivo()
      origen = null
      slug = null
    }
  }

  fun fijarEnVivo(b: Boolean) {
    synchronized(this) { congelada = b }
    Log.w(TAG, "copias: congelada=$b")
  }

  /**
   * Abre `resto` de la copia actual de `slug`, o null si no está. Solo nombres conocidos: una
   * página común, `config.json` o un medio; nunca una ruta armada con otra cosa.
   */
  fun abrir(slug: String, resto: String): InputStream? {
    if (!esSlugValido(slug)) return null
    if (!(esPagina(resto) || resto == "config.json" || RE_MEDIO.matches(resto))) return null
    val r = raiz ?: return null
    synchronized(this) {
      val f = File(File(File(r, slug), "actual"), resto)
      // Se abre dentro del bloqueo: si después se cambia la copia, el archivo abierto sigue leyéndose.
      return if (f.isFile) FileInputStream(f) else null
    }
  }

  /** `{version, guardadaEn}` de la copia actual, o null. */
  fun estado(slug: String): Map<String, Any>? {
    if (!esSlugValido(slug)) return null
    val r = raiz ?: return null
    val j = leerCopiaJson(File(File(r, slug), "actual")) ?: return null
    val version = j.optInt("version", 0)
    val guardadaEn = j.optString("guardadaEn", "")
    if (version < 1 || guardadaEn.isEmpty()) return null
    return mapOf("version" to version, "guardadaEn" to guardadaEn)
  }

  fun borrar(slug: String) {
    if (!esSlugValido(slug)) throw CodedException("ERR_PARROQUIA", "Parroquia inválida.", null)
    val r = raiz ?: return
    synchronized(this) {
      if (congelada) throw enVivo()
      File(r, slug).deleteRecursively()
    }
    Log.w(TAG, "copias: borrada $slug")
  }

  fun borrarTodo() {
    val r = raiz ?: return
    synchronized(this) {
      if (congelada) throw enVivo()
      r.deleteRecursively()
    }
    Log.w(TAG, "copias: borradas todas")
  }

  /**
   * Baja la copia de `slug` a `nueva/` y, si no está congelada, la cambia por `actual/`.
   * Corre fuera del hilo principal. Devuelve `{version, guardadaEn, paginasCambiaron}`.
   */
  fun descargar(slugPedido: String, config: String, medios: List<String>): Map<String, Any> {
    if (!esSlugValido(slugPedido)) throw CodedException("ERR_PARROQUIA", "Parroquia inválida.", null)
    for (m in medios) {
      if (!RE_MEDIO.matches(m)) throw CodedException("ERR_MEDIO", "Medio inválido.", null)
    }
    val base = origen ?: throw CodedException("SIN_PARROQUIA", "Falta elegir la parroquia.", null)
    val r = raiz ?: throw CodedException("SIN_PARROQUIA", "Falta elegir la parroquia.", null)
    val m = manifiesto ?: throw CodedException("ERR_COPIA", "Sin manifiesto.", null)
    if (m.paginas.isEmpty()) throw CodedException("ERR_COPIA", "Sin manifiesto.", null)
    val version = try {
      JSONObject(config).optInt("version", 0)
    } catch (e: Exception) {
      0
    }
    if (version < 1) throw CodedException("ERR_COPIA", "Config inválido.", null)

    synchronized(bajando) {
      if (congelada) throw enVivo()
      val carpeta = File(r, slugPedido)
      val actual = File(carpeta, "actual")
      val nueva = File(carpeta, "nueva")
      nueva.deleteRecursively()
      if (!nueva.mkdirs()) throw CodedException("ERR_COPIA", "No se pudo escribir la copia.", null)
      try {
        var total = 0L
        val digest = MessageDigest.getInstance("SHA-256")
        for (p in m.paginas) {
          val destino = File(nueva, p)
          total += bajar("$base/$slugPedido/$p", destino, MAX_COPIA - total)
          digest.update(p.toByteArray(Charsets.UTF_8))
          digest.update(0.toByte())
          digest.update(destino.readBytes())
          digest.update(0.toByte())
        }
        val bytesConfig = config.toByteArray(Charsets.UTF_8)
        total += bytesConfig.size
        if (total > MAX_COPIA) throw CodedException("ERR_COPIA", "La copia es demasiado grande.", null)
        File(nueva, "config.json").writeBytes(bytesConfig)

        var reutilizadas = 0
        for (medio in medios.distinct()) {
          val destino = File(nueva, medio)
          destino.parentFile?.mkdirs()
          val vieja = File(actual, medio)
          if (RE_MEDIO_CON_HASH.matches(medio) && vieja.isFile && vieja.length() <= MAX_ARCHIVO) {
            total += vieja.length()
            if (total > MAX_COPIA) throw CodedException("ERR_COPIA", "La copia es demasiado grande.", null)
            vieja.copyTo(destino, overwrite = true)
            reutilizadas++
          } else {
            total += bajar("$base/$slugPedido/$medio", destino, MAX_COPIA - total)
          }
        }

        val hash = digest.digest().joinToString("") { "%02x".format(it) }
        val guardadaEn = ahoraIso()
        File(nueva, "copia.json").writeText(
          JSONObject().put("version", version).put("guardadaEn", guardadaEn).put("hashPaginas", hash).toString(),
        )

        val hashAnterior = leerCopiaJson(actual)?.optString("hashPaginas", "")
        synchronized(this) {
          if (congelada) throw enVivo()
          actual.deleteRecursively()
          if (!nueva.renameTo(actual)) throw CodedException("ERR_COPIA", "No se pudo guardar la copia.", null)
        }
        Log.w(
          TAG,
          "copias: $slugPedido guardada, ${m.paginas.size} paginas, ${medios.distinct().size} medios " +
            "($reutilizadas reutilizados): ${medios.distinct().joinToString(" ")}",
        )
        return mapOf("version" to version, "guardadaEn" to guardadaEn, "paginasCambiaron" to (hash != hashAnterior))
      } catch (e: Exception) {
        nueva.deleteRecursively()
        Log.w(TAG, "copias: $slugPedido no se guardo (${(e as? CodedException)?.code ?: e.javaClass.simpleName})")
        throw e
      }
    }
  }

  // GET con plazo de 20 s; exige 200 y respeta los límites. Devuelve los bytes escritos.
  private fun bajar(url: String, destino: File, quedan: Long): Long {
    destino.parentFile?.mkdirs()
    val c = URL(url).openConnection() as HttpURLConnection
    try {
      c.requestMethod = "GET"
      c.connectTimeout = PLAZO_MS
      c.readTimeout = PLAZO_MS
      c.instanceFollowRedirects = false
      c.useCaches = false
      c.setRequestProperty("Cache-Control", "no-cache")
      val estado = c.responseCode
      // Solo el nombre del archivo en el error: nunca el contenido.
      if (estado != 200) throw CodedException("ERR_DESCARGA", "${destino.name}: $estado", null)
      val tope = minOf(MAX_ARCHIVO, quedan)
      if (c.contentLengthLong > tope) throw CodedException("ERR_COPIA", "La copia es demasiado grande.", null)
      var escritos = 0L
      c.inputStream.use { entrada ->
        destino.outputStream().use { salida ->
          val buf = ByteArray(16 * 1024)
          while (true) {
            val n = entrada.read(buf)
            if (n < 0) break
            escritos += n
            if (escritos > tope) throw CodedException("ERR_COPIA", "La copia es demasiado grande.", null)
            salida.write(buf, 0, n)
          }
        }
      }
      return escritos
    } finally {
      c.disconnect()
    }
  }

  private fun leerCopiaJson(carpeta: File): JSONObject? {
    val f = File(carpeta, "copia.json")
    if (!f.isFile) return null
    return try {
      JSONObject(f.readText())
    } catch (e: Exception) {
      null
    }
  }

  private fun ahoraIso(): String {
    val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
    f.timeZone = TimeZone.getTimeZone("UTC")
    return f.format(Date())
  }

  private fun enVivo() = CodedException("EN_VIVO", "Hay una transmisión en curso.", null)
}
