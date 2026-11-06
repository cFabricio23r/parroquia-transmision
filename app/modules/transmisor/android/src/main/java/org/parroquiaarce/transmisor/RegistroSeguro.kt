package org.parroquiaarce.transmisor

import android.util.Log

// La clave nunca debe llegar a logcat.
//
// RootEncoder 2.8.1 la escribe por su cuenta: CommandsManagerImp hace
// Log.i("CommandsManager", "send $publish"), y el comando «publish» (igual que
// «releaseStream» y «FCPublish») lleva la clave como AmfString. La librería no
// permite apagarlo, así que se sube la prioridad mínima de log de todo el
// proceso a WARN: los Log.v/d/i de la app y de las librerías no se escriben.
// Los nuestros usan Log.w y nunca llevan la URL ni la clave (ver Motor.redactar).
object RegistroSeguro {
  private const val TAG = "Transmisor"

  // Valor de ANDROID_LOG_WARN en android/log.h.
  private const val ANDROID_LOG_WARN = 5

  @Volatile
  var activo = false
    private set

  @JvmStatic
  private external fun fijarPrioridadMinima(prioridad: Int): Boolean

  fun activar() {
    if (activo) return
    activo = try {
      System.loadLibrary("transmisorlog")
      fijarPrioridadMinima(ANDROID_LOG_WARN)
    } catch (e: Throwable) {
      false
    }
    Log.w(TAG, "registro seguro (prioridad minima WARN) activo=$activo")
  }
}
