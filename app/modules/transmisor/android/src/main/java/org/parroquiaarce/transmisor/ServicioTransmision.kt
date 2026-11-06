package org.parroquiaarce.transmisor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

/*
 * Servicio en primer plano de tipo camera|microphone (Tarea 1, punto 7): sin él, Android bloquea
 * la cámara y silencia el micrófono a los pocos segundos de pasar a segundo plano o de apagar la
 * pantalla, y el vivo queda congelado sin aviso.
 *
 * - Se arranca en Motor.iniciar(), con la app en primer plano y antes de startStream.
 * - Se para cuando la transmisión termina o se corta del todo (Motor.soltar).
 * - startForeground se llama siempre primero en onStartCommand. Si el pedido de parar llega antes
 *   (un arranque que falla en el acto), se anota en `pedidoParar` y el servicio se para solo
 *   después de startForeground: así Android no tira «startForegroundService() did not then call
 *   startForeground()» (review M1 de la Tarea 9; esa regla del sistema no se verificó en el AOSP).
 * - Si startForeground falla, se avisa a JS (Motor.servicioArranco(false)) y no se hace stopSelf.
 * - La notificación es fija mientras se transmite y vuelve a la app al tocarla.
 *
 * APIs comprobadas en api-versions.xml: startForeground(int, Notification, int) desde 29;
 * ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA y _MICROPHONE desde 30; Notification.Builder(ctx,
 * canal) y NotificationChannel desde 26; stopForeground(int) desde 24.
 */
class ServicioTransmision : Service() {
  companion object {
    private const val TAG = "Transmisor"
    private const val CANAL = "transmision"
    private const val ID = 1

    @Volatile var activo = false
      private set

    // Entre startForegroundService y el onStartCommand que llama a startForeground.
    @Volatile private var arrancando = false
    // Un parar() que llegó mientras arrancaba: se cumple después de startForeground.
    @Volatile private var pedidoParar = false
    // Sube en cada arrancar(). Un parar() anota la generación del momento en que se llamó: si cuando
    // le toca correr en el principal ya hubo otro arrancar(), ese parar() era para el servicio viejo
    // y no se cumple (review m1 de la 9c). Solo se escribe en el principal (Motor.iniciar).
    @Volatile private var generacion = 0

    fun arrancar(ctx: Context) {
      val i = Intent(ctx, ServicioTransmision::class.java)
      generacion++
      pedidoParar = false
      arrancando = true
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
      } catch (e: Exception) {
        arrancando = false
        // Sin el servicio la transmisión sigue, pero se corta al pasar a segundo plano.
        Log.w(TAG, "servicio: no se pudo arrancar (${e.javaClass.simpleName})")
        Motor.servicioArranco(false)
      }
    }

    private val principal = Handler(Looper.getMainLooper())

    /*
     * parar() se puede llamar desde el hilo de RootEncoder (un corte que llega por ConnectChecker
     * termina en Motor.soltar). onStartCommand corre en el hilo principal y lee y escribe
     * `arrancando` y `pedidoParar`: si los dos corren a la vez, el pedido de parar se puede perder
     * entre la lectura de `arrancando` y su puesta en false, y el servicio queda prendido sin
     * transmisión (review N1 de la Tarea 9). Por eso el trabajo se hace siempre en el principal.
     * Desde el principal se hace en el acto, no con post: así un terminar() seguido de un iniciar()
     * no para el servicio nuevo con un parar() que llegó tarde.
     */
    fun parar(ctx: Context) {
      val app = ctx.applicationContext
      val gen = generacion
      if (Looper.myLooper() == Looper.getMainLooper()) pararEnPrincipal(app, gen)
      else principal.post { pararEnPrincipal(app, gen) }
    }

    private fun pararEnPrincipal(ctx: Context, gen: Int) {
      if (gen != generacion) {
        Log.w(TAG, "servicio: parar viejo ignorado (hubo un arranque nuevo)")
        return
      }
      if (arrancando) {
        pedidoParar = true
        return
      }
      ctx.stopService(Intent(ctx, ServicioTransmision::class.java))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val n = notificacion()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        startForeground(
          ID,
          n,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
        )
      } else {
        startForeground(ID, n)
      }
      activo = true
      Log.w(TAG, "servicio en primer plano activo")
      Motor.servicioArranco(true)
    } catch (e: Exception) {
      // Sin stopSelf: un stop sin startForeground es justo lo que el sistema castiga. El servicio
      // queda sin primer plano hasta que Motor lo pare al terminar. No verificado en el celular.
      Log.w(TAG, "servicio: startForeground fallo (${e.javaClass.simpleName})")
      Motor.servicioArranco(false)
    }
    arrancando = false
    // Solo después de un startForeground que salió bien. Si falló, el servicio queda sin hacer nada
    // hasta el próximo parar() (al terminar la próxima transmisión).
    if (pedidoParar && activo) {
      pedidoParar = false
      stopSelf()
    }
    // Si el sistema mata el proceso no se vuelve a crear solo: la transmisión ya no existe.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    activo = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
    Log.w(TAG, "servicio detenido")
    super.onDestroy()
  }

  private fun notificacion(): Notification {
    val abrir = packageManager.getLaunchIntentForPackage(packageName)?.let {
      // addFlags: conserva los flags que pone getLaunchIntentForPackage (review M9).
      it.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      if (nm.getNotificationChannel(CANAL) == null) {
        val canal = NotificationChannel(CANAL, "Transmisión en vivo", NotificationManager.IMPORTANCE_LOW)
        canal.description = "Aviso fijo mientras se transmite"
        nm.createNotificationChannel(canal)
      }
      Notification.Builder(this, CANAL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    // Ícono chico: blanco sobre transparente (res/drawable-*/ic_notificacion.png, generado con
    // `npm run iconos`). El ícono de la app a color se veía como un cuadro blanco (review M8).
    b.setSmallIcon(R.drawable.ic_notificacion)
      .setContentTitle("Transmitiendo en vivo")
      .setContentText("La cámara y el micrófono siguen al aire. Toque para volver a la app.")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
    abrir?.let { b.setContentIntent(it) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    return b.build()
  }
}
