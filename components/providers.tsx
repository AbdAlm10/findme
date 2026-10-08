"use client"

import { DirectionProvider } from "@base-ui/react/direction-provider"
import { PwaRegister } from "@/components/pwa-register"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider direction="rtl">
      <PwaRegister />
      {children}
    </DirectionProvider>
  )
}
