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
import android.webkit.WebResourceResponse
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
 * - Las escenas cargan las páginas de la parroquia elegida, `https://<plataforma>/<slug>/…` (etapa 3a).
 *   Interceptor.kt responde cada pedido: desde la copia guardada, el respaldo de la app o la red.
 * - Siempre cargadas: «camara» (rotulos.html), «inicio» y la transición.
 * - «portada», «avisos», «horarios», «gracias» y «produccion» se cargan al pedirlas y se descargan al
 *   salir (calor, Tarea 1).
 * - «produccion» (Tarea 9d) carga produccion.html con el estilo elegido en Ajustes (claro o azul).
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

  // Transición (transicion.html de la parroquia, versión «Solo el logo»): el logo tapa la pantalla a los 1000 ms.
  private const val CORTE_MS = 1000L
  private const val DURACION_MS = 2000L
  // Si la escena nueva no terminó de cargar, se espera con el logo quieto hasta este tope.
  private const val MAX_CARGA_MS = 3000L
  private const val REVISAR_MS = 50L

  // La página de cada escena, dentro de `<origen>/<slug>/` (decisión 6 del plan de la etapa 3a).
  private val PAGINAS = mapOf(
    "camara" to "rotulos.html",
    "inicio" to "pantalla.html?tipo=inicio",
    "portada" to "pantalla.html?tipo=portada",
    "avisos" to "pantalla.html?tipo=avisos",
    "horarios" to "pantalla.html?tipo=horarios",
    "gracias" to "pantalla.html?tipo=gracias",
    "produccion" to "produccion.html?estilo=azul",
  )
  // Pantalla final (Tarea 9d): solo estos dos estilos; Azul por defecto.
  private val PAGINAS_PRODUCCION = mapOf(
    "claro" to "produccion.html?estilo=claro",
    "azul" to "produccion.html?estilo=azul",
  )

  /** `<origen>/<slug>/<página>` de una escena. Lanza SIN_PARROQUIA si todavía no se eligió. */
  private fun urls(nombre: String): String {
    val origen = Copias.origen
    val slug = Copias.slug
    if (origen == null || slug == null) throw sinParroquia()
    val pagina = if (nombre == "produccion") PAGINAS_PRODUCCION.getValue(estiloProduccion) else PAGINAS.getValue(nombre)
    return "$origen/$slug/$pagina"
  }

  private fun sinParroquia() = CodedException("SIN_PARROQUIA", "Falta elegir la parroquia.", null)
  private var estiloProduccion = "azul"
  private val FIJAS = setOf("camara", "inicio")

  /**
   * La transición de la parroquia elegida (pantallas más opciones, #3): su identidad, no la de Ciudad
   * Arce. Sin red sale de su copia o del respaldo, como las escenas (Interceptor). Mismo contrato que el
   * video de antes: reproducir(), pausar(), seguir().
   */
  private fun urlTransicion(): String {
    val origen = Copias.origen
    val slug = Copias.slug
    if (origen == null || slug == null) throw sinParroquia()
    return "$origen/$slug/transicion.html"
  }

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
  // Si la capa se libera a mitad de una transición, se rechaza la promesa (review R1).
  private var alFallar: ((CodedException) -> Unit)? = null

  val creada: Boolean get() = contenedor != null

  /** Copias por segundo de la capa sobre el video (últimos 10 s), o null si no hay filtro. */
  fun fps(): Double? = filtro?.fps

  fun olvidarFps() {
    filtro?.olvidarFps()
  }

  /** Crea el contenedor y las escenas fijas. Sin efecto si ya existe. */
  fun crear(actividad: Activity) {
    if (contenedor != null) return
    if (Copias.origen == null || Copias.slug == null) throw sinParroquia()
    val c = FrameLayout(actividad)
    contenedor = c
    for (nombre in listOf("camara", "inicio")) agregarEscena(nombre)
    val t = nuevaWeb(actividad, "transicion")
    t.visibility = View.INVISIBLE
    c.addView(t, FrameLayout.LayoutParams(ANCHO, ALTO))
    t.loadUrl(urlTransicion())
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
    // Si la vista previa se rehízo a mitad de una transición, seguir copiando cada cuadro (review M1).
    nuevo.continuo = destino != null
    // setFilter y no addFilter: si RootEncoder no llegó a soltar el filtro viejo (su release puede
    // descartarse si el hilo de GL tarda más de 100 ms), lo reemplaza en vez de dejar dos (review M2).
    // La capa es el único filtro.
    stream.getGlInterface().setFilter(nuevo)
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

  /**
   * Suelta la capa. Se puede llamar desde cualquier hilo: el trabajo se hace en el principal (review M4).
   *
   * Solo se llama con el JS destruyéndose (OnDestroy del módulo). Si hay una transición en curso,
   * su promesa se rechaza con ERR_LIBERADA: la cola de escenas no toca su escena actual al rechazar,
   * así que nunca cree que se ve una escena que no se ve (review R1 de la Tarea 7).
   */
  fun liberar() {
    if (Looper.myLooper() == Looper.getMainLooper()) liberarEnPrincipal() else h.post { liberarEnPrincipal() }
  }

  private fun liberarEnPrincipal() {
    h.removeCallbacksAndMessages(null)
    filtro?.soltarOyentes()
    filtro = null
    // La promesa de una transición en curso se rechaza (ERR_LIBERADA), para que el JS nunca quede
    // esperando ni crea que la escena cambió (review R1).
    terminarTransicion(resolver = false)
    // Primero se sacan de la jerarquía y después se destruyen (como en quitarEscena).
    val c = contenedor
    (c?.parent as? ViewGroup)?.removeView(c)
    c?.removeAllViews()
    vistas.values.forEach { it.destroy() }
    vistas.clear()
    cargadas.clear()
    transicion?.destroy()
    transicion = null
    contenedor = null
    actual = "camara"
  }

  /**
   * Elige el estilo de la escena «produccion» (Tarea 9d). Si ya está cargada, se recarga con el
   * nuevo; si no, se usa la próxima vez que se pida. Un estilo desconocido se rechaza.
   */
  fun fijarEstiloProduccion(estilo: String) {
    require(estilo in PAGINAS_PRODUCCION) { "Estilo desconocido." }
    if (estilo == estiloProduccion) return
    estiloProduccion = estilo
    val w = vistas["produccion"] ?: return
    cargadas.remove("produccion")
    w.loadUrl(urlDe("produccion"))
    Log.w(TAG, "produccion: estilo $estilo")
  }

  private fun urlDe(nombre: String): String = urls(nombre)

  /**
   * Vuelve a cargar cada escena cargada y la transición: otra parroquia (fijarParroquia) o páginas nuevas en la
   * copia (recargarEscenas). La escena que se ve sigue siendo la misma.
   */
  fun recargar() {
    if (contenedor == null) return
    for ((nombre, w) in vistas) {
      cargadas.remove(nombre)
      w.loadUrl(urlDe(nombre))
    }
    // La transición también muestra el logo de la parroquia: sin esto quedaría el de la anterior.
    transicion?.loadUrl(urlTransicion())
    Log.w(TAG, "capa: escenas y transición recargadas")
  }

  /** Olvida el estado del panel: al cambiar de parroquia no se escribe el de la anterior. */
  fun olvidarEstado() {
    ultimoEstado = null
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
  fun cambiarEscena(escena: String, listo: () -> Unit, fallo: (CodedException) -> Unit) {
    require(escena in PAGINAS) { "Escena desconocida." }
    check(contenedor != null) { "La capa no está creada." }
    // La cola de TS manda una a la vez; si igual llega otra, se rechaza.
    if (destino != null) throw CodedException("ERR_OCUPADO", "Hay una transición en curso.", null)
    if (escena == actual) return listo()
    if (escena !in vistas) agregarEscena(escena)
    destino = escena
    alTerminar = listo
    alFallar = fallo
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
    val mal = alFallar
    alTerminar = null
    alFallar = null
    if (resolver) cb?.invoke()
    else mal?.invoke(CodedException("ERR_LIBERADA", "La capa se liberó durante la transición.", null))
  }

  /**
   * Muestra una escena y oculta las demás. Las ocultas se pausan con WebView.onPause() (Tarea 9h):
   * Inicio queda cargada debajo de Cámara y su fondo vivo (Ken Burns, rayos, chispas) seguía animando.
   * onPause no frena el JavaScript, así que siguen recibiendo el estado. No se usa pauseTimers(),
   * que frena todas las WebViews de la app, también la del panel.
   */
  private fun mostrarSolo(escena: String) {
    for ((nombre, w) in vistas) {
      if (nombre == escena) {
        w.onResume()
        w.visibility = View.VISIBLE
      } else {
        w.visibility = View.INVISIBLE
        w.onPause()
      }
    }
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
    w.loadUrl(urlDe(nombre))
  }

  private fun quitarEscena(nombre: String) {
    val w = vistas.remove(nombre) ?: return
    cargadas.remove(nombre)
    contenedor?.removeView(w)
    w.destroy()
    Log.w(TAG, "escena descargada $nombre")
  }

  private fun escribirEstado(w: WebView, json: String) {
    // La clave es la de la parroquia elegida, `pev_<slug>_estado_v1`; el slug ya pasó por Copias.fijar.
    val slug = Copias.slug ?: return
    // JSONObject.quote arma un literal de texto válido (comillas, barras, saltos de línea y «</»).
    val js = "try{localStorage.setItem('pev_${slug}_estado_v1',${JSONObject.quote(json)})}catch(e){}"
    w.evaluateJavascript(js, null)
  }

  private fun nuevaWeb(ctx: android.content.Context, nombre: String): WebView {
    val w = WebView(ctx)
    val app = ctx.applicationContext
    w.settings.javaScriptEnabled = true
    w.settings.domStorageEnabled = true
    // Todas las páginas, la transición incluida, son del origen de la plataforma: ninguna lee file://.
    w.settings.allowFileAccess = false
    w.settings.mediaPlaybackRequiresUserGesture = false
    // Sin esto la página se ve a 1/2,6 del escenario (Tarea 1, arreglo 2).
    w.settings.useWideViewPort = true
    w.settings.loadWithOverviewMode = true
    w.setBackgroundColor(Color.TRANSPARENT)
    w.isFocusable = false
    w.webViewClient = object : WebViewClient() {
      // Solo los assets de la app o el origen exacto de la plataforma: nunca se navega a otro lado.
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        !Interceptor.esPermitida(request.url)

      // Todo pedido, también los subrecursos: la copia, el respaldo, la red o un bloqueo.
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
        Interceptor.responder(app, request)

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
