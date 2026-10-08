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
  title: "رِفاق — أين من معك",
  description:
    "خريطة للعالم لمجموعة صغيرة، مع سهم ومسافة مثل البحث عن جهاز، ووضع خاص لمخطط المسجد الحرام. هامش الخطأ ظاهر دائماً.",
  applicationName: "رِفاق",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "رِفاق",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
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
