import assert from "node:assert/strict"
import test from "node:test"
import { applyWorldGesture, type WorldCamera } from "../lib/world-camera"

const box = { left: 0, top: 0, width: 400, height: 800 }
const start: WorldCamera = { lat: 21.4225, lng: 39.8262, zoom: 14 }

test("a finger drag moves the world camera and a still finger leaves it", () => {
  const still = applyWorldGesture(start, [{ x: 40, y: 80 }], [{ x: 40, y: 80 }], box)
  assert.ok(still)
  assert.ok(Math.abs(still.lat - start.lat) < 1e-9)
  assert.ok(Math.abs(still.lng - start.lng) < 1e-9)

  const dragged = applyWorldGesture(start, [{ x: 40, y: 80 }], [{ x: 140, y: 80 }], box)
  assert.ok(dragged)
  assert.ok(dragged.lng < start.lng)
  assert.equal(dragged.zoom, start.zoom)
})

test("pinching the fingers apart zooms in around the gesture", () => {
  const zoomed = applyWorldGesture(
    start,
    [
      { x: 150, y: 300 },
      { x: 250, y: 300 },
    ],
    [
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ],
    box,
  )
  assert.ok(zoomed)
  assert.equal(zoomed.zoom, 15)
  assert.ok(Math.abs(zoomed.lat - start.lat) < 0.02)
  assert.ok(Math.abs(zoomed.lng - start.lng) < 0.02)
})
