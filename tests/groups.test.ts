import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rifaq-"))
process.env.RIFAQ_DATA_DIR = dir

test("a group can be created, joined, updated, and left without leaking tokens", async () => {
  const store = await import("../lib/groups")
  store.resetStoreForTests()
  const created = store.createGroup("  أحمد  ", "عائلة الحرم")
  assert.ok(!("error" in created))
  if ("error" in created) return
  assert.equal(created.name, "أحمد")
  assert.equal(created.code.length, 6)

  const joined = store.joinGroup(` ${created.code} `, "سارة")
  assert.ok(!("error" in joined))
  if ("error" in joined) return

  const denied = store.updateLocation(created.code, {
    token: "not-the-token",
    lat: 21.4225,
    lng: 39.8262,
    accuracy: 8,
    floor: "ground",
    source: "gps",
    confidence: "high",
  })
  assert.equal(denied.status, 403)

  const updated = store.updateLocation(created.code, {
    token: created.token,
    lat: 21.4229,
    lng: 39.8264,
    accuracy: 6.2,
    heading: 450,
    speed: 1.1,
    floor: "first",
    source: "gps",
    confidence: "high",
  })
  assert.ok(!("error" in updated))

  const snap = store.snapshot(created.code)
  assert.ok(snap)
  assert.equal(snap.members.length, 2)
  const raw = JSON.stringify(snap)
  assert.equal(raw.includes(created.token), false)
  const ahmed = snap.members.find((member) => member.name === "أحمد")
  assert.equal(ahmed?.location?.floor, "first")
  assert.equal(ahmed?.location?.heading, 90)
  assert.equal(ahmed?.location?.accuracy, 6)

  const bad = store.joinGroup("ZZZZZZ", "علي")
  assert.ok("error" in bad)

  assert.ok(!("error" in store.leaveGroup(created.code, joined.token)))
  assert.equal(store.snapshot(created.code)?.members.length, 1)
  assert.ok(!("error" in store.leaveGroup(created.code, created.token)))
  assert.equal(store.snapshot(created.code), null)
})
