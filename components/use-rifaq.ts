"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { exampleCompanions, exampleSelf } from "@/lib/example"
import { distanceMeters, smoothAngle } from "@/lib/geo"
import { haram } from "@/lib/haram"
import { LocationEngine } from "@/lib/engine"
import { formatDistance } from "@/lib/format"
import { compassHeading, StepDetector } from "@/lib/sensors"
import { clearSession } from "@/lib/session"
import {
  floorLabel,
  FLOORS,
  type FloorId,
  type PublicMember,
  type Session,
  type SharedLocation,
  type Snapshot,
} from "@/lib/types"

const VERTICAL: FloorId[] = ["ground", "first", "roof"]
const STRIDE_M = 0.67

type MotionState = "unknown" | "granted" | "denied" | "ready"
type ShareState = "idle" | "shared" | "copied" | "cancelled" | "failed"

function gpsMessage(code: number) {
  if (code === 1) return "لم يُسمح بالموقع. من إعدادات المتصفح اسمح بالموقع لرِفاق ثم أعد المحاولة."
  if (code === 2) return "إشارة الموقع غير متاحة الآن. إن كنت داخل الأروقة فقد تضعف قليلاً."
  return "انتهت مهلة انتظار الموقع. سنبقي آخر نقطة ونعيد المحاولة."
}

async function requestMotionPermission(): Promise<MotionState> {
  const orientation = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>
  }
  const motion = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>
  }
  try {
    if (typeof orientation.requestPermission === "function") {
      const orientationResult = await orientation.requestPermission()
      if (typeof motion.requestPermission === "function") await motion.requestPermission()
      return orientationResult === "granted" ? "granted" : "denied"
    }
    return "ready"
  } catch {
    return "denied"
  }
}

export function useRifaq(session: Session) {
  const router = useRouter()
  const engine = useRef(new LocationEngine())
  const steps = useRef(new StepDetector())
  const floorRef = useRef<FloorId>("ground")
  const compassRef = useRef<number | null>(null)
  const courseRef = useRef<{ heading: number; at: number } | null>(null)
  const speedRef = useRef<number | null>(null)
  const headingPublish = useRef(0)
  const skew = useRef(0)
  const baseAltitude = useRef<number | null>(null)
  const suggestedFloor = useRef<FloorId | null>(null)
  const realRef = useRef<SharedLocation | null>(null)
  const prevDistance = useRef(new Map<string, number>())

  const [groupName, setGroupName] = useState(session.groupName)
  const [serverMembers, setServerMembers] = useState<PublicMember[]>([])
  const [link, setLink] = useState<"online" | "local">("local")
  const [floor, setFloorState] = useState<FloorId>("ground")
  const [real, setReal] = useState<SharedLocation | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsNonce, setGpsNonce] = useState(0)
  const [example, setExample] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [motion, setMotion] = useState<MotionState>("unknown")
  const [notice, setNotice] = useState<string | null>(null)
  const [floorHint, setFloorHint] = useState<{ floor: FloorId; delta: number } | null>(null)
  const [gone, setGone] = useState(false)
  const [shareState, setShareState] = useState<ShareState>("idle")

  const setFloor = useCallback((next: FloorId) => {
    floorRef.current = next
    engine.current.setFloor(next)
    baseAltitude.current = null
    suggestedFloor.current = null
    setFloorHint(null)
    setFloorState(next)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 7000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!example) return
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [example])

  useEffect(() => {
    let source: EventSource | null = null
    let stopped = false
    let retry = 0

    const connect = () => {
      source = new EventSource(`/api/groups/${session.code}/stream`)
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as Snapshot
        skew.current = data.serverNow - Date.now()
        setServerMembers(data.members)
        setGroupName(data.groupName)
        setLink("online")
      }
      source.addEventListener("gone", () => setGone(true))
      source.onerror = () => {
        setLink("local")
        source?.close()
        if (stopped) return
        retry = Math.min(8000, 1500 + retry)
        window.setTimeout(connect, retry)
      }
    }

    void fetch(`/api/groups/${session.code}`)
      .then((response) => {
        if (response.status === 404) setGone(true)
      })
      .catch(() => setLink("local"))
    connect()

    const onOffline = () => setLink("local")
    window.addEventListener("offline", onOffline)
    return () => {
      stopped = true
      source?.close()
      window.removeEventListener("offline", onOffline)
    }
  }, [session.code])

  useEffect(() => {
    if (!gone) return
    clearSession()
    router.replace("/?missing=1")
  }, [gone, router])

  const publishFix = useCallback(
    (fix: SharedLocation) => {
      realRef.current = fix
      setReal(fix)
      setNow(Date.now())
    },
    [],
  )

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("هذا المتصفح لا يوفّر خدمة الموقع.")
      return
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading: course, speed, altitude, altitudeAccuracy } =
          position.coords
        const nowMs = Date.now()
        engine.current.setFloor(floorRef.current)
        engine.current.ingestGps(latitude, longitude, accuracy ?? 30, nowMs)
        if (typeof course === "number" && course >= 0 && (speed ?? 0) > 0.6) {
          courseRef.current = { heading: course, at: nowMs }
          setHeading(course)
        }
        if (typeof speed === "number" && Number.isFinite(speed)) speedRef.current = speed
        const fix = engine.current.snapshot(nowMs)
        if (fix) {
          publishFix({
            ...fix,
            heading: courseRef.current?.heading ?? compassRef.current,
            speed: speedRef.current,
            floor: floorRef.current,
            at: nowMs,
          })
        }
        setGpsError(null)

        const altOk =
          typeof altitude === "number" &&
          Number.isFinite(altitude) &&
          typeof altitudeAccuracy === "number" &&
          altitudeAccuracy <= 6
        const verticalIndex = VERTICAL.indexOf(floorRef.current)
        if (altOk && verticalIndex >= 0) {
          if (baseAltitude.current == null) baseAltitude.current = altitude
          const delta = altitude - (baseAltitude.current ?? altitude)
          if (Math.abs(delta) > 3.4) {
            const next = delta > 0 ? VERTICAL[verticalIndex + 1] : VERTICAL[verticalIndex - 1]
            if (next && suggestedFloor.current !== next) {
              suggestedFloor.current = next
              setFloorHint({ floor: next, delta })
            }
          }
        }
      },
      (error) => setGpsError(gpsMessage(error.code)),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    )
    const coast = window.setInterval(() => {
      const nowMs = Date.now()
      engine.current.coast(nowMs)
      const fix = engine.current.snapshot(nowMs)
      if (!fix) return
      publishFix({
        ...fix,
        heading: courseRef.current?.heading ?? compassRef.current,
        speed: speedRef.current,
        floor: floorRef.current,
        at: nowMs,
      })
    }, 1000)
    return () => {
      navigator.geolocation.clearWatch(watch)
      window.clearInterval(coast)
    }
  }, [gpsNonce, publishFix])

  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity
      if (!acceleration) return
      const magnitude = Math.hypot(acceleration.x ?? 0, acceleration.y ?? 0, acceleration.z ?? 0)
      const nowMs = Date.now()
      if (!steps.current.push(event.timeStamp || nowMs, magnitude)) return
      const courseFresh =
        courseRef.current && nowMs - courseRef.current.at < 4000 ? courseRef.current.heading : null
      const facing = courseFresh ?? compassRef.current
      if (facing == null) return
      engine.current.ingestStep(facing, STRIDE_M, nowMs)
      const fix = engine.current.snapshot(nowMs)
      if (!fix) return
      publishFix({
        ...fix,
        heading: facing,
        speed: speedRef.current,
        floor: floorRef.current,
        at: nowMs,
      })
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      const ios = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      let next: number | null = null
      if (typeof ios === "number" && !Number.isNaN(ios)) next = ios
      else if (event.absolute && event.alpha != null) {
        next = compassHeading(event.alpha, event.beta ?? 0, event.gamma ?? 0)
      }
      if (next == null) return
      compassRef.current = smoothAngle(compassRef.current, next, compassRef.current == null ? 1 : 0.2)
      const nowMs = Date.now()
      if (nowMs - headingPublish.current > 200) {
        headingPublish.current = nowMs
        setHeading(compassRef.current)
      }
    }
    window.addEventListener("devicemotion", onMotion)
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener)
    window.addEventListener("deviceorientation", onOrientation)
    const needsGesture =
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === "function"
    setMotion(needsGesture ? "unknown" : "ready")
    return () => {
      window.removeEventListener("devicemotion", onMotion)
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener)
      window.removeEventListener("deviceorientation", onOrientation)
    }
  }, [publishFix])

  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const acquire = async () => {
      if (stopped || !("wakeLock" in navigator)) return
      try {
        lock = await navigator.wakeLock.request("screen")
      } catch {
        lock = null
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire()
    }
    void acquire()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      document.removeEventListener("visibilitychange", onVisible)
      void lock?.release()
    }
  }, [])

  useEffect(() => {
    const send = async () => {
      const fix = realRef.current
      if (!fix) return
      try {
        const response = await fetch(`/api/groups/${session.code}/location`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: session.token,
            lat: fix.lat,
            lng: fix.lng,
            accuracy: fix.accuracy,
            heading: fix.heading,
            speed: fix.speed,
            floor: fix.floor,
            source: fix.source,
            confidence: fix.confidence,
          }),
        })
        if (!response.ok) setLink("local")
      } catch {
        setLink("local")
      }
    }
    void send()
    const timer = window.setInterval(() => void send(), 2000)
    return () => window.clearInterval(timer)
  }, [session.code, session.token])

  const members = useMemo(() => {
    const clock = Date.now() + skew.current
    const selfLocation: SharedLocation | null =
      real ??
      (example
        ? {
            ...exampleSelf(now),
            heading: exampleSelf(now).heading,
            speed: 1.1,
            source: "gps",
            confidence: "high",
            at: clock,
          }
        : null)
    const self: PublicMember = {
      id: session.memberId,
      name: session.name,
      color: session.color,
      example: !real && example,
      location: selfLocation,
    }
    const others = serverMembers
      .filter((member) => member.id !== session.memberId)
      .map((member) => member)
    const ghosts: PublicMember[] = example
      ? exampleCompanions(now).map((person) => ({
          id: person.id,
          name: person.name,
          color: person.color,
          example: true,
          location: {
            lat: person.lat,
            lng: person.lng,
            accuracy: person.accuracy,
            heading: person.heading,
            speed: 1.1,
            floor: person.floor,
            source: "gps",
            confidence: "high",
            at: clock,
          },
        }))
      : []
    return [self, ...others, ...ghosts]
  }, [example, now, real, serverMembers, session.color, session.memberId, session.name])

  useEffect(() => {
    const self = members[0]?.location
    if (!self) return
    for (const member of members.slice(1)) {
      if (member.example || !member.location) continue
      const distance = distanceMeters(self.lat, self.lng, member.location.lat, member.location.lng)
      const previous = prevDistance.current.get(member.id)
      if (previous != null && previous > 40 && distance < 20) {
        setNotice(`${member.name} قريب منك، حوالي ${formatDistance(distance)}`)
        navigator.vibrate?.(28)
      }
      prevDistance.current.set(member.id, distance)
    }
  }, [members])

  const self = members[0]
  const kaabaDistance = self.location
    ? distanceMeters(self.location.lat, self.location.lng, haram.kaaba.lat, haram.kaaba.lng)
    : null

  async function enableMotion() {
    const result = await requestMotionPermission()
    setMotion(result === "granted" ? "ready" : result)
  }

  async function share() {
    const text = `ادخل مجموعة «${groupName}» في رِفاق\nالرمز: ${session.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: "رِفاق", text })
        setShareState("shared")
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setShareState("cancelled")
          return
        }
      }
    }
    try {
      await navigator.clipboard.writeText(session.code)
      setShareState("copied")
    } catch {
      setShareState("failed")
    }
  }

  async function leave() {
    await fetch(`/api/groups/${session.code}/leave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: session.token }),
    }).catch(() => undefined)
    clearSession()
    router.replace("/")
  }

  function acceptFloor() {
    if (!floorHint) return
    setFloor(floorHint.floor)
    setNotice(`تم تثبيت الدور: ${floorLabel(floorHint.floor)}`)
  }

  return {
    groupName,
    members,
    self,
    link,
    floor,
    setFloor,
    floors: FLOORS,
    gpsError,
    retryGps: () => setGpsNonce((value) => value + 1),
    example,
    setExample,
    now,
    motion,
    enableMotion,
    notice,
    floorHint,
    acceptFloor,
    dismissFloor: () => setFloorHint(null),
    heading,
    kaabaDistance,
    shareState,
    share,
    leave,
    clock: () => Date.now() + skew.current,
  }
}
