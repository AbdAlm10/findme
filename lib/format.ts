import type { Confidence, FixSource } from "@/lib/types"

const CARDINALS = [
  "شمال",
  "شمال شرق",
  "شرق",
  "جنوب شرق",
  "جنوب",
  "جنوب غرب",
  "غرب",
  "شمال غرب",
]

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—"
  if (meters < 1000) return `${Math.round(meters)} م`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} كم`
}

export function formatAccuracy(meters: number) {
  if (!Number.isFinite(meters)) return "—"
  return `±${Math.max(5, Math.round(meters))} م`
}

export function formatAge(ms: number) {
  if (!Number.isFinite(ms) || ms < 4000) return "الآن"
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `منذ ${seconds} ث`
  const minutes = Math.round(seconds / 60)
  if (minutes === 1) return "منذ دقيقة"
  if (minutes === 2) return "منذ دقيقتين"
  if (minutes < 11) return `منذ ${minutes} دقائق`
  return `منذ ${minutes} دقيقة`
}

export function cardinal(bearing: number) {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8
  return CARDINALS[index]
}

export function relativeDirection(bearing: number, heading: number | null) {
  if (heading == null || !Number.isFinite(heading)) return null
  const delta = (((bearing - heading) % 360) + 360) % 360
  if (delta < 28 || delta > 332) return "أمامك"
  if (delta <= 150) return "عن يمينك"
  if (delta < 210) return "خلفك"
  return "عن يسارك"
}

export function trustLabel(confidence: Confidence) {
  if (confidence === "high") return "دقيقة"
  if (confidence === "medium") return "متوسطة"
  return "ضعيفة"
}

export function sourceLabel(source: FixSource) {
  if (source === "gps") return "GPS والشبكة"
  if (source === "pdr") return "خطوات الهاتف منذ آخر إشارة"
  return "آخر موقع معروف"
}

export function formatCode(code: string) {
  const clean = code.replace(/\s/g, "")
  if (clean.length !== 6) return clean
  return `${clean.slice(0, 3)} ${clean.slice(3)}`
}

export function linkLabel(link: "online" | "local") {
  return link === "online" ? "متصل" : "وضع محلي"
}
