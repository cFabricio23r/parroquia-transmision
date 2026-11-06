package org.parroquiaarce.transmisor

import android.content.Context
import android.view.SurfaceHolder
import android.view.SurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

// Vista previa de la cámara. La imagen aparece cuando JS llamó a prepararVista().
class TransmisorView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val sv = SurfaceView(context)

  init {
    addView(sv, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    sv.holder.addCallback(object : SurfaceHolder.Callback {
      override fun surfaceCreated(holder: SurfaceHolder) = Motor.superficieLista(sv)
      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) =
        Motor.superficieCambio(width, height)
      override fun surfaceDestroyed(holder: SurfaceHolder) = Motor.superficieFuera(sv)
    })
  }
}
