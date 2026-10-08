"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let promptEvent: BeforeInstallPromptEvent | null = null
let installed = false
let bound = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function bindInstallPrompt() {
  if (bound || typeof window === "undefined") return
  bound = true
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  installed = iosStandalone || window.matchMedia("(display-mode: standalone)").matches

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    promptEvent = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener("appinstalled", () => {
    installed = true
    promptEvent = null
    emit()
  })
}

export function deviceKind() {
  if (typeof navigator === "undefined") return "desktop" as const
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return "ios" as const
  if (/Android/.test(ua)) return "android" as const
  return "desktop" as const
}

export function useInstallPrompt() {
  const [, redraw] = useState(0)
  useEffect(() => {
    const listener = () => redraw((value) => value + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  async function install() {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === "accepted") installed = true
    promptEvent = null
    emit()
    return choice.outcome === "accepted"
  }

  return { canInstall: Boolean(promptEvent), installed, install }
}
