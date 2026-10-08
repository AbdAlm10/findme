export const FLOORS = [
  { id: "saha", label: "الساحات" },
  { id: "ground", label: "الأرضي" },
  { id: "first", label: "الأول" },
  { id: "roof", label: "السطح" },
  { id: "sai", label: "المسعى" },
] as const

export type FloorId = (typeof FLOORS)[number]["id"]

export type FixSource = "gps" | "pdr" | "last"
export type Confidence = "high" | "medium" | "low"

export type SharedLocation = {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  speed: number | null
  floor: FloorId
  source: FixSource
  confidence: Confidence
  at: number
}

export type PublicMember = {
  id: string
  name: string
  color: string
  example?: boolean
  location: SharedLocation | null
}

export type Snapshot = {
  code: string
  groupName: string
  serverNow: number
  members: PublicMember[]
}

export type Session = {
  code: string
  groupName: string
  memberId: string
  token: string
  name: string
  color: string
}

export const MEMBER_COLORS = [
  "#e25b4a",
  "#3d8bfd",
  "#3dbe86",
  "#e0a15a",
  "#c084fc",
  "#f472b6",
] as const

export function floorLabel(id: FloorId) {
  return FLOORS.find((floor) => floor.id === id)?.label ?? id
}

export function isFloorId(value: unknown): value is FloorId {
  return FLOORS.some((floor) => floor.id === value)
}
