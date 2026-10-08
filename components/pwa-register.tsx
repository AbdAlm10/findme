"use client"

import { useEffect } from "react"
import { bindInstallPrompt } from "@/components/use-install"

export function PwaRegister() {
  useEffect(() => {
    bindInstallPrompt()
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister())
      })
      return
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* install still works after a refresh */
    })
  }, [])
  return null
}
