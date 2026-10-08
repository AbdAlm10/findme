import assert from "node:assert/strict"
import test from "node:test"
import { constrainPosition, LocationEngine } from "../lib/engine"
import { bearingDegrees, destination, distanceMeters, KAABA_LAT, KAABA_LNG } from "../lib/geo"
import { haram } from "../lib/haram"
import { Kalman2D } from "../lib/kalman"
import { confidenceOf, StepDetector } from "../lib/sensors"
import { cardinal } from "../lib/format"

test("local projection is symmetric within a meter at 100 m", () => {
  const point = destination(KAABA_LAT, KAABA_LNG, 0, 100)
  const distance = distanceMeters(KAABA_LAT, KAABA_LNG, point.lat, point.lng)
  assert.ok(Math.abs(distance - 100) < 0.5)
  const bearing = bearingDegrees(KAABA_LAT, KAABA_LNG, point.lat, point.lng)
  assert.ok(bearing < 1 || bearing > 359)
  assert.equal(cardinal(90), "شرق")
})

test("a fix inside the Kaaba is pushed outside", () => {
  const ring = haram.kaabaShape.coordinates[0]
  let lng = 0
  let lat = 0
  let count = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    lng += ring[i][0]
    lat += ring[i][1]
    count += 1
  }
  const constrained = constrainPosition(lat / count, lng / count, 8, "ground")
  assert.equal(constrained.snapped, true)
  const away = distanceMeters(haram.kaaba.lat, haram.kaaba.lng, constrained.lat, constrained.lng)
  assert.ok(away > 3)
})

test("sa'i floor gently pulls a nearby point toward the course", () => {
  const line = haram.sai.coordinates
  const start = { lng: line[0][0], lat: line[0][1] }
  const side = destination(start.lat, start.lng, 90, 14)
  const before = distanceMeters(start.lat, start.lng, side.lat, side.lng)
  const constrained = constrainPosition(side.lat, side.lng, 20, "sai")
  const after = distanceMeters(start.lat, start.lng, constrained.lat, constrained.lng)
  assert.ok(after < before)
})

test("kalman rejects a distant outlier and keeps the walker near the first fixes", () => {
  const filter = new Kalman2D()
  filter.reset(0, 0, 8)
  filter.predict(1)
  assert.equal(filter.update(4, -2, 8), true)
  filter.predict(1)
  assert.equal(filter.update(500, 500, 8), false)
  assert.ok(Math.hypot(filter.x[0], filter.x[1]) < 40)
})

test("repeated GPS around one spot settles instead of jumping", () => {
  const engine = new LocationEngine()
  const now = 1_000_000
  for (let i = 0; i < 8; i += 1) {
    const wobble = destination(KAABA_LAT, KAABA_LNG, i * 40, 6)
    engine.ingestGps(wobble.lat, wobble.lng, 8, now + i * 1000)
  }
  const fix = engine.snapshot(now + 8000)
  assert.ok(fix)
  assert.equal(fix.source, "gps")
  assert.ok(fix.accuracy >= 5)
  assert.ok(fix.accuracy <= 20)
  assert.ok(distanceMeters(KAABA_LAT, KAABA_LNG, fix.lat, fix.lng) < 20)
})

test("steps carry the fix after GPS goes stale and accuracy grows", () => {
  const engine = new LocationEngine()
  const now = 5_000_000
  engine.ingestGps(KAABA_LAT, KAABA_LNG, 8, now)
  const before = engine.snapshot(now)
  assert.ok(before)
  engine.ingestStep(0, 10, now + 4000)
  const fix = engine.snapshot(now + 5000)
  assert.ok(fix)
  assert.equal(fix.source, "pdr")
  const moved = distanceMeters(before.lat, before.lng, fix.lat, fix.lng)
  assert.ok(moved > 6)
  assert.ok(fix.accuracy > 8)
})

test("step detector counts walking peaks and ignores stillness", () => {
  const detector = new StepDetector()
  let steps = 0
  for (let t = 0; t < 4000; t += 50) {
    const magnitude = 9.8 + (t % 500 < 80 ? 2.4 : 0)
    if (detector.push(t, magnitude)) steps += 1
  }
  assert.ok(steps >= 6 && steps <= 9)
  const still = new StepDetector()
  let stillSteps = 0
  for (let t = 0; t < 3000; t += 50) {
    if (still.push(t, 9.8)) stillSteps += 1
  }
  assert.equal(stillSteps, 0)
})

test("confidence stays honest when the fix is coarse or old", () => {
  assert.equal(confidenceOf(6, "gps", 1000), "high")
  assert.equal(confidenceOf(12, "gps", 2000), "medium")
  assert.equal(confidenceOf(40, "gps", 1000), "low")
  assert.equal(confidenceOf(8, "last", 1000), "low")
})
