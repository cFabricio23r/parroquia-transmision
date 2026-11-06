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
import android.os.IBinder
import android.util.Log

/*
 * Servicio en primer plano de tipo camera|microphone (Tarea 1, punto 7): sin él, Android bloquea
 * la cámara y silencia el micrófono a los pocos segundos de pasar a segundo plano o de apagar la
 * pantalla, y el vivo queda congelado sin aviso.
 *
 * - Se arranca en Motor.iniciar(), con la app en primer plano y antes de startStream.
 * - Se para cuando la transmisión termina o se corta del todo (Motor.soltar).
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

    fun arrancar(ctx: Context) {
      val i = Intent(ctx, ServicioTransmision::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
      } catch (e: Exception) {
        // Sin el servicio la transmisión sigue, pero se corta al pasar a segundo plano.
        Log.w(TAG, "servicio: no se pudo arrancar (${e.javaClass.simpleName})")
      }
    }

    fun parar(ctx: Context) {
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
    } catch (e: Exception) {
      Log.w(TAG, "servicio: startForeground fallo (${e.javaClass.simpleName})")
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
      it.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
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
    b.setSmallIcon(applicationInfo.icon)
      .setContentTitle("Transmitiendo en vivo")
      .setContentText("La cámara y el micrófono siguen al aire. Toque para volver a la app.")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
    abrir?.let { b.setContentIntent(it) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    return b.build()
  }
}
