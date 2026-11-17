package org.parroquiaarce.transmisor

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowInsets
import kotlin.math.abs

/*
 * Zonas seguras en dp: barra de estado, recorte de la cámara y barra de navegación (Tarea 9c).
 *
 * Tarea 9i: además de leerlas cuando JS las pide, avisa cada vez que cambian. Antes solo se leían al
 * cambiar el tamaño de la ventana (y 400 ms después), y la app se quedaba con la medida vieja si la barra
 * se acomodaba tarde tras el giro o si se pasaba de gestos a botones con la app abierta.
 *
 * Se escucha con ViewTreeObserver.OnGlobalLayoutListener: un cambio de insets vuelve a acomodar la vista.
 * No se usa setOnApplyWindowInsetsListener sobre la vista raíz porque reemplazaría el oyente que pueda
 * tener React Native o Expo para el borde a borde.
 *
 * Todo en el hilo principal.
 */
object Zonas {
  private var vista: View? = null
  private var oyente: ViewTreeObserver.OnGlobalLayoutListener? = null
  private var ultima: Map<String, Double>? = null
  private var alCambiar: ((Map<String, Double>) -> Unit)? = null

  /** Las zonas de ahora. WindowInsets.getInsets y Type desde la API 30; antes, systemWindowInset*. */
  fun leer(actividad: Activity): Map<String, Double> {
    val v = actividad.window.decorView
    val d = v.resources.displayMetrics.density.toDouble()
    val ins = v.rootWindowInsets ?: return mapOf("top" to 0.0, "bottom" to 0.0, "left" to 0.0, "right" to 0.0)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val i = ins.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      mapOf("top" to i.top / d, "bottom" to i.bottom / d, "left" to i.left / d, "right" to i.right / d)
    } else {
      @Suppress("DEPRECATION")
      mapOf(
        "top" to ins.systemWindowInsetTop / d,
        "bottom" to ins.systemWindowInsetBottom / d,
        "left" to ins.systemWindowInsetLeft / d,
        "right" to ins.systemWindowInsetRight / d,
      )
    }
  }

  /** Empieza a avisar los cambios de esta actividad. Si ya escuchaba otra vista, la suelta. */
  fun escuchar(actividad: Activity, cb: (Map<String, Double>) -> Unit) {
    alCambiar = cb
    val v = actividad.window.decorView
    if (vista === v && oyente != null) return
    soltar()
    val o = ViewTreeObserver.OnGlobalLayoutListener {
      val z = leer(actividad)
      if (!iguales(z, ultima)) {
        ultima = z
        alCambiar?.invoke(z)
      }
    }
    v.viewTreeObserver.addOnGlobalLayoutListener(o)
    vista = v
    oyente = o
  }

  fun soltar() {
    val v = vista
    val o = oyente
    if (v != null && o != null && v.viewTreeObserver.isAlive) v.viewTreeObserver.removeOnGlobalLayoutListener(o)
    vista = null
    oyente = null
    ultima = null
  }

  /** Deja de avisar a JS (el runtime se va), sin tocar la vista: se puede llamar desde cualquier hilo. */
  fun olvidarAviso() {
    alCambiar = null
  }

  // Menos de medio dp es redondeo de la densidad.
  private fun iguales(a: Map<String, Double>, b: Map<String, Double>?): Boolean =
    b != null && a.keys.all { abs((a[it] ?: 0.0) - (b[it] ?: 0.0)) < 0.5 }
}
