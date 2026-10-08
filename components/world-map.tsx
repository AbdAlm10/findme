"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { bindMapGesture, isPinTarget } from "@/components/bind-map-gesture"
import type { MapHandle } from "@/components/haram-map"
import { destination, distanceMeters, KAABA_LAT, KAABA_LNG } from "@/lib/geo"
import { formatAccuracy, formatDistance } from "@/lib/format"
import { applyWorldGesture, project, WORLD_CAMERA, type WorldCamera } from "@/lib/world-camera"
import type { PublicMember } from "@/lib/types"

type Camera = WorldCamera

type Props = {
  members: PublicMember[]
  selfId: string
  now: number
  onSelect: (id: string) => void
  onUserMove: () => void
}

const WORLD = WORLD_CAMERA

export const WorldMap = forwardRef<MapHandle, Props>(function WorldMap(
  { members, selfId, now, onSelect, onUserMove },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Camera>(WORLD)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const camRef = useRef(cam)
  const gestureCam = useRef<Camera | null>(null)
  const gesturing = useRef(false)
  const onUserMoveRef = useRef(onUserMove)
  camRef.current = cam
  onUserMoveRef.current = onUserMove

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => {
      const box = root.getBoundingClientRect()
      if (box.width > 0) setSize({ w: box.width, h: box.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setCam((current) => ({
        ...current,
        zoom: Math.min(18, Math.max(2, current.zoom + (event.deltaY > 0 ? -1 : 1))),
      }))
    }
    root.addEventListener("wheel", onWheel, { passive: false })
    const unbind = bindMapGesture(root, {
      shouldIgnore: isPinTarget,
      onStart() {
        gestureCam.current = camRef.current
        gesturing.current = true
        onUserMoveRef.current()
      },
      onMove(origin, current, rect) {
        const start = gestureCam.current
        if (!start) return
        const next = applyWorldGesture(start, origin, current, rect)
        if (next) setCam(next)
      },
      onEnd() {
        gesturing.current = false
      },
    })
    return () => {
      root.removeEventListener("wheel", onWheel)
      unbind()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      if (gesturing.current) return
      setCam((current) => ({ lat, lng, zoom: Math.max(current.zoom, 15) }))
    },
    panTo(lat, lng) {
      if (gesturing.current) return
      setCam((current) => ({ ...current, lat, lng }))
    },
    fitHaram() {
      setCam({ lat: KAABA_LAT, lng: KAABA_LNG, zoom: 16 })
    },
    fitWorld() {
      setCam(WORLD)
    },
    north() {},
    zoomIn() {
      setCam((current) => ({ ...current, zoom: Math.min(18, current.zoom + 1) }))
    },
    zoomOut() {
      setCam((current) => ({ ...current, zoom: Math.max(2, current.zoom - 1) }))
    },
  }))

  const center = project(cam.lat, cam.lng, cam.zoom)
  const left = center.x - size.w / 2
  const top = center.y - size.h / 2
  const n = 2 ** cam.zoom
  const x0 = Math.floor(left / 256)
  const x1 = Math.floor((left + size.w) / 256)
  const y0 = Math.max(0, Math.floor(top / 256))
  const y1 = Math.min(n - 1, Math.floor((top + size.h) / 256))
  const tileNodes: { key: string; src: string; left: number; top: number }[] = []
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const wrapped = ((x % n) + n) % n
      const src = `https://tile.openstreetmap.org/${cam.zoom}/${wrapped}/${y}.png`
      tileNodes.push({ key: `${cam.zoom}/${x}/${y}`, src, left: x * 256 - left, top: y * 256 - top })
    }
  }

  const self = members.find((member) => member.id === selfId)?.location

  return (
    <div
      ref={rootRef}
      className="rf-canvas rf-world"
      role="application"
      aria-label="خريطة العالم"
    >
      {tileNodes.map((tile) => (
        // Map tiles are remote rasters; the image optimizer would proxy every tile.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          className="rf-tile"
          alt=""
          src={tile.src}
          draggable={false}
          style={{ left: tile.left, top: tile.top }}
          onError={() => undefined}
        />
      ))}
      {members.map((member) => {
        if (!member.location) return null
        const point = project(member.location.lat, member.location.lng, cam.zoom)
        const edge = project(
          destination(member.location.lat, member.location.lng, 90, Math.min(member.location.accuracy, 250)).lat,
          destination(member.location.lat, member.location.lng, 90, Math.min(member.location.accuracy, 250)).lng,
          cam.zoom,
        )
        const radius = Math.abs(edge.x - point.x)
        const stale = now - member.location.at > 45000
        const distance =
          member.id !== selfId && self
            ? formatDistance(distanceMeters(self.lat, self.lng, member.location.lat, member.location.lng))
            : formatAccuracy(member.location.accuracy)
        return (
          <button
            key={member.id}
            type="button"
            className={`pin${member.id === selfId ? " is-self" : ""}${stale ? " is-stale" : ""}${member.example ? " is-example" : ""}`}
            style={{ left: point.x - left, top: point.y - top, ["--c" as string]: member.color }}
            onClick={() => onSelect(member.id)}
          >
            <span className="pin-range" style={{ width: radius * 2, height: radius * 2 }} />
            {member.location.heading != null ? (
              <span className="pin-head" style={{ transform: `rotate(${member.location.heading}deg)` }} />
            ) : null}
            <span className="pin-dot" />
            <span className="pin-label">
              <b>{member.id === selfId ? "أنت" : member.name}</b>
              <small>{member.example ? `تجريبي · ${distance}` : distance}</small>
            </span>
          </button>
        )
      })}
      <p className="rf-map-credit">
        © مساهمو OpenStreetMap
      </p>
    </div>
  )
})
