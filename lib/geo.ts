/** Local east/north meters around the Kaaba. Accurate to well under a meter inside 1 km. */
const EARTH = 6378137
export const KAABA_LAT = 21.4225079
export const KAABA_LNG = 39.826189
const COS = Math.cos((KAABA_LAT * Math.PI) / 180)

export type LocalPoint = { x: number; y: number }

export function toLocal(lat: number, lng: number): LocalPoint {
  const x = ((lng - KAABA_LNG) * Math.PI) / 180 * COS * EARTH
  const y = ((lat - KAABA_LAT) * Math.PI) / 180 * EARTH
  return { x, y }
}

export function fromLocal(x: number, y: number) {
  const lat = KAABA_LAT + (y / EARTH) * (180 / Math.PI)
  const lng = KAABA_LNG + (x / (EARTH * COS)) * (180 / Math.PI)
  return { lat, lng }
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const a = toLocal(lat1, lng1)
  const b = toLocal(lat2, lng2)
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Degrees clockwise from north. */
export function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const a = toLocal(lat1, lng1)
  const b = toLocal(lat2, lng2)
  const deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI
  return (deg + 360) % 360
}

export function destination(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number,
) {
  const rad = (bearingDeg * Math.PI) / 180
  const origin = toLocal(lat, lng)
  return fromLocal(
    origin.x + Math.sin(rad) * distanceM,
    origin.y + Math.cos(rad) * distanceM,
  )
}

export function circleRing(
  lat: number,
  lng: number,
  radiusM: number,
  steps = 72,
) {
  const ring: number[][] = []
  for (let i = 0; i <= steps; i += 1) {
    const point = destination(lat, lng, (i / steps) * 360, radiusM)
    ring.push([point.lng, point.lat])
  }
  return ring
}

export function pointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const dy = yj - yi
    if (yi > lat !== yj > lat && dy !== 0) {
      const x = ((xj - xi) * (lat - yi)) / dy + xi
      if (lng < x) inside = !inside
    }
  }
  return inside
}

export function nearestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return { x: ax + t * dx, y: ay + t * dy }
}

export function nearestOnPolyline(lat: number, lng: number, line: number[][]) {
  const point = toLocal(lat, lng)
  let best = Number.POSITIVE_INFINITY
  let x = point.x
  let y = point.y
  for (let i = 1; i < line.length; i += 1) {
    const a = toLocal(line[i - 1][1], line[i - 1][0])
    const b = toLocal(line[i][1], line[i][0])
    const nearest = nearestPointOnSegment(point.x, point.y, a.x, a.y, b.x, b.y)
    const distance = Math.hypot(point.x - nearest.x, point.y - nearest.y)
    if (distance < best) {
      best = distance
      x = nearest.x
      y = nearest.y
    }
  }
  const geographic = fromLocal(x, y)
  return { lat: geographic.lat, lng: geographic.lng, distance: best }
}

export function smoothAngle(prev: number | null, next: number, alpha: number) {
  if (prev == null || Number.isNaN(prev)) return next
  const delta = (((next - prev + 540) % 360) - 180)
  return (prev + delta * alpha + 360) % 360
}

export function ringCentroid(ring: number[][]) {
  let lng = 0
  let lat = 0
  let count = 0
  for (let i = 0; i < ring.length; i += 1) {
    const isClosing =
      i === ring.length - 1 && ring[i][0] === ring[0][0] && ring[i][1] === ring[0][1]
    if (isClosing) break
    lng += ring[i][0]
    lat += ring[i][1]
    count += 1
  }
  return { lng: lng / count, lat: lat / count }
}
