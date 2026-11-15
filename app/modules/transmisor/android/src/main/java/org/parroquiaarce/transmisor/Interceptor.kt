package org.parroquiaarce.transmisor

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.InputStream

/*
 * Responde todo pedido de los WebViews de la app (la capa y el panel), con la tabla de la
 * decisión 1 del plan de la etapa 3a. Para `https://<origen>/<slug>/<resto>`:
 *   (a) si `<resto>` está en la copia actual de esa parroquia, desde la copia;
 *   (b) si no, si está en el respaldo (`assets/vicaria/manifiesto.json`), desde el respaldo;
 *   (c) si no, con la copia congelada (en vivo): `config.json` da 503 y lo demás 404;
 *   (d) si no, sigue a la red (null).
 * Un pedido al origen fuera de `/<slug>/` da 404; otro origen, 403 vacío.
 * `file:///android_asset/`, `data:`, `blob:` y `about:blank` siguen igual (null).
 *
 * Corre en el hilo de red del WebView, no en el principal.
 */
object Interceptor {
  private const val ASSETS = "file:///android_asset/"
  private const val CSP_MEDIOS = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"

  /**
   * `scheme://host[:puerto]` de la dirección, en minúsculas, o null si tiene usuario
   * (`https://origen@otro`) o no tiene host. Se compara completo, nunca con startsWith.
   */
  fun origenDe(uri: Uri): String? {
    val scheme = uri.scheme?.lowercase() ?: return null
    val host = uri.host?.lowercase() ?: return null
    if (uri.userInfo != null || host.isEmpty()) return null
    val puerto = uri.port
    return "$scheme://$host" + (if (puerto != -1) ":$puerto" else "")
  }

  /** true si la dirección es de los assets de la app o del origen exacto de la plataforma. */
  fun esPermitida(uri: Uri): Boolean {
    if (uri.toString().startsWith(ASSETS)) return true
    val o = Copias.origen ?: return false
    return origenDe(uri) == o
  }

  fun responder(ctx: Context, request: WebResourceRequest): WebResourceResponse? {
    val uri = request.url
    val texto = uri.toString()
    if (texto.startsWith(ASSETS) || texto == "about:blank") return null
    val scheme = uri.scheme?.lowercase()
    if (scheme == "data" || scheme == "blob") return null

    val origen = Copias.origen ?: return vacia(403, "Forbidden")
    if (origenDe(uri) != origen) return vacia(403, "Forbidden")

    val slug = Copias.slug ?: return vacia(404, "Not Found")
    val camino = uri.encodedPath ?: ""
    val prefijo = "/$slug/"
    if (!camino.startsWith(prefijo)) return vacia(404, "Not Found")
    val resto = camino.substring(prefijo.length)

    // (a) La copia de la parroquia (solo nombres conocidos: Copias.abrir no arma otras rutas).
    Copias.abrir(slug, resto)?.let { return archivo(resto, it) }
    // (b) El respaldo dentro de la app.
    if (Copias.enPaquete(resto)) {
      try {
        return archivo(resto, ctx.assets.open("vicaria/$resto"))
      } catch (e: Exception) {
        // Sigue: un respaldo incompleto no rompe la tabla.
      }
    }
    // (c) En vivo, todo fijo: nunca a la red. Con 503 parroquia.js usa su copia (sinRed).
    if (Copias.congelada) {
      return if (resto == "config.json") vacia(503, "Service Unavailable") else vacia(404, "Not Found")
    }
    // (d) Fuera del vivo, a la red.
    return null
  }

  private fun archivo(resto: String, datos: InputStream): WebResourceResponse {
    val (mime, codificacion) = mimeDe(resto)
    val encabezados = mutableMapOf("Cache-Control" to "no-store")
    if (resto.startsWith("medios/")) encabezados["Content-Security-Policy"] = CSP_MEDIOS
    return WebResourceResponse(mime, codificacion, 200, "OK", encabezados, datos)
  }

  private fun vacia(estado: Int, motivo: String): WebResourceResponse =
    WebResourceResponse(
      "text/plain",
      "utf-8",
      estado,
      motivo,
      mapOf("Cache-Control" to "no-store"),
      ByteArrayInputStream(ByteArray(0)),
    )

  private fun mimeDe(resto: String): Pair<String, String?> {
    val ext = resto.substringAfterLast('.', "").lowercase()
    return when (ext) {
      "html" -> "text/html" to "utf-8"
      "js" -> "text/javascript" to "utf-8"
      "css" -> "text/css" to "utf-8"
      "json" -> "application/json" to "utf-8"
      "png" -> "image/png" to null
      "jpg", "jpeg" -> "image/jpeg" to null
      "webp" -> "image/webp" to null
      "svg" -> "image/svg+xml" to "utf-8"
      "woff2" -> "font/woff2" to null
      else -> "application/octet-stream" to null
    }
  }
}
