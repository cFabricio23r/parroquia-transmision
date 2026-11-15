package org.parroquiaarce.transmisor

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/*
 * El panel de la parroquia (etapa 3a, decisión 5): un WebView nativo que carga
 * `https://<plataforma>/<slug>/panel.html?modo=app`. Reemplaza al de react-native-webview porque
 * ese no puede interceptar los subrecursos: acá Interceptor.kt responde cada pedido (la copia
 * guardada, el respaldo de la app, la red o un bloqueo).
 *
 * - Solo navega al origen exacto de la plataforma; nunca a otro lado ni a archivos.
 * - Al cargar corre `scriptAlCargar` (el sondeo del estado, scriptPanel(slug)) y emite onCargado.
 * - `window.ReactNativeWebView.postMessage(data)` llega como onMensaje({url, data}), solo si la
 *   página es del origen.
 * - Si se cae el proceso de la página emite onProcesoCaido: JS monta una vista nueva.
 */
@SuppressLint("SetJavaScriptEnabled", "ViewConstructor")
class VistaPanel(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onMensaje by EventDispatcher()
  private val onCargado by EventDispatcher()
  private val onProcesoCaido by EventDispatcher()

  private val h = Handler(Looper.getMainLooper())
  private val web = WebView(context)

  private var url: String? = null
  private var origen: String? = null
  private var scriptAlCargar: String? = null
  private var cargada: String? = null

  init {
    val s = web.settings
    s.javaScriptEnabled = true
    s.domStorageEnabled = true
    s.allowFileAccess = false
    s.allowContentAccess = false
    s.setSupportMultipleWindows(false)
    s.javaScriptCanOpenWindowsAutomatically = false
    // El color lo pone la View de ColumnaPanel (C.fondo2).
    web.setBackgroundColor(Color.TRANSPARENT)
    web.addJavascriptInterface(Puente(), "ReactNativeWebView")
    val app = context.applicationContext
    web.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        !esDelOrigen(request.url)

      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
        Interceptor.responder(app, request)

      override fun onPageFinished(view: WebView, url: String) {
        if (!esDelOrigen(Uri.parse(url))) return
        scriptAlCargar?.let { view.evaluateJavascript(it, null) }
        onCargado(mapOf("url" to url))
      }

      override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        Log.w("Transmisor", "panel: se cayo el proceso de la pagina")
        onProcesoCaido(mapOf<String, Any>())
        // true: la app sigue; esta vista no se vuelve a usar (JS monta otra).
        return true
      }
    }
    addView(web, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun fijarUrl(u: String) {
    url = u
  }

  fun fijarOrigen(o: String) {
    origen = o
  }

  fun fijarScript(s: String) {
    scriptAlCargar = s
  }

  /** Después de cambiar las props: si la dirección cambió y es del origen, se carga. */
  fun aplicar() {
    val u = url ?: return
    if (u == cargada) return
    if (!esDelOrigen(Uri.parse(u))) {
      Log.w("Transmisor", "panel: direccion fuera del origen, no se carga")
      return
    }
    cargada = u
    web.loadUrl(u)
  }

  /** Corre un script en el panel (PanelRef.inyectar). Solo si la página es del origen. */
  fun inyectar(script: String) {
    val actual = web.url ?: return
    if (!esDelOrigen(Uri.parse(actual))) return
    web.evaluateJavascript(script, null)
  }

  fun destruir() {
    h.removeCallbacksAndMessages(null)
    web.removeJavascriptInterface("ReactNativeWebView")
    removeView(web)
    web.destroy()
  }

  private fun esDelOrigen(uri: Uri): Boolean {
    val o = origen ?: return false
    return Interceptor.origenDe(uri) == o
  }

  private inner class Puente {
    @JavascriptInterface
    fun postMessage(data: String) {
      // Llega en el hilo del puente de JS: la url del WebView se lee en el principal.
      h.post {
        val actual = web.url ?: return@post
        if (!esDelOrigen(Uri.parse(actual))) return@post
        onMensaje(mapOf("url" to actual, "data" to data))
      }
    }
  }
}
