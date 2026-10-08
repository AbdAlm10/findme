import crypto from "crypto"
import fs from "fs"
import path from "path"
import { cleanName, normalizeCode } from "@/lib/codes"
import { confidenceOf } from "@/lib/sensors"
import {
  isFloorId,
  MEMBER_COLORS,
  type Confidence,
  type FixSource,
  type FloorId,
  type PublicMember,
  type SharedLocation,
  type Snapshot,
} from "@/lib/types"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const MAX_MEMBERS = 6

type StoredMember = {
  id: string
  tokenHash: string
  name: string
  color: string
  joinedAt: number
  location: SharedLocation | null
}

type StoredGroup = {
  code: string
  name: string
  createdAt: number
  members: StoredMember[]
}

type Listener = (snapshot: Snapshot | null) => void

type Memory = {
  groups: Map<string, StoredGroup>
  listeners: Map<string, Set<Listener>>
  loaded: boolean
}

const globalStore = globalThis as unknown as { __rifaq?: Memory }

function memory(): Memory {
  if (!globalStore.__rifaq) {
    globalStore.__rifaq = {
      groups: new Map(),
      listeners: new Map(),
      loaded: false,
    }
  }
  return globalStore.__rifaq
}

function storeFile() {
  const dir = process.env.RIFAQ_DATA_DIR ?? path.join(process.cwd(), "data")
  return path.join(dir, "groups.json")
}

function load() {
  const state = memory()
  if (state.loaded) return
  state.loaded = true
  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile(), "utf8")) as StoredGroup[]
    for (const group of parsed) state.groups.set(group.code, group)
  } catch {
    /* first run */
  }
}

function save() {
  const file = storeFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, JSON.stringify([...memory().groups.values()]))
  fs.renameSync(temp, file)
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export { cleanName, normalizeCode }

function makeCode() {
  const state = memory()
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bytes = crypto.randomBytes(6)
    const code = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("")
    if (!state.groups.has(code)) return code
  }
  throw new Error("تعذر إنشاء رمز المجموعة")
}

function toPublic(member: StoredMember): PublicMember {
  return {
    id: member.id,
    name: member.name,
    color: member.color,
    location: member.location,
  }
}

export function snapshot(code: string): Snapshot | null {
  load()
  const group = memory().groups.get(normalizeCode(code))
  if (!group) return null
  return {
    code: group.code,
    groupName: group.name,
    serverNow: Date.now(),
    members: group.members.map(toPublic),
  }
}

function publish(code: string) {
  const snap = snapshot(code)
  for (const listener of memory().listeners.get(code) ?? []) listener(snap)
}

export function subscribe(code: string, listener: Listener) {
  load()
  const normalized = normalizeCode(code)
  const state = memory()
  const set = state.listeners.get(normalized) ?? new Set()
  set.add(listener)
  state.listeners.set(normalized, set)
  return () => {
    set.delete(listener)
  }
}

function issueMember(name: string, index: number) {
  const token = crypto.randomBytes(24).toString("hex")
  const member: StoredMember = {
    id: crypto.randomBytes(8).toString("hex"),
    tokenHash: hashToken(token),
    name,
    color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    joinedAt: Date.now(),
    location: null,
  }
  return { member, token }
}

export function createGroup(rawName: unknown, rawGroupName: unknown) {
  load()
  const name = cleanName(rawName)
  if (!name) return { error: "اكتب اسمك أولاً" as const }
  const groupName = cleanName(rawGroupName, "مجموعة العائلة") ?? "مجموعة العائلة"
  const code = makeCode()
  const { member, token } = issueMember(name, 0)
  const group: StoredGroup = {
    code,
    name: groupName,
    createdAt: Date.now(),
    members: [member],
  }
  memory().groups.set(code, group)
  save()
  publish(code)
  return {
    code,
    groupName,
    memberId: member.id,
    token,
    name: member.name,
    color: member.color,
  }
}

export function joinGroup(rawCode: unknown, rawName: unknown) {
  load()
  const code = normalizeCode(typeof rawCode === "string" ? rawCode : "")
  const group = memory().groups.get(code)
  if (!group || code.length < 6) return { error: "الرمز غير صحيح" as const }
  if (group.members.length >= MAX_MEMBERS) return { error: "المجموعة اكتملت" as const }
  const name = cleanName(rawName)
  if (!name) return { error: "اكتب اسمك أولاً" as const }
  const { member, token } = issueMember(name, group.members.length)
  group.members.push(member)
  save()
  publish(code)
  return {
    code,
    groupName: group.name,
    memberId: member.id,
    token,
    name: member.name,
    color: member.color,
  }
}

function findMember(code: string, token: unknown) {
  if (typeof token !== "string" || token.length < 16) return null
  const group = memory().groups.get(normalizeCode(code))
  if (!group) return null
  const hash = hashToken(token)
  const member = group.members.find((item) => crypto.timingSafeEqual(Buffer.from(item.tokenHash), Buffer.from(hash)))
  if (!member) return null
  return { group, member }
}

function clampConfidence(accuracy: number, source: FixSource, reported: Confidence) {
  const cap = confidenceOf(accuracy, source, source === "gps" ? 0 : 8000)
  const rank: Record<Confidence, number> = { low: 1, medium: 2, high: 3 }
  return rank[reported] <= rank[cap] ? reported : cap
}

export function updateLocation(rawCode: string, body: Record<string, unknown>) {
  load()
  const found = findMember(rawCode, body.token)
  if (!found) return { error: "تعذر التحقق من الجهاز" as const, status: 403 as const }
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const accuracy = Number(body.accuracy)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { error: "إحداثيات غير صالحة" as const, status: 400 as const }
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) {
    return { error: "دقة الموقع غير صالحة" as const, status: 400 as const }
  }
  const source: FixSource = body.source === "pdr" || body.source === "last" ? body.source : "gps"
  const reported: Confidence =
    body.confidence === "high" || body.confidence === "medium" || body.confidence === "low"
      ? body.confidence
      : "low"
  const floor: FloorId = isFloorId(body.floor) ? body.floor : "ground"
  const heading =
    typeof body.heading === "number" && Number.isFinite(body.heading)
      ? ((body.heading % 360) + 360) % 360
      : null
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed) && body.speed >= 0
      ? Math.min(body.speed, 15)
      : null
  found.member.location = {
    lat,
    lng,
    accuracy: Math.max(5, Math.round(accuracy)),
    heading,
    speed,
    floor,
    source,
    confidence: clampConfidence(Math.max(5, accuracy), source, reported),
    at: Date.now(),
  }
  save()
  publish(found.group.code)
  return { ok: true as const }
}

export function leaveGroup(rawCode: string, token: unknown) {
  load()
  const found = findMember(rawCode, token)
  if (!found) return { error: "تعذر التحقق من الجهاز" as const, status: 403 as const }
  found.group.members = found.group.members.filter((member) => member.id !== found.member.id)
  if (found.group.members.length === 0) {
    memory().groups.delete(found.group.code)
    publish(found.group.code)
    memory().listeners.delete(found.group.code)
  } else {
    publish(found.group.code)
  }
  save()
  return { ok: true as const }
}

export function resetStoreForTests() {
  const state = memory()
  state.groups.clear()
  state.listeners.clear()
  state.loaded = true
  fs.rmSync(storeFile(), { force: true })
}
