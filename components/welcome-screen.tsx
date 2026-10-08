"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { InstallDialog } from "@/components/install-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalizeCode } from "@/lib/codes"
import { readSession, writeSession } from "@/lib/session"
import type { Session } from "@/lib/types"

type Mode = "home" | "create" | "join"

export function WelcomeScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("home")
  const [name, setName] = useState("")
  const [groupName, setGroupName] = useState("مجموعة العائلة")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [existing, setExisting] = useState<Session | null>(null)
  const [installOpen, setInstallOpen] = useState(false)

  useEffect(() => {
    setExisting(readSession())
    const params = new URLSearchParams(window.location.search)
    if (params.get("missing")) setError("هذه المجموعة لم تعد موجودة. أنشئ مجموعة جديدة أو اطلب الرمز من جديد.")
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (trimmed.length < 1) {
      setError("اكتب اسمك أولاً.")
      return
    }
    setPending(true)
    try {
      const endpoint =
        mode === "join" ? `/api/groups/${normalizeCode(code)}/join` : "/api/groups"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "join" ? { name: trimmed } : { name: trimmed, groupName: groupName.trim() },
        ),
      })
      const data = (await response.json()) as Session & { error?: string }
      if (!response.ok) {
        setError(data.error ?? "تعذر الدخول إلى المجموعة.")
        return
      }
      writeSession({
        code: data.code,
        groupName: data.groupName,
        memberId: data.memberId,
        token: data.token,
        name: data.name,
        color: data.color,
      })
      router.push("/map")
    } catch {
      setError("تعذر الاتصال بالخادم. تأكد أن التطبيق يعمل ثم أعد المحاولة.")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="rf-welcome">
      <section className="rf-hero">
        <p className="rf-kicker">أين من معك</p>
        <h1 className="rf-wordmark">رِفاق</h1>
        <p className="rf-lede">
          خريطة للعالم، وسهم يوجّهك نحو من تبحث عنه مع المسافة. إذا كنتم في المسجد الحرام يمكنكم التبديل إلى
          مخطط الحرم. الدقة المعتادة بين ٥ و١٠ أمتار، وهامش الخطأ ظاهر دائماً.
        </p>
        <OrbitSketch />
      </section>
      <section className="rf-panel">
        {existing ? (
          <button type="button" className="rf-resume" onClick={() => router.push("/map")}>
            <span>متابعة {existing.groupName}</span>
            <small>{existing.name}</small>
          </button>
        ) : null}
        {mode === "home" ? (
          <div className="rf-actions">
            <Button type="button" className="h-12 text-base" onClick={() => setMode("create")}>
              إنشاء مجموعة
            </Button>
            <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setMode("join")}>
              لديّ رمز
            </Button>
          </div>
        ) : (
          <form className="rf-form" onSubmit={(event) => void submit(event)}>
            <label>
              اسمك كما سيراه أهلك
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={24}
                autoComplete="given-name"
                placeholder="أحمد"
                className="h-12"
              />
            </label>
            {mode === "create" ? (
              <label>
                اسم المجموعة
                <Input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  maxLength={24}
                  className="h-12"
                />
              </label>
            ) : (
              <label>
                رمز المجموعة
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  dir="ltr"
                  inputMode="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={7}
                  placeholder="AB3 K7M"
                  className="h-12 tracking-[0.28em]"
                />
              </label>
            )}
            {error ? <p className="rf-error">{error}</p> : null}
            <Button type="submit" className="h-12 text-base" disabled={pending}>
              {pending ? "لحظة…" : mode === "create" ? "ابدأ المشاركة" : "دخول المجموعة"}
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setMode("home")}>
              رجوع
            </Button>
          </form>
        )}
        {mode === "home" && error ? <p className="rf-error">{error}</p> : null}
        <footer className="rf-footnote">
          <button type="button" onClick={() => setInstallOpen(true)}>
            تثبيت النسخة على الآيفون أو أندرويد
          </button>
          <p>الإنترنت لتبادل المواقع وخريطة العالم. مخطط الحرم محفوظ في الجهاز، وهامش الخطأ لا يُخفى.</p>
        </footer>
      </section>
      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} />
    </main>
  )
}

function OrbitSketch() {
  return (
    <svg className="rf-sketch" viewBox="0 0 320 320" aria-hidden="true">
      <circle cx="160" cy="160" r="128" className="rf-orbit" />
      <circle cx="160" cy="160" r="84" className="rf-orbit" />
      <circle cx="160" cy="160" r="46" className="rf-orbit" />
      <g className="rf-spin">
        <circle cx="160" cy="32" r="7" fill="#3d8bfd" />
      </g>
      <g className="rf-spin rf-spin-slow">
        <circle cx="160" cy="76" r="6" fill="#3dbe86" />
      </g>
      <g className="rf-spin rf-spin-rev">
        <circle cx="160" cy="114" r="6" fill="#e25b4a" />
      </g>
      <g transform="translate(160 160) rotate(45)">
        <rect x="-16" y="-20" width="32" height="40" rx="2" fill="#100e0c" stroke="#e0c48a" strokeWidth="2" />
        <rect x="-16" y="-3" width="32" height="5" fill="#e0c48a" />
      </g>
    </svg>
  )
}
