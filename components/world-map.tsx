"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { MapHandle } from "@/components/haram-map"
import { destination, distanceMeters, KAABA_LAT, KAABA_LNG } from "@/lib/geo"
import { formatAccuracy, formatDistance } from "@/lib/format"
import type { PublicMember } from "@/lib/types"

type Camera = { lat: number; lng: number; zoom: number }

type Props = {
  members: PublicMember[]
  selfId: string
  now: number
  onSelect: (id: string) => void
  onUserMove: () => void
}

const WORLD: Camera = { lat: 18, lng: 20, zoom: 2 }

function worldSize(zoom: number) {
  return 256 * 2 ** zoom
}

function project(lat: number, lng: number, zoom: number) {
  const size = worldSize(zoom)
  const x = ((lng + 180) / 360) * size
  const sine = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999)
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size
  return { x, y }
}

function unproject(x: number, y: number, zoom: number) {
  const size = worldSize(zoom)
  const lng = (x / size) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / size
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lat: Math.min(80, Math.max(-80, lat)), lng }
}

export const WorldMap = forwardRef<MapHandle, Props>(function WorldMap(
  { members, selfId, now, onSelect, onUserMove },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Camera>(WORLD)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const drag = useRef<{ id: number; x: number; y: number; lat: number; lng: number } | null>(null)
  const camRef = useRef(cam)
  camRef.current = cam

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
    return () => root.removeEventListener("wheel", onWheel)
  }, [])

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      setCam((current) => ({ lat, lng, zoom: Math.max(current.zoom, 15) }))
    },
    panTo(lat, lng) {
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
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest(".pin")) return
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lat: cam.lat, lng: cam.lng }
        event.currentTarget.setPointerCapture(event.pointerId)
        onUserMove()
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (!start || start.id !== event.pointerId) return
        const origin = project(start.lat, start.lng, camRef.current.zoom)
        const next = unproject(
          origin.x - (event.clientX - start.x),
          origin.y - (event.clientY - start.y),
          camRef.current.zoom,
        )
        setCam((current) => ({ ...current, lat: next.lat, lng: next.lng }))
      }}
      onPointerUp={() => {
        drag.current = null
      }}
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
