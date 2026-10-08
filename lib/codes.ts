export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
}

export function cleanName(input: unknown, fallback?: string) {
  if (typeof input !== "string") return fallback ?? null
  const name = input.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 24)
  if (name.length < 1) return fallback ?? null
  return name
}
