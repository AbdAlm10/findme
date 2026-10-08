import { destination } from "@/lib/geo"
import { haram } from "@/lib/haram"
import type { FloorId } from "@/lib/types"

export type ExampleBody = {
  id: string
  name: string
  color: string
  lat: number
  lng: number
  heading: number
  accuracy: number
  floor: FloorId
}

function alongSai(now: number) {
  const line = haram.sai.coordinates
  const period = 90
  const u = (now / 1000) % period / period
  const ping = u < 0.5 ? u * 2 : 2 - u * 2
  const index = ping * (line.length - 1)
  const i = Math.min(Math.floor(index), line.length - 2)
  const fraction = index - i
  const a = line[i]
  const b = line[i + 1]
  return {
    lng: a[0] + (b[0] - a[0]) * fraction,
    lat: a[1] + (b[1] - a[1]) * fraction,
    heading: u < 0.5 ? 8 : 188,
  }
}

export function exampleSelf(now: number) {
  const angle = ((now / 1000) / 80) * 360
  const point = destination(haram.kaaba.lat, haram.kaaba.lng, angle, 46)
  return {
    lat: point.lat,
    lng: point.lng,
    heading: (angle + 90) % 360,
    accuracy: 7,
    floor: "ground" as const,
  }
}

export function exampleCompanions(now: number): ExampleBody[] {
  const angle = ((now / 1000) / 64) * 360 + 200
  const near = destination(haram.kaaba.lat, haram.kaaba.lng, angle, 24)
  const sai = alongSai(now)
  return [
    {
      id: "example-ali",
      name: "علي",
      color: "#3d8bfd",
      lat: near.lat,
      lng: near.lng,
      heading: (angle + 90) % 360,
      accuracy: 6,
      floor: "ground",
    },
    {
      id: "example-sara",
      name: "سارة",
      color: "#3dbe86",
      lat: sai.lat,
      lng: sai.lng,
      heading: sai.heading,
      accuracy: 9,
      floor: "sai",
    },
  ]
}
