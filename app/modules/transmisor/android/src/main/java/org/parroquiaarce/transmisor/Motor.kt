package org.parroquiaarce.transmisor

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.SurfaceView
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.OrientationForced
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.encoder.input.video.CameraHelper
import com.pedro.library.rtmp.RtmpStream
import com.pedro.library.util.FpsListener
import expo.modules.kotlin.exception.CodedException

// Motor de la transmisión: cámara + micrófono → RTMPS (RootEncoder 2.8.1).
// Todo corre en el hilo principal: las funciones del módulo usan Queues.MAIN y
// RootEncoder llama a ConnectChecker en el hilo principal.
//
// Reglas:
//  - la URL completa y la clave nunca se escriben en el log (redactar());
//  - sin el registro seguro (RegistroSeguro.activo) no se transmite: RootEncoder
//    escribiría la clave en logcat;
//  - RootEncoder no reintenta solo (Tarea 1, punto 8): se reintenta desde
//    onConnectionFailed con reTry(ESPERA_MS), hasta REINTENTOS veces por corte;
//  - si Facebook rechaza la clave no se reintenta.
@SuppressLint("StaticFieldLeak")
object Motor : ConnectChecker {
  private const val TAG = "Transmisor"

  // Hasta 24 reintentos por corte, cada 5 s. Cada intento puede tardar además hasta el
  // socketTimeout de RtmpClient (5 s por defecto), así que la espera total va de ~2 a ~4 min.
  // El cupo se restablece en cada onConnectionSuccess (es por corte, no por transmisión).
  const val REINTENTOS = 24
  const val ESPERA_MS = 5000L

  // Si onDisconnect no llega tras stopStream, se libera igual a los 3 s.
  private const val MAX_CIERRE_MS = 3000L

  private var stream: RtmpStream? = null
  private var superficie: SurfaceView? = null
  private var preparado = false

  // Entre iniciar() y terminar() (o un corte definitivo).
  private var alAire = false
  // true después del primer onConnectionSuccess de esta salida al aire.
  private var conectoAlgunaVez = false
  private var conectado = false
  // Un intento fallido puede avisar dos veces seguidas (p. ej. «Publish.Failed» y después
  // «End of stream»). Si cada aviso pidiera reTry habría dos reconexiones a la vez sobre el
  // mismo socket (se vio en el celular: «Unknown rtmp message type»). Entre el reTry y el
  // siguiente intento (onConnectionStarted) se ignoran los avisos.
  private var reintentoPendiente = false
  // stopStream() baja isStreaming en el acto, pero RtmpClient termina de cerrar en otro
  // hilo; un connect() en esa ventana no hace nada. Hasta onDisconnect, iniciar() rechaza.
  private var cerrando = false
  // @Volatile: Registro (otro hilo) los mira con contieneSecreto().
  @Volatile private var url: String? = null
  @Volatile private var clave: String? = null
  private var muestrasFps = 0
  // Contexto de la app (para el servicio y el estado térmico). Se guarda en prepararVista.
  private var contexto: Context? = null

  /** Últimos fps que informó RootEncoder (uno por segundo). Para el registro de rendimiento. */
  @Volatile var fpsVideo: Int? = null
    private set

  private val principal = Handler(Looper.getMainLooper())
  private val liberarCierre = Runnable { cerrando = false }

  // Lo fija el módulo: manda el evento «onEstado» a JS. @Volatile: OnDestroy lo borra desde su
  // hilo, en el acto (review M3 de la Tarea 9).
  @Volatile var alEvento: ((Map<String, Any?>) -> Unit)? = null

  // Lo fija el módulo: manda «onServicio» a JS ({ ok }) cuando el servicio arranca o falla (review M4).
  @Volatile var alServicio: ((Boolean) -> Unit)? = null

  /** Lo llama ServicioTransmision: si no pudo quedar en primer plano, JS muestra un aviso. */
  fun servicioArranco(ok: Boolean) {
    if (!ok) Log.w(TAG, "servicio en primer plano no disponible")
    alServicio?.invoke(ok)
  }

  private fun obtener(ctx: Context): RtmpStream {
    stream?.let { return it }
    val s = RtmpStream(ctx.applicationContext, this)
    s.getStreamClient().setReTries(REINTENTOS)
    s.setFpsListener(object : FpsListener.Callback {
      override fun onFps(fps: Int) {
        fpsVideo = fps
        // Una línea cada 10 s, para comprobar la vista previa por logcat.
        if (muestrasFps++ % 10 == 0) Log.w(TAG, "fps=$fps")
      }
    })
    stream = s
    return s
  }

  fun prepararVista(ctx: Context, calidad: String, microfono: String) {
    contexto = ctx.applicationContext
    val s = obtener(ctx)
    if (s.isStreaming) throw IllegalStateException("No se puede cambiar la calidad durante la transmisión.")
    if (s.isOnPreview) {
      s.stopPreview()
      // Sin transmisión, stopPreview para el GL y RootEncoder suelta los filtros.
      Capa.filtroPerdido()
    }
    // Bitrates dentro de los rangos de Facebook a 30 fps (Live Video API reference):
    // 720p 1500–4000 kbps, 1080p 3000–6000 kbps; audio AAC 128 kbps, keyframe 2 s.
    val (ancho, alto, bitrate) =
      if (calidad == "1080p") Triple(1920, 1080, 4_500_000) else Triple(1280, 720, 2_500_000)
    val video = s.prepareVideo(ancho, alto, bitrate, 30, 2, 0)
    val audio = s.prepareAudio(44100, true, 128_000)
    if (!video || !audio) {
      preparado = false
      throw IllegalStateException("No se pudo preparar la cámara o el micrófono.")
    }
    elegirMicrofono(ctx, s, microfono)
    preparado = true
    Log.w(TAG, "preparado ${ancho}x$alto ${bitrate / 1000} kbps mic=$microfono")
    arrancarVistaSiSePuede()
  }

  // No verificado con un micrófono USB-C real (Tarea 1, punto 6).
  private fun elegirMicrofono(ctx: Context, s: RtmpStream, microfono: String) {
    if (microfono != "externo") return
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val usb = am.getDevices(AudioManager.GET_DEVICES_INPUTS).firstOrNull {
      it.type == AudioDeviceInfo.TYPE_USB_DEVICE || it.type == AudioDeviceInfo.TYPE_USB_HEADSET
    }
    val mic = s.audioSource as? MicrophoneSource
    if (usb != null && mic != null) Log.w(TAG, "microfono USB elegido=${mic.setPreferredDevice(usb)}")
    else Log.w(TAG, "no hay microfono USB; se usa el del celular")
  }

  fun superficieLista(sv: SurfaceView) {
    superficie = sv
    arrancarVistaSiSePuede()
  }

  fun superficieCambio(ancho: Int, alto: Int) {
    val s = stream ?: return
    // Al girar la pantalla la superficie cambia de tamaño: es el momento de seguir la rotación.
    seguirPantalla(s)
    if (s.isOnPreview) s.getGlInterface().setPreviewResolution(ancho, alto)
  }

  /**
   * RootEncoder fija la rotación de la cámara con la rotación que tiene la pantalla en el momento
   * de prepareVideo (OrientationForced.NONE → CameraHelper.getCameraOrientation) y no la vuelve a
   * mirar sola. Desde la Tarea 9c se prepara en vertical y después se gira a horizontal: sin esto
   * la imagen queda en la rotación vertical. forceOrientation(NONE) vuelve a leer la rotación
   * actual (leído en el bytecode de RootEncoder 2.8.1, GlStreamInterface.forceOrientation).
   */
  private fun seguirPantalla(s: RtmpStream) {
    s.getGlInterface().forceOrientation(OrientationForced.NONE)
    contexto?.let { Log.w(TAG, "rotacion de pantalla para la camara=${CameraHelper.getCameraOrientation(it)}") }
  }

  fun superficieFuera(sv: SurfaceView) {
    if (superficie !== sv) return
    superficie = null
    val s = stream ?: return
    // Durante la transmisión, stopPreview solo suelta la superficie; la cámara sigue.
    if (s.isOnPreview) {
      s.stopPreview()
      if (!s.isStreaming) Capa.filtroPerdido()
    }
  }

  private fun arrancarVistaSiSePuede() {
    val s = stream ?: return
    val sv = superficie ?: return
    if (!preparado || s.isOnPreview || !sv.holder.surface.isValid) return
    s.startPreview(sv)
    seguirPantalla(s)
    // RootEncoder suelta los filtros al parar el GL: se vuelve a poner la capa.
    Capa.asegurarFiltro(s)
    Log.w(TAG, "vista previa iniciada")
  }

  fun iniciar(urlCompleta: String, laClave: String) {
    // Falla cerrada: sin el piso WARN, RootEncoder escribiría la clave en logcat.
    if (!RegistroSeguro.activo) {
      throw CodedException("ERR_REGISTRO_INSEGURO", "Registro seguro inactivo.", null)
    }
    val s = stream
    if (s == null || !preparado) throw CodedException("ERR_SIN_PREPARAR", "Falta preparar la vista.", null)
    if (alAire || s.isStreaming || cerrando) {
      throw CodedException("ERR_OCUPADO", "Hay una transmisión activa o cerrándose.", null)
    }
    url = urlCompleta
    clave = laClave
    alAire = true
    conectoAlgunaVez = false
    conectado = false
    reintentoPendiente = false
    // Los fps de la transmisión anterior no pasan a la primera muestra de esta (review M7).
    olvidarFps()
    Log.w(TAG, "iniciando transmision")
    // Con la app en primer plano y antes de salir al aire (Tarea 1, punto 7).
    contexto?.let { ServicioTransmision.arrancar(it) }
    // Ya en horizontal: la imagen que sale al aire sigue la rotación actual de la pantalla.
    seguirPantalla(s)
    s.startStream(urlCompleta)
    // Sin vista previa, startStream arranca el GL: la capa tiene que ir también en el video.
    Capa.asegurarFiltro(s)
  }

  fun terminar() {
    alAire = false
    conectado = false
    reintentoPendiente = false
    val ok = soltar()
    url = null
    clave = null
    Log.w(TAG, "transmision terminada")
    if (!ok) emitir("cortado", "preparar", null)
  }

  // Corte definitivo: se suelta el stream y se avisa a JS.
  private fun cortar(motivo: String) {
    alAire = false
    conectado = false
    reintentoPendiente = false
    val ok = soltar()
    url = null
    clave = null
    // Si no se pudo volver a preparar, eso es lo que el operador tiene que resolver primero.
    val final = if (ok) motivo else "preparar"
    Log.w(TAG, "cortado motivo=$final")
    emitir("cortado", final, null)
  }

  /**
   * Para el stream si está activo. Devuelve false si RootEncoder no pudo volver a preparar
   * los codificadores (stopStream → prepareEncoders); entonces hay que preparar de nuevo.
   */
  private fun soltar(): Boolean {
    // El servicio en primer plano se para siempre que se deja el aire (terminar o corte).
    contexto?.let { ServicioTransmision.parar(it) }
    olvidarFps()
    // Al dejar el aire el zoom vuelve a 1× (Tarea 9g).
    ponerZoom(1.0)
    val s = stream ?: return true
    if (!s.isStreaming) return true
    cerrando = true
    principal.removeCallbacks(liberarCierre)
    principal.postDelayed(liberarCierre, MAX_CIERRE_MS)
    val ok = s.stopStream()
    // Sin vista previa, stopStream también para el GL y suelta los filtros.
    if (!s.isOnPreview) Capa.filtroPerdido()
    if (!ok) {
      preparado = false
      Log.w(TAG, "stopStream no pudo volver a preparar los codificadores")
    }
    return ok
  }

  private fun emitir(conexion: String, motivo: String?, kbps: Double?) {
    val termico = contexto?.let { Sistema.termico(it) }
    alEvento?.invoke(mapOf("conexion" to conexion, "motivo" to motivo, "kbps" to kbps, "termico" to termico))
  }

  /**
   * Tapa la URL completa, la clave y sus partes (lo anterior a «?» y cada valor largo de la
   * consulta, que Facebook agrega a la clave) si aparecen en un texto (motivos de error).
   */
  fun redactar(texto: String): String {
    val secretos = mutableListOf<String>()
    url?.let { secretos += it; secretos += it.substringBefore('?') }
    clave?.let { c ->
      secretos += c
      secretos += c.substringBefore('?')
      c.substringAfter('?', "").split('&').forEach { par -> secretos += par.substringAfter('=', "") }
    }
    var r = texto
    // Los más largos primero; los valores cortos (p. ej. «1») no se tapan para no romper el texto.
    secretos.filter { it.length >= 6 }.distinct().sortedByDescending { it.length }.forEach {
      r = r.replace(it, "[oculto]")
    }
    return r
  }

  // Zoom (Tarea 9g). RtmpStream(contexto, checker) usa Camera2Source (verificado con javap en
  // library-2.8.1). Camera2Source.setZoom no hace nada si la cámara no está encendida.
  private fun camara(): Camera2Source? = stream?.videoSource as? Camera2Source

  /** { min, max } del zoom del celular, o null si no se sabe (cámara apagada o sin zoom). */
  fun rangoZoom(): Map<String, Double>? = try {
    camara()?.getZoomRange()?.let { mapOf("min" to it.lower.toDouble(), "max" to it.upper.toDouble()) }
  } catch (e: Exception) {
    Log.w(TAG, "rango de zoom no disponible: ${e.javaClass.simpleName}")
    null
  }

  /** Pone el zoom, dentro del rango del celular. */
  fun ponerZoom(nivel: Double) {
    val c = camara() ?: return
    try {
      val r = c.getZoomRange()
      c.setZoom(nivel.toFloat().coerceIn(r.lower, r.upper))
    } catch (e: Exception) {
      Log.w(TAG, "no se pudo poner el zoom: ${e.javaClass.simpleName}")
    }
  }

  private fun olvidarFps() {
    fpsVideo = null
    Capa.olvidarFps()
  }

  /** true si el texto tiene la URL o la clave de la transmisión en curso (defensa del registro). */
  fun contieneSecreto(texto: String): Boolean = redactar(texto) != texto

  /** Clasifica el motivo de RootEncoder. «clave» y «servidor» no se reintentan. */
  fun clasificar(motivo: String): String = when {
    motivo.contains("Endpoint malformed") -> "servidor"
    motivo.contains("NetStream.Publish.BadName") ||
      motivo.contains("NetConnection.Connect.Rejected") ||
      motivo.contains("authfail", ignoreCase = true) -> "clave"
    else -> "red"
  }

  // --- ConnectChecker (RootEncoder) ---

  // Recibe la URL completa: no se registra.
  override fun onConnectionStarted(url: String) {
    reintentoPendiente = false
  }

  override fun onConnectionSuccess() {
    if (!alAire) return
    conectoAlgunaVez = true
    conectado = true
    // RtmpClient solo restablece el cupo en disconnect(true) (stopStream), no al reconectar:
    // sin esto, en una misa larga con varios cortes, el cupo se agotaría sin reintentar.
    stream?.getStreamClient()?.setReTries(REINTENTOS)
    Log.w(TAG, "conectado")
    emitir("conectado", null, null)
  }

  override fun onConnectionFailed(reason: String) {
    if (!alAire || reintentoPendiente) return
    conectado = false
    val motivo = clasificar(reason)
    Log.w(TAG, "falla de conexion (${redactar(reason)}) -> $motivo")
    if (motivo != "red") return cortar(motivo)
    // Si nunca llegó a conectar no se reintenta: al empezar, el error es de datos o de red.
    // Probado en el celular (2026-11-05): con una clave falsa, Facebook no manda onStatus ni
    // _error; cierra el socket ya dentro de RTMP y RootEncoder avisa «End of stream». Antes del
    // primer «conectado» eso se toma como clave rechazada (sin red, el error es otro: host,
    // tiempo de espera o «Handshake failed»). Es una inferencia, no una respuesta explícita.
    if (!conectoAlgunaVez) return cortar(if (reason.contains("End of stream")) "clave" else "inicio")
    val s = stream ?: return cortar("agotado")
    if (s.getStreamClient().reTry(ESPERA_MS, reason)) {
      reintentoPendiente = true
      emitir("reconectando", "red", null)
    } else {
      cortar("agotado")
    }
  }

  override fun onAuthError() {
    if (!alAire) return
    Log.w(TAG, "Facebook rechazo la autenticacion")
    cortar("clave")
  }

  override fun onAuthSuccess() {}

  // Llega cuando RtmpClient terminó de cerrar (disconnect(true), tras stopStream).
  override fun onDisconnect() {
    principal.removeCallbacks(liberarCierre)
    cerrando = false
  }

  override fun onNewBitrate(bitrate: Long) {
    if (alAire && conectado) emitir("conectado", null, bitrate / 1000.0)
  }
}
