package org.parroquiaarce.transmisor

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/*
 * Datos del sistema para los avisos y el registro de rendimiento (Tarea 9).
 * APIs comprobadas en platforms/android-36/data/api-versions.xml:
 *  - PowerManager.getCurrentThermalStatus(): desde API 29. THERMAL_STATUS_MODERATE = 2,
 *    THERMAL_STATUS_SEVERE = 3 (javap -constants sobre android.jar);
 *  - BatteryManager.EXTRA_TEMPERATURE (décimas de °C) del ACTION_BATTERY_CHANGED fijo: API 5;
 *  - Debug.getPss() (KB, solo el proceso de la app; no cuenta el renderer de las WebViews): API 14;
 *  - NotificationManager.getCurrentInterruptionFilter(): API 23 (INTERRUPTION_FILTER_ALL = 1);
 *  - Settings.ACTION_ZEN_MODE_PRIORITY_SETTINGS: API 26.
 */
object Sistema {
  private const val TAG = "Transmisor"

  /** Estado térmico del sistema (0 a 6), o null antes de Android 10. */
  fun termico(ctx: Context): Int? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return null
    return pm.currentThermalStatus
  }

  /** Temperatura de la batería en °C, o null si el sistema no la da. */
  fun temperaturaBateria(ctx: Context): Double? {
    // registerReceiver con receptor null solo lee el último aviso fijo: no registra nada.
    val i = ctx.applicationContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return null
    val decimas = i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
    return if (decimas == Int.MIN_VALUE) null else decimas / 10.0
  }

  /** Memoria del proceso de la app (PSS), en MB. */
  fun memoriaMb(): Double = Debug.getPss() / 1024.0

  /** true si No molestar está activado (cualquier filtro que no sea «todas»). */
  fun noMolestarActivo(ctx: Context): Boolean? {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return null
    val f = nm.currentInterruptionFilter
    if (f == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) return null
    return f != NotificationManager.INTERRUPTION_FILTER_ALL
  }

  /**
   * Abre la pantalla de No molestar del sistema. Si este celular no la tiene, abre los Ajustes
   * generales. Devuelve false si no pudo abrir nada. No verificado en Samsung que la primera abra.
   */
  fun abrirNoMolestar(actividad: Activity): Boolean {
    val acciones = buildList {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) add(Settings.ACTION_ZEN_MODE_PRIORITY_SETTINGS)
      add(Settings.ACTION_SETTINGS)
    }
    for (accion in acciones) {
      try {
        actividad.startActivity(Intent(accion))
        Log.w(TAG, "ajustes del sistema abiertos: $accion")
        return true
      } catch (e: Exception) {
        Log.w(TAG, "no se pudo abrir $accion")
      }
    }
    return false
  }
}
