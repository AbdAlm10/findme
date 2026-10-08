export class StepDetector {
  private mean = 9.8
  private high = false
  private lastStepAt = 0

  push(timeMs: number, magnitude: number) {
    if (!Number.isFinite(magnitude) || magnitude < 2) return false
    this.mean = this.mean * 0.92 + magnitude * 0.08
    const highPassed = magnitude - this.mean
    const peak = highPassed > 1.2
    let step = false
    if (peak && !this.high && timeMs - this.lastStepAt > 320) {
      step = true
      this.lastStepAt = timeMs
    }
    this.high = peak
    return step
  }
}

/** DeviceOrientation alpha/beta/gamma → clockwise degrees from north. */
export function compassHeading(alpha: number, beta: number, gamma: number) {
  const toRad = Math.PI / 180
  const x = beta * toRad
  const y = gamma * toRad
  const z = alpha * toRad
  const cY = Math.cos(y)
  const cZ = Math.cos(z)
  const sX = Math.sin(x)
  const sY = Math.sin(y)
  const sZ = Math.sin(z)
  const vx = -cZ * sY - sZ * sX * cY
  const vy = -sZ * sY + cZ * sX * cY
  const heading = Math.atan2(vx, vy)
  return ((heading * 180) / Math.PI + 360) % 360
}

export function confidenceOf(
  accuracy: number,
  source: "gps" | "pdr" | "last",
  ageMs: number,
): "high" | "medium" | "low" {
  if (ageMs > 30000 || accuracy > 30 || source === "last") return "low"
  if (source === "gps" && accuracy <= 8 && ageMs < 5000) return "high"
  if (accuracy <= 15 && ageMs < 12000) return "medium"
  if (source === "pdr" && accuracy <= 20) return "medium"
  return "low"
}
