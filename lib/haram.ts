import raw from "@/lib/geo/haram.json"
import { circleRing, KAABA_LAT, KAABA_LNG, ringCentroid, toLocal } from "@/lib/geo"

type Line = { type: "LineString"; coordinates: number[][] }
type Polygon = { type: "Polygon"; coordinates: number[][][] }
type MultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] }

type HaramFile = {
  attribution: string
  kaaba: { lat: number; lng: number }
  mosque: MultiPolygon
  mataf: Polygon
  kaabaShape: Polygon
  hijr: Polygon
  maqam: Polygon
  safa: Polygon
  marwa: Polygon
  sai: Line
  tawaf: Line
  tawafFirst: Line
  gates: { id: string; name: string; lat: number; lng: number }[]
}

export const haram = raw as HaramFile

export const HARAM_ATTRIBUTION = haram.attribution

const MAJOR_GATES = new Set([
  "abdulaziz",
  "fahd",
  "umrah",
  "fath",
  "abdullah",
  "salam",
  "safa",
  "marwah",
])

export type GeoFeature = {
  type: "Feature"
  properties: { kind: string }
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] }
    | { type: "LineString"; coordinates: number[][] }
}

export function haramFeatures(): GeoFeature[] {
  return [
    {
      type: "Feature",
      properties: { kind: "range" },
      geometry: { type: "LineString", coordinates: circleRing(KAABA_LAT, KAABA_LNG, 1000, 96) },
    },
    { type: "Feature", properties: { kind: "mataf" }, geometry: haram.mataf },
    { type: "Feature", properties: { kind: "mosque" }, geometry: haram.mosque },
    { type: "Feature", properties: { kind: "safa" }, geometry: haram.safa },
    { type: "Feature", properties: { kind: "marwa" }, geometry: haram.marwa },
    { type: "Feature", properties: { kind: "sai" }, geometry: haram.sai },
    { type: "Feature", properties: { kind: "tawaf" }, geometry: haram.tawaf },
    { type: "Feature", properties: { kind: "tawaf-first" }, geometry: haram.tawafFirst },
    { type: "Feature", properties: { kind: "hijr" }, geometry: haram.hijr },
    { type: "Feature", properties: { kind: "kaaba" }, geometry: haram.kaabaShape },
    { type: "Feature", properties: { kind: "maqam" }, geometry: haram.maqam },
  ]
}

export function featureCollection(features: GeoFeature[]) {
  return { type: "FeatureCollection" as const, features }
}

function ringPath(ring: number[][]) {
  return ring
    .map((coord, index) => {
      const point = toLocal(coord[1], coord[0])
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${(-point.y).toFixed(2)}`
    })
    .join(" ")
}

function linePath(line: number[][]) {
  return line
    .map((coord, index) => {
      const point = toLocal(coord[1], coord[0])
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${(-point.y).toFixed(2)}`
    })
    .join(" ")
}

export type SvgPath = { kind: string; d: string; fill: boolean }

export function svgScene() {
  const paths: SvgPath[] = [
    { kind: "mataf", d: `${ringPath(haram.mataf.coordinates[0])} Z`, fill: true },
    ...haram.mosque.coordinates.map((polygon) => ({
      kind: "mosque",
      d: polygon.map((ring) => `${ringPath(ring)} Z`).join(" "),
      fill: true,
    })),
    { kind: "safa", d: `${ringPath(haram.safa.coordinates[0])} Z`, fill: true },
    { kind: "marwa", d: `${ringPath(haram.marwa.coordinates[0])} Z`, fill: true },
    { kind: "sai", d: linePath(haram.sai.coordinates), fill: false },
    { kind: "tawaf", d: linePath(haram.tawaf.coordinates), fill: false },
    { kind: "hijr", d: `${ringPath(haram.hijr.coordinates[0])} Z`, fill: true },
    { kind: "kaaba", d: `${ringPath(haram.kaabaShape.coordinates[0])} Z`, fill: true },
    { kind: "maqam", d: `${ringPath(haram.maqam.coordinates[0])} Z`, fill: true },
    { kind: "range", d: linePath(circleRing(KAABA_LAT, KAABA_LNG, 1000, 90)), fill: false },
  ]

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const polygon of haram.mosque.coordinates) {
    for (const coord of polygon[0]) {
      const point = toLocal(coord[1], coord[0])
      const y = -point.y
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  const pad = 70
  const bounds = {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }

  const safa = ringCentroid(haram.safa.coordinates[0])
  const marwa = ringCentroid(haram.marwa.coordinates[0])
  const landmarks = [
    { id: "kaaba", name: "الكعبة", lat: haram.kaaba.lat, lng: haram.kaaba.lng },
    { id: "safa", name: "الصفا", lat: safa.lat, lng: safa.lng },
    { id: "marwa", name: "المروة", lat: marwa.lat, lng: marwa.lng },
  ]

  return {
    paths,
    bounds,
    landmarks,
    gates: haram.gates.map((gate) => ({ ...gate, major: MAJOR_GATES.has(gate.id) })),
  }
}

export function toSvg(lat: number, lng: number) {
  const point = toLocal(lat, lng)
  return { x: point.x, y: -point.y }
}
