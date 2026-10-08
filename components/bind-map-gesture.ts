export type GesturePoint = { x: number; y: number }

type Handlers = {
  shouldIgnore: (target: EventTarget | null) => boolean
  onStart: () => void
  onMove: (origin: GesturePoint[], current: GesturePoint[], rect: DOMRect) => void
  onEnd: () => void
}

function touchesOf(list: TouchList): GesturePoint[] {
  return Array.from(list, (touch) => ({ x: touch.clientX, y: touch.clientY }))
}

export function bindMapGesture(element: HTMLElement, handlers: Handlers) {
  let touchOrigin: GesturePoint[] | null = null
  let mouse: { id: number; origin: GesturePoint } | null = null

  const touchStart = (event: TouchEvent) => {
    if (event.touches.length === 1 && handlers.shouldIgnore(event.target)) return
    event.preventDefault()
    touchOrigin = touchesOf(event.touches)
    handlers.onStart()
  }
  const touchMove = (event: TouchEvent) => {
    if (!touchOrigin || event.touches.length !== touchOrigin.length) return
    event.preventDefault()
    handlers.onMove(touchOrigin, touchesOf(event.touches), element.getBoundingClientRect())
  }
  const touchEnd = (event: TouchEvent) => {
    if (!touchOrigin) return
    if (event.touches.length === 0) {
      touchOrigin = null
      handlers.onEnd()
      return
    }
    touchOrigin = touchesOf(event.touches)
    handlers.onStart()
  }
  const pointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return
    if (handlers.shouldIgnore(event.target)) return
    mouse = { id: event.pointerId, origin: { x: event.clientX, y: event.clientY } }
    handlers.onStart()
  }
  const pointerMove = (event: PointerEvent) => {
    if (!mouse || mouse.id !== event.pointerId) return
    handlers.onMove([mouse.origin], [{ x: event.clientX, y: event.clientY }], element.getBoundingClientRect())
  }
  const pointerUp = (event: PointerEvent) => {
    if (!mouse || mouse.id !== event.pointerId) return
    mouse = null
    handlers.onEnd()
  }

  element.addEventListener("touchstart", touchStart, { passive: false })
  element.addEventListener("touchmove", touchMove, { passive: false })
  element.addEventListener("touchend", touchEnd)
  element.addEventListener("touchcancel", touchEnd)
  element.addEventListener("pointerdown", pointerDown)
  window.addEventListener("pointermove", pointerMove)
  window.addEventListener("pointerup", pointerUp)
  window.addEventListener("pointercancel", pointerUp)
  return () => {
    element.removeEventListener("touchstart", touchStart)
    element.removeEventListener("touchmove", touchMove)
    element.removeEventListener("touchend", touchEnd)
    element.removeEventListener("touchcancel", touchEnd)
    element.removeEventListener("pointerdown", pointerDown)
    window.removeEventListener("pointermove", pointerMove)
    window.removeEventListener("pointerup", pointerUp)
    window.removeEventListener("pointercancel", pointerUp)
  }
}

export function isPinTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".pin"))
}
