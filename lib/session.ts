import type { Session } from "@/lib/types"

const KEY = "rifaq.session.v1"

export function readSession(): Session | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (!session.code || !session.token || !session.memberId || !session.name) return null
    return session
  } catch {
    return null
  }
}

export function writeSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
