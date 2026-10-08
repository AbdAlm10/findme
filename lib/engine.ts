import { fromLocal, nearestOnPolyline, pointInRing, toLocal } from "@/lib/geo"
import { haram } from "@/lib/haram"
import { Kalman2D } from "@/lib/kalman"
import { confidenceOf } from "@/lib/sensors"
import type { Confidence, FixSource, FloorId } from "@/lib/types"

export type EngineFix = {
  lat: number
  lng: number
  accuracy: number
  source: FixSource
  confidence: Confidence
  snapped: boolean
}

export function constrainPosition(
  lat: number,
  lng: number,
  accuracy: number,
  floor: FloorId,
) {
  const kaaba = haram.kaabaShape.coordinates[0]
  if (pointInRing(lng, lat, kaaba)) {
    const edge = nearestOnPolyline(lat, lng, kaaba)
    const inside = toLocal(lat, lng)
    const boundary = toLocal(edge.lat, edge.lng)
    const vx = boundary.x - inside.x
    const vy = boundary.y - inside.y
    const length = Math.hypot(vx, vy) || 1
    const outside = fromLocal(boundary.x + (vx / length) * 2.5, boundary.y + (vy / length) * 2.5)
    return { ...outside, snapped: true }
  }

  if (floor === "sai") {
    const nearest = nearestOnPolyline(lat, lng, haram.sai.coordinates)
    if (nearest.distance > 1 && nearest.distance < Math.max(10, accuracy) && accuracy >= 8) {
      const pull = 0.35
      return {
        lat: lat + (nearest.lat - lat) * pull,
        lng: lng + (nearest.lng - lng) * pull,
        snapped: true,
      }
    }
  }

  return { lat, lng, snapped: false }
}

export class LocationEngine {
  private filter = new Kalman2D()
  private floor: FloorId = "ground"
  private lastTick = 0
  private lastGpsAt = 0
  private lastStepAt = 0
  private lastGpsAccuracy = 30
  private snapped = false

  setFloor(floor: FloorId) {
    this.floor = floor
  }

  ingestGps(lat: number, lng: number, accuracy: number, now: number) {
    const safeAccuracy = Number.isFinite(accuracy) ? Math.min(Math.max(accuracy, 1), 200) : 40
    const constrained = constrainPosition(lat, lng, safeAccuracy, this.floor)
    const local = toLocal(constrained.lat, constrained.lng)
    if (!this.filter.initialized) {
      this.filter.reset(local.x, local.y, safeAccuracy)
    } else {
      const dt = Math.max(0, (now - this.lastTick) / 1000)
      if (dt >= 0.05) this.filter.predict(dt)
      this.filter.update(local.x, local.y, safeAccuracy)
    }
    this.lastTick = now
    this.lastGpsAt = now
    this.lastGpsAccuracy = safeAccuracy
    this.snapped = constrained.snapped
  }

  ingestStep(headingDeg: number, strideM: number, now: number) {
    if (!this.filter.initialized || !Number.isFinite(headingDeg)) return
    const dt = Math.max(0.3, (now - this.lastTick) / 1000)
    const rad = (headingDeg * Math.PI) / 180
    this.filter.predict(dt, {
      de: Math.sin(rad) * strideM,
      dn: Math.cos(rad) * strideM,
    })
    this.lastTick = now
    this.lastStepAt = now
  }

  coast(now: number) {
    if (!this.filter.initialized) return
    const dt = (now - this.lastTick) / 1000
    if (dt < 0.4) return
    this.filter.predict(dt)
    this.lastTick = now
  }

  snapshot(now: number): EngineFix | null {
    if (!this.filter.initialized) return null
    const gpsAge = now - this.lastGpsAt
    const stepAge = now - this.lastStepAt
    let source: FixSource = "gps"
    if (gpsAge > 3000 && stepAge < 8000) source = "pdr"
    else if (gpsAge > 3000) source = "last"

    let accuracy = this.filter.sigma()
    if (source === "gps") accuracy = Math.max(accuracy, Math.min(this.lastGpsAccuracy, accuracy + 3))
    else accuracy = Math.max(accuracy, this.lastGpsAccuracy + (gpsAge / 1000) * 0.45)
    accuracy = Math.max(5, Math.round(accuracy))

    const point = fromLocal(this.filter.x[0], this.filter.x[1])
    return {
      lat: point.lat,
      lng: point.lng,
      accuracy,
      source,
      confidence: confidenceOf(accuracy, source, gpsAge),
      snapped: this.snapped,
    }
  }
}
