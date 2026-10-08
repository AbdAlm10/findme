"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { distanceMeters } from "@/lib/geo"
import { formatAccuracy, formatDistance } from "@/lib/format"
import { svgScene, toSvg } from "@/lib/haram"
import type { FloorId, PublicMember } from "@/lib/types"
import type { MapHandle } from "@/components/haram-map"

const scene = svgScene()

type Props = {
  members: PublicMember[]
  selfId: string
  floor: FloorId
  now: number
  onSelect: (id: string) => void
  onUserMove: () => void
}

type Camera = { cx: number; cy: number; w: number }

export const SvgMap = forwardRef<MapHandle, Props>(function SvgMap(
  { members, selfId, floor, now, onSelect, onUserMove },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cam, setCam] = useState<Camera>({
    cx: scene.bounds.minX + scene.bounds.width / 2,
    cy: scene.bounds.minY + scene.bounds.height / 2,
    w: scene.bounds.width,
  })
  const drag = useRef<{ id: number; x: number; y: number; cx: number; cy: number } | null>(null)
  const [aspect, setAspect] = useState(1.35)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const box = svg.getBoundingClientRect()
      if (box.width > 0) setAspect(box.height / box.width)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      const point = toSvg(lat, lng)
      setCam((current) => ({ ...current, cx: point.x, cy: point.y, w: Math.min(current.w, 320) }))
    },
    panTo(lat, lng) {
      const point = toSvg(lat, lng)
      setCam((current) => ({ ...current, cx: point.x, cy: point.y }))
    },
    fitHaram() {
      setCam({
        cx: scene.bounds.minX + scene.bounds.width / 2,
        cy: scene.bounds.minY + scene.bounds.height / 2,
        w: scene.bounds.width,
      })
    },
    north() {},
    zoomIn() {
      setCam((current) => ({ ...current, w: Math.max(90, current.w / 1.3) }))
    },
    zoomOut() {
      setCam((current) => ({ ...current, w: Math.min(4200, current.w * 1.3) }))
    },
  }))

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY > 0 ? 1.12 : 0.88
      setCam((current) => ({ ...current, w: Math.min(4200, Math.max(90, current.w * factor)) }))
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [])

  const viewH = cam.w * aspect
  const label = Math.max(8, cam.w / 38)
  const showGates = cam.w < 820
  const self = members.find((member) => member.id === selfId)?.location

  return (
    <svg
      ref={svgRef}
      className="rf-canvas rf-svg"
      viewBox={`${cam.cx - cam.w / 2} ${cam.cy - viewH / 2} ${cam.w} ${viewH}`}
      role="application"
      aria-label="خريطة المسجد الحرام"
      onPointerDown={(event) => {
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: cam.cx, cy: cam.cy }
        event.currentTarget.setPointerCapture(event.pointerId)
        onUserMove()
      }}
      onPointerMove={(event) => {
        const start = drag.current
        const box = event.currentTarget.getBoundingClientRect()
        if (!start || start.id !== event.pointerId || box.width === 0) return
        const metersPerPixel = cam.w / box.width
        setCam((current) => ({
          ...current,
          cx: start.cx - (event.clientX - start.x) * metersPerPixel,
          cy: start.cy - (event.clientY - start.y) * metersPerPixel,
        }))
      }}
      onPointerUp={() => {
        drag.current = null
      }}
    >
      <rect x={cam.cx - cam.w} y={cam.cy - viewH} width={cam.w * 3} height={viewH * 3} className="svg-bg" />
      {scene.paths.map((path, index) => (
        <path
          key={`${path.kind}-${index}`}
          d={path.d}
          className={`svg-${path.kind}${floor === "sai" && path.kind === "sai" ? " is-hot" : ""}${floor === "ground" && path.kind === "tawaf" ? " is-hot" : ""}`}
          fillRule="evenodd"
        />
      ))}
      {showGates
        ? scene.gates.map((gate) => {
            const point = toSvg(gate.lat, gate.lng)
            return (
              <g key={gate.id} transform={`translate(${point.x} ${point.y})`}>
                <circle r={label * 0.18} className="svg-gate" />
                {gate.major ? (
                  <text y={label * 0.7} fontSize={label * 0.42} textAnchor="middle" className="svg-text">
                    {gate.name}
                  </text>
                ) : null}
              </g>
            )
          })
        : null}
      {scene.landmarks.map((place) => {
        const point = toSvg(place.lat, place.lng)
        return (
          <text
            key={place.id}
            x={point.x}
            y={point.y - label * 0.8}
            fontSize={place.id === "kaaba" ? label * 0.48 : label * 0.4}
            textAnchor="middle"
            className="svg-text"
          >
            {place.name}
          </text>
        )
      })}
      {members.map((member) => {
        if (!member.location) return null
        const point = toSvg(member.location.lat, member.location.lng)
        const stale = now - member.location.at > 45000
        const distance =
          member.id !== selfId && self
            ? formatDistance(distanceMeters(self.lat, self.lng, member.location.lat, member.location.lng))
            : formatAccuracy(member.location.accuracy)
        return (
          <g
            key={member.id}
            transform={`translate(${point.x} ${point.y})`}
            className="svg-person"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(member.id)
            }}
          >
            <circle r={Math.min(member.location.accuracy, 250)} fill={member.color} opacity={stale ? 0.08 : 0.16} />
            <circle r={label * 0.28} fill={member.color} stroke="#f4efe6" strokeWidth={label * 0.06} />
            {member.location.heading != null ? (
              <polygon
                points={`0,${-label * 0.72} ${label * 0.16},${-label * 0.28} ${-label * 0.16},${-label * 0.28}`}
                fill={member.color}
                transform={`rotate(${member.location.heading})`}
              />
            ) : null}
            <text y={label * 0.85} fontSize={label * 0.38} textAnchor="middle" className="svg-text">
              {member.name}
            </text>
            <text y={label * 1.28} fontSize={label * 0.3} textAnchor="middle" className="svg-sub">
              {member.example ? `تجريبي · ${distance}` : distance}
            </text>
          </g>
        )
      })}
    </svg>
  )
})
