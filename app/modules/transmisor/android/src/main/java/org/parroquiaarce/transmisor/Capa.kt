package org.parroquiaarce.transmisor

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import com.pedro.library.rtmp.RtmpStream
import expo.modules.kotlin.exception.CodedException
import org.json.JSONObject

/*
 * La capa que va encima de la cámara: un contenedor de 1920×1080 con las WebViews de escena y,
 * arriba de todo, la de la transición. Se dibuja sobre el video con FiltroCapa.
 *
 * - Siempre cargadas: «camara» (obs/rotulos.html), «inicio» y la transición.
 * - «portada», «avisos» y «gracias» se cargan al pedirlas y se descargan al salir (calor, Tarea 1).
 * - Se ve una sola escena a la vez; las demás quedan INVISIBLE.
 * - El contenedor va dentro de la ventana (debajo del contenido, índice 0) para que las WebViews
 *   dibujen; no se ve en la pantalla del celular, solo en el video.
 *
 * Todo corre en el hilo principal (Queues.MAIN).
 */
@SuppressLint("StaticFieldLeak", "SetJavaScriptEnabled")
object Capa {
  private const val TAG = "Transmisor"
  private const val ANCHO = 1920
  private const val ALTO = 1080
  private const val CLAVE_ESTADO = "parroquia_obs_estado_v1"

  // Transición (Transicion_2000ms_Logo.webm): el logo tapa la pantalla a los 1000 ms.
  private const val CORTE_MS = 1000L
  private const val DURACION_MS = 2000L
  // Si la escena nueva no terminó de cargar, se espera con el logo quieto hasta este tope.
  private const val MAX_CARGA_MS = 3000L
  private const val REVISAR_MS = 50L

  private const val BASE = "file:///android_asset/obs/"
  private val URLS = mapOf(
    "camara" to BASE + "rotulos.html",
    "inicio" to BASE + "pantalla.html?tipo=inicio",
    "portada" to BASE + "pantalla.html?tipo=portada",
    "avisos" to BASE + "pantalla.html?tipo=avisos",
    "gracias" to BASE + "pantalla.html?tipo=gracias",
  )
  private val FIJAS = setOf("camara", "inicio")
  private const val URL_TRANSICION = "file:///android_asset/app/transicion.html"

  private val h = Handler(Looper.getMainLooper())
  private var contenedor: FrameLayout? = null
  private val vistas = mutableMapOf<String, WebView>()
  private val cargadas = mutableSetOf<String>()
  private var transicion: WebView? = null
  private var filtro: FiltroCapa? = null
  private var actual = "camara"
  private var ultimoEstado: String? = null

  // Transición en curso.
  private var destino: String? = null
  private var inicioMs = 0L
  private var pausada = false
  private var alTerminar: (() -> Unit)? = null

  val creada: Boolean get() = contenedor != null

  /** Crea el contenedor y las escenas fijas. Sin efecto si ya existe. */
  fun crear(actividad: Activity) {
    if (contenedor != null) return
    val c = FrameLayout(actividad)
    contenedor = c
    for (nombre in listOf("camara", "inicio")) agregarEscena(nombre)
    val t = nuevaWeb(actividad, "transicion")
    t.visibility = View.INVISIBLE
    c.addView(t, FrameLayout.LayoutParams(ANCHO, ALTO))
    t.loadUrl(URL_TRANSICION)
    transicion = t
    mostrarSolo(actual)
    // Debajo del contenido de la ventana: existe y dibuja, pero no se ve en el celular.
    (actividad.window.decorView as ViewGroup).addView(c, 0, FrameLayout.LayoutParams(ANCHO, ALTO))
    Log.w(TAG, "capa creada escena=$actual")
  }

  /**
   * Pone el filtro de la capa en el GL de RootEncoder si no está. RootEncoder suelta los filtros
   * cuando para el GL (MainRender.release), así que se llama después de cada startPreview.
   */
  fun asegurarFiltro(stream: RtmpStream) {
    val c = contenedor ?: return
    val f = filtro
    if (f != null && !f.liberado) return
    val nuevo = FiltroCapa(c)
    stream.getGlInterface().addFilter(nuevo)
    filtro = nuevo
    Log.w(TAG, "capa: filtro agregado")
  }

  /**
   * El GL de RootEncoder se paró (stopPreview o stopStream sin la otra): va a soltar el filtro
   * (StreamBase.stopPreview → GlStreamInterface.stop → MainRender.release, en otro hilo).
   * Se olvida ya, para que el próximo startPreview ponga uno nuevo sin esperar a ese hilo.
   */
  fun filtroPerdido() {
    filtro?.soltarOyentes()
    filtro = null
  }

  fun liberar() {
    h.removeCallbacksAndMessages(null)
    filtro?.soltarOyentes()
    filtro = null
    terminarTransicion(resolver = true)
    vistas.values.forEach { it.destroy() }
    vistas.clear()
    cargadas.clear()
    transicion?.destroy()
    transicion = null
    (contenedor?.parent as? ViewGroup)?.removeView(contenedor)
    contenedor = null
    actual = "camara"
  }

  /** Guarda el estado y lo escribe en las escenas cargadas. Las que carguen después lo reciben al cargar. */
  fun actualizarEstado(json: String) {
    ultimoEstado = json
    for ((nombre, w) in vistas) if (nombre in cargadas) escribirEstado(w, json)
  }

  /**
   * Transición del logo hacia `escena`. Llama a `listo` al terminar (2 s), o enseguida si ya
   * se ve esa escena.
   */
  fun cambiarEscena(escena: String, listo: () -> Unit) {
    require(escena in URLS) { "Escena desconocida." }
    check(contenedor != null) { "La capa no está creada." }
    // La cola de TS manda una a la vez; si igual llega otra, se rechaza.
    if (destino != null) throw CodedException("ERR_OCUPADO", "Hay una transición en curso.", null)
    if (escena == actual) return listo()
    if (escena !in vistas) agregarEscena(escena)
    destino = escena
    alTerminar = listo
    inicioMs = SystemClock.uptimeMillis()
    pausada = false
    transicion?.let {
      it.visibility = View.VISIBLE
      it.evaluateJavascript("reproducir()", null)
    }
    filtro?.continuo = true
    Log.w(TAG, "transicion -> $escena")
    h.postDelayed(::intentarCorte, CORTE_MS)
  }

  // A los 1000 ms: si la escena nueva cargó, se corta; si no, el logo queda quieto hasta 3 s.
  private fun intentarCorte() {
    val d = destino ?: return
    val transcurrido = SystemClock.uptimeMillis() - inicioMs
    if (d !in cargadas && transcurrido < MAX_CARGA_MS) {
      if (!pausada) {
        pausada = true
        transicion?.evaluateJavascript("pausar()", null)
        Log.w(TAG, "transicion: esperando la carga de $d")
      }
      h.postDelayed(::intentarCorte, REVISAR_MS)
      return
    }
    if (d !in cargadas) Log.w(TAG, "transicion: $d no termino de cargar en ${MAX_CARGA_MS} ms; se corta igual")
    val anterior = actual
    actual = d
    mostrarSolo(d)
    if (pausada) transicion?.evaluateJavascript("seguir()", null)
    filtro?.pedir()
    h.postDelayed({ finTransicion(anterior) }, DURACION_MS - CORTE_MS)
  }

  private fun finTransicion(anterior: String) {
    // Se descarga la escena que se dejó, salvo las fijas (y salvo que se haya vuelto a ella).
    if (anterior !in FIJAS && anterior != actual) quitarEscena(anterior)
    terminarTransicion(resolver = true)
    Log.w(TAG, "transicion terminada escena=$actual")
  }

  private fun terminarTransicion(resolver: Boolean) {
    destino = null
    pausada = false
    transicion?.visibility = View.INVISIBLE
    filtro?.continuo = false
    filtro?.pedir()
    val cb = alTerminar
    alTerminar = null
    if (resolver) cb?.invoke()
  }

  private fun mostrarSolo(escena: String) {
    for ((nombre, w) in vistas) w.visibility = if (nombre == escena) View.VISIBLE else View.INVISIBLE
  }

  private fun agregarEscena(nombre: String) {
    val c = contenedor ?: return
    val w = nuevaWeb(c.context, nombre)
    w.visibility = View.INVISIBLE
    // Debajo de la transición, que siempre queda arriba.
    val indice = transicion?.let { c.indexOfChild(it) }?.takeIf { it >= 0 } ?: c.childCount
    c.addView(w, indice, FrameLayout.LayoutParams(ANCHO, ALTO))
    vistas[nombre] = w
    cargadas.remove(nombre)
    w.loadUrl(URLS.getValue(nombre))
  }

  private fun quitarEscena(nombre: String) {
    val w = vistas.remove(nombre) ?: return
    cargadas.remove(nombre)
    contenedor?.removeView(w)
    w.destroy()
    Log.w(TAG, "escena descargada $nombre")
  }

  private fun escribirEstado(w: WebView, json: String) {
    // JSONObject.quote arma un literal de texto válido (comillas, barras, saltos de línea y «</»).
    val js = "try{localStorage.setItem('$CLAVE_ESTADO',${JSONObject.quote(json)})}catch(e){}"
    w.evaluateJavascript(js, null)
  }

  private fun nuevaWeb(ctx: android.content.Context, nombre: String): WebView {
    val w = WebView(ctx)
    w.settings.javaScriptEnabled = true
    w.settings.domStorageEnabled = true
    // Las páginas y sus fuentes, imágenes y el video están en file:///android_asset/.
    w.settings.allowFileAccess = true
    @Suppress("DEPRECATION")
    w.settings.allowFileAccessFromFileURLs = true
    w.settings.mediaPlaybackRequiresUserGesture = false
    // Sin esto la página se ve a 1/2,6 del escenario (Tarea 1, arreglo 2).
    w.settings.useWideViewPort = true
    w.settings.loadWithOverviewMode = true
    w.setBackgroundColor(Color.TRANSPARENT)
    w.isFocusable = false
    w.webViewClient = object : WebViewClient() {
      // Solo páginas propias de la app: nunca se navega fuera de los assets.
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        !request.url.toString().startsWith("file:///android_asset/")

      override fun onPageFinished(view: WebView, url: String) {
        if (vistas[nombre] !== view) return
        cargadas += nombre
        ultimoEstado?.let { escribirEstado(view, it) }
        Log.w(TAG, "escena cargada $nombre")
        filtro?.pedir()
      }
    }
    return w
  }
}
