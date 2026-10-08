import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
})

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
})

export const metadata: Metadata = {
  title: "رِفاق — موقع الأهل في الحرم",
  description:
    "تتبع مجموعة صغيرة داخل المسجد الحرام على خريطة محفوظة. إنترنت أولاً، ثم GPS والخطوات إذا انقطع الاتصال، مع إظهار هامش الخطأ.",
  applicationName: "رِفاق",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "رِفاق",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#0c1612",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${amiri.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
