"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { HaramMap, type MapHandle } from "@/components/haram-map"
import { InstallDialog } from "@/components/install-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRifaq } from "@/components/use-rifaq"
import { bearingDegrees, distanceMeters } from "@/lib/geo"
import {
  cardinal,
  formatAccuracy,
  formatAge,
  formatCode,
  formatDistance,
  linkLabel,
  relativeDirection,
  sourceLabel,
  trustLabel,
} from "@/lib/format"
import { readSession } from "@/lib/session"
import { floorLabel, type FloorId, type PublicMember, type Session } from "@/lib/types"

export function MapScreen() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const stored = readSession()
    if (!stored) router.replace("/")
    setSession(stored)
  }, [router])

  if (!session) {
    return <main className="rf-boot">نفتح الخريطة…</main>
  }
  return <LiveMap session={session} />
}

function LiveMap({ session }: { session: Session }) {
  const mapRef = useRef<MapHandle>(null)
  const rifaq = useRifaq(session)
  const [follow, setFollow] = useState(true)
  const [armed, setArmed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const selected = rifaq.members.find((member) => member.id === selectedId) ?? null

  useEffect(() => {
    if ((rifaq.kaabaDistance ?? Infinity) < 1800) setArmed(true)
  }, [rifaq.kaabaDistance])

  useEffect(() => {
    const location = rifaq.self.location
    if (!follow || !location) return
    if (!armed && !rifaq.example) return
    mapRef.current?.panTo(location.lat, location.lng)
  }, [armed, follow, rifaq.example, rifaq.self.location])

  const shareNote =
    rifaq.shareState === "copied"
      ? "نُسخ الرمز"
      : rifaq.shareState === "shared"
        ? "تم إرسال الرمز"
        : rifaq.shareState === "failed"
          ? "انسخ الرمز يدوياً"
          : null

  return (
    <main className="rf-map">
      <HaramMap
        ref={mapRef}
        members={rifaq.members}
        selfId={session.memberId}
        floor={rifaq.floor}
        now={rifaq.now}
        onSelect={setSelectedId}
        onUserMove={() => setFollow(false)}
      />

      <div className="rf-top">
        <div className="rf-glass rf-status">
          <div className="rf-status-row">
            <span className={`rf-live ${rifaq.link}`} />
            <strong>{linkLabel(rifaq.link)}</strong>
            <span>{rifaq.self.location ? formatAccuracy(rifaq.self.location.accuracy) : "بانتظار الموقع"}</span>
            {rifaq.self.location ? (
              <span className={`rf-trust is-${rifaq.self.location.confidence}`}>
                {rifaq.self.example ? "تجريبي" : trustLabel(rifaq.self.location.confidence)}
              </span>
            ) : null}
          </div>
          <div className="rf-floors" role="tablist" aria-label="الدور">
            {rifaq.floors.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={rifaq.floor === item.id}
                className={rifaq.floor === item.id ? "is-on" : ""}
                onClick={() => rifaq.setFloor(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {rifaq.floorHint ? (
          <div className="rf-glass rf-hint">
            <p>
              تغيّر الارتفاع {Math.round(rifaq.floorHint.delta)} م. هل أنت في {floorLabel(rifaq.floorHint.floor)}؟
            </p>
            <div>
              <button type="button" onClick={rifaq.acceptFloor}>
                نعم
              </button>
              <button type="button" onClick={rifaq.dismissFloor}>
                لا
              </button>
            </div>
          </div>
        ) : null}
        {rifaq.notice ? <p className="rf-glass rf-notice">{rifaq.notice}</p> : null}
        {rifaq.example ? (
          <p className="rf-glass rf-notice">مشهد تجريبي داخل الحرم. النقاط المتحركة ليست أشخاصاً حقيقيين.</p>
        ) : null}
        {rifaq.kaabaDistance != null && rifaq.kaabaDistance > 400 && !rifaq.self.example ? (
          <p className="rf-glass rf-notice">
            أنت على بعد {formatDistance(rifaq.kaabaDistance)} من الكعبة. الخريطة جاهزة، وسيظهر أهلك هنا عندما تصل مواقعهم.
          </p>
        ) : null}
      </div>

      <div className="rf-tools">
        <ToolButton
          label="موقعي"
          disabled={!rifaq.self.location}
          onClick={() => {
            const location = rifaq.self.location
            if (!location) return
            setArmed(true)
            setFollow(true)
            mapRef.current?.focus(location.lat, location.lng)
          }}
        >
          <LocateIcon />
        </ToolButton>
        <ToolButton
          label="الكعبة"
          onClick={() => {
            setFollow(false)
            mapRef.current?.fitHaram()
          }}
        >
          <KaabaIcon />
        </ToolButton>
        <ToolButton label="شمال" onClick={() => mapRef.current?.north()}>
          <NorthIcon />
        </ToolButton>
        <ToolButton label="تكبير" onClick={() => mapRef.current?.zoomIn()}>
          +
        </ToolButton>
        <ToolButton label="تصغير" onClick={() => mapRef.current?.zoomOut()}>
          −
        </ToolButton>
      </div>

      <section className="rf-roster rf-glass" aria-label="أفراد المجموعة">
        <header className="rf-roster-head">
          <div>
            <p className="rf-kicker">رِفاق</p>
            <h1>{rifaq.groupName}</h1>
          </div>
          <button type="button" className="rf-code" dir="ltr" onClick={() => void rifaq.share()}>
            {formatCode(session.code)}
            {shareNote ? <small>{shareNote}</small> : <small>مشاركة</small>}
          </button>
        </header>

        {rifaq.gpsError ? (
          <div className="rf-callout">
            <p>{rifaq.gpsError}</p>
            <button type="button" onClick={rifaq.retryGps}>
              إعادة طلب الموقع
            </button>
          </div>
        ) : null}

        {rifaq.motion === "unknown" ? (
          <div className="rf-callout">
            <p>على الآيفون نحتاج إذناً لحركة الجهاز حتى تُكمل البوصلة موقعك داخل الأروقة.</p>
            <button type="button" onClick={() => void rifaq.enableMotion()}>
              تفعيل البوصلة والخطوات
            </button>
          </div>
        ) : null}

        <ul className="rf-people">
          {rifaq.members.map((member) => (
            <PersonRow
              key={member.id}
              member={member}
              self={rifaq.self}
              now={rifaq.clock()}
              activeFloor={rifaq.floor}
              onSelect={() => setSelectedId(member.id)}
            />
          ))}
        </ul>

        {rifaq.members.length === 1 && !rifaq.example ? (
          <p className="rf-empty">لم ينضم أحد بعد. اقرأ الرمز لمن معك، أو أرسله من الزر أعلاه.</p>
        ) : null}

        <div className="rf-roster-actions">
          <button type="button" onClick={() => rifaq.setExample((value) => !value)}>
            {rifaq.example ? "إيقاف التجربة" : "مشهد تجريبي"}
          </button>
          <button type="button" onClick={() => setAboutOpen(true)}>
            عن الدقة
          </button>
          <button type="button" onClick={() => setInstallOpen(true)}>
            تثبيت
          </button>
          <button type="button" className="is-danger" onClick={() => void rifaq.leave()}>
            مغادرة
          </button>
        </div>
        <p className="rf-credit">خريطة الحرم © مساهمو OpenStreetMap · الشوارع © CARTO</p>
      </section>

      <PersonDialog
        member={selected}
        self={rifaq.self}
        now={rifaq.clock()}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
      <AccuracyDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} />
    </main>
  )
}

function PersonRow({
  member,
  self,
  now,
  activeFloor,
  onSelect,
}: {
  member: PublicMember
  self: PublicMember
  now: number
  activeFloor: FloorId
  onSelect: () => void
}) {
  const location = member.location
  const mine = member.id === self.id
  let distance = "بانتظار موقعه"
  let direction = ""
  if (location && mine) distance = formatAccuracy(location.accuracy)
  else if (location && self.location) {
    distance = formatDistance(
      distanceMeters(self.location.lat, self.location.lng, location.lat, location.lng),
    )
    direction = cardinal(bearingDegrees(self.location.lat, self.location.lng, location.lat, location.lng))
  }
  return (
    <li>
      <button type="button" className="rf-person" onClick={onSelect}>
        <span className="rf-swatch" style={{ background: member.color }} />
        <span className="rf-person-copy">
          <strong>
            {mine ? "أنت" : member.name}
            {member.example ? <em> تجريبي</em> : null}
          </strong>
          <small>
            {location ? floorLabel(location.floor) : "بدون موقع"}
            {location && location.floor !== activeFloor && !mine ? " · دور آخر" : ""}
            {location ? ` · ${member.example ? "مشهد" : trustLabel(location.confidence)}` : ""}
            {location && !member.example ? ` · ${formatAge(now - location.at)}` : ""}
          </small>
        </span>
        <span className="rf-person-metric">
          <b>{distance}</b>
          {direction ? <small>{direction}</small> : null}
        </span>
      </button>
    </li>
  )
}

function PersonDialog({
  member,
  self,
  now,
  onOpenChange,
}: {
  member: PublicMember | null
  self: PublicMember
  now: number
  onOpenChange: (open: boolean) => void
}) {
  const location = member?.location
  const mine = member?.id === self.id
  const distance =
    location && self.location && member && !mine
      ? distanceMeters(self.location.lat, self.location.lng, location.lat, location.lng)
      : null
  const bearing =
    distance != null && location && self.location
      ? bearingDegrees(self.location.lat, self.location.lng, location.lat, location.lng)
      : null
  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {member && location ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-3xl">{mine ? "موقعك" : member.name}</DialogTitle>
              <DialogDescription>
                {member.example
                  ? "هذا مسار تجريبي لإظهار شكل التتبع، وليس شخصاً من المجموعة."
                  : "المسافة خط مستقيم. المشي بين الأروقة قد يكون أطول."}
              </DialogDescription>
            </DialogHeader>
            <p className="rf-figure">{distance == null ? formatAccuracy(location.accuracy) : formatDistance(distance)}</p>
            {bearing != null ? (
              <p className="rf-bearing">
                <span className="rf-arrow" style={{ transform: `rotate(${bearing}deg)` }} aria-hidden />
                {cardinal(bearing)}
                {relativeDirection(bearing, self.location?.heading ?? null)
                  ? ` · ${relativeDirection(bearing, self.location?.heading ?? null)}`
                  : ""}
              </p>
            ) : null}
            <dl className="rf-facts">
              <div>
                <dt>الثقة</dt>
                <dd className={`is-${location.confidence}`}>{trustLabel(location.confidence)}</dd>
              </div>
              <div>
                <dt>هامش الخطأ</dt>
                <dd>{formatAccuracy(location.accuracy)}</dd>
              </div>
              <div>
                <dt>الدور</dt>
                <dd>{floorLabel(location.floor)}</dd>
              </div>
              <div>
                <dt>المصدر</dt>
                <dd>{sourceLabel(location.source)}</dd>
              </div>
              <div>
                <dt>آخر تحديث</dt>
                <dd>{member.example ? "مباشر" : formatAge(now - location.at)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{member?.name}</DialogTitle>
              <DialogDescription>لم يصل موقع بعد. عندما يفتح التطبيق ويسمح بالموقع سيظهر هنا.</DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AccuracyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">كيف نعرض الموقع</DialogTitle>
          <DialogDescription>النقطة مركز تقدير، والدائرة هي هامش الخطأ. لا نخفي ضعفاً في الإشارة.</DialogDescription>
        </DialogHeader>
        <ul className="rf-about">
          <li>مع الإنترنت: GPS وشبكة الجهاز، ثم تصفية الاهتزاز، ثم إرسال الموقع للمجموعة.</li>
          <li>إذا تجاوز الهامش ١٠ أمتار نُظهر ذلك باللون، ولا نقرّب النقطة لتبدو أدق.</li>
          <li>إذا انقطع الإنترنت تبقى خريطة الحرم، ويستمر موقعك من GPS. الآخرون يبقون على آخر موقع وصل.</li>
          <li>داخل الأروقة تضعف الإشارة، فتكمل الخطوات والبوصلة الحركة لفترة قصيرة ويزداد هامش الخطأ مع الوقت.</li>
          <li>الدور يختاره الشخص. اقتراح الارتفاع لا يُستخدم إلا إذا كان قياس الارتفاع نفسه دقيقاً.</li>
        </ul>
        <Button type="button" className="h-11" onClick={() => onOpenChange(false)}>
          فهمت
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function ToolButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="rf-tool" aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  )
}

function NorthIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4l4 14-4-2-4 2z" />
    </svg>
  )
}

function KaabaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="5" width="10" height="14" transform="rotate(45 12 12)" />
    </svg>
  )
}
