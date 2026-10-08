export type WorldCamera = { lat: number; lng: number; zoom: number }
export type ScreenPoint = { x: number; y: number }
export type ScreenBox = { left: number; top: number; width: number; height: number }

export const WORLD_CAMERA: WorldCamera = { lat: 18, lng: 20, zoom: 2 }

const MIN_ZOOM = 2
const MAX_ZOOM = 18

export function project(lat: number, lng: number, zoom: number) {
  const size = 256 * 2 ** zoom
  const x = ((lng + 180) / 360) * size
  const sine = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999)
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size
  return { x, y }
}

export function unproject(x: number, y: number, zoom: number) {
  const size = 256 * 2 ** zoom
  const lng = (x / size) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / size
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lat: Math.min(80, Math.max(-80, lat)), lng }
}

function zoomAround(start: WorldCamera, zoom: number, from: ScreenPoint, to: ScreenPoint, box: ScreenBox): WorldCamera {
  const center = project(start.lat, start.lng, start.zoom)
  const anchor = unproject(
    center.x + (from.x - box.left - box.width / 2),
    center.y + (from.y - box.top - box.height / 2),
    start.zoom,
  )
  const anchorPx = project(anchor.lat, anchor.lng, zoom)
  const next = unproject(
    anchorPx.x - (to.x - box.left - box.width / 2),
    anchorPx.y - (to.y - box.top - box.height / 2),
    zoom,
  )
  return { lat: next.lat, lng: next.lng, zoom }
}

export function applyWorldGesture(
  start: WorldCamera,
  origin: ScreenPoint[],
  current: ScreenPoint[],
  box: ScreenBox,
): WorldCamera | null {
  if (box.width < 1 || box.height < 1 || origin.length === 0 || origin.length !== current.length) return null
  if (origin.length === 1) {
    const moved = unproject(
      project(start.lat, start.lng, start.zoom).x - (current[0].x - origin[0].x),
      project(start.lat, start.lng, start.zoom).y - (current[0].y - origin[0].y),
      start.zoom,
    )
    return { lat: moved.lat, lng: moved.lng, zoom: start.zoom }
  }
  const dist0 = Math.hypot(origin[1].x - origin[0].x, origin[1].y - origin[0].y) || 1
  const dist1 = Math.hypot(current[1].x - current[0].x, current[1].y - current[0].y) || 1
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom + Math.log2(dist1 / dist0)))
  const from = { x: (origin[0].x + origin[1].x) / 2, y: (origin[0].y + origin[1].y) / 2 }
  const to = { x: (current[0].x + current[1].x) / 2, y: (current[0].y + current[1].y) / 2 }
  return zoomAround(start, zoom, from, to, box)
}
