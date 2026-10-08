"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deviceKind, useInstallPrompt } from "@/components/use-install"

const IOS_STEPS = [
  "افتح الصفحة في Safari، لا من متصفح آخر.",
  "اضغط زر المشاركة في أسفل الشاشة.",
  "اختر «إضافة إلى الشاشة الرئيسية».",
  "افتح رِفاق من الأيقونة، ثم اسمح بالموقع وبحركة الجهاز.",
]

const ANDROID_STEPS = [
  "من Chrome اضغط «تثبيت التطبيق» إن ظهر الزر.",
  "أو من قائمة المتصفح: تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.",
  "اسمح بالموقع عندما يُطلب. البوصلة والخطوات تعملان والتطبيق مفتوح.",
]

export function InstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { canInstall, installed, install } = useInstallPrompt()
  const [kind] = useState(deviceKind)
  const steps = kind === "ios" ? IOS_STEPS : ANDROID_STEPS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">ثبّت رِفاق على الهاتف</DialogTitle>
          <DialogDescription>
            نسخة واحدة تعمل كتطبيق على أندرويد ومن شاشة الآيفون الرئيسية: موقع، بوصلة، خطوات، وخريطة الحرم بدون اتصال.
          </DialogDescription>
        </DialogHeader>
        {installed ? (
          <p className="text-sm text-muted-foreground">التطبيق مثبت على هذا الجهاز.</p>
        ) : (
          <ol className="flex flex-col gap-3 text-sm leading-6">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          التتبع يستمر والتطبيق مفتوح. أنظمة الجوال تمنع الموقع في الخلفية من صفحة مثبتة، لذلك لا ندّعي عملاً والشاشة مغلقة.
        </p>
        {kind !== "ios" && canInstall ? (
          <Button type="button" className="h-11 text-base" onClick={() => void install()}>
            تثبيت تطبيق أندرويد
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
