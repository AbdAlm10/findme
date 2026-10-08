"use client"

import { Button } from "@/components/ui/button"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="rf-boot">
      <div className="rf-glass" style={{ padding: 24, maxWidth: 420 }}>
        <h1 className="font-display text-3xl">تعذر فتح هذه الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">حدث خلل غير متوقع. أعد المحاولة، والخريطة محفوظة في الجهاز.</p>
        <Button type="button" className="mt-4 h-11" onClick={reset}>
          إعادة المحاولة
        </Button>
      </div>
    </main>
  )
}
