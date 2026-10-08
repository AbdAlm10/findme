"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { bindMapGesture } from "@/components/bind-map-gesture"
import { distanceMeters } from "@/lib/geo"
import { formatAccuracy, formatDistance } from "@/lib/format"
import { svgScene, toSvg } from "@/lib/haram"
import type { FloorId, PublicMember } from "@/lib/types"
import type { MapHandle } from "@/components/haram-map"

const scene = svgScene()

type Insets = { top: number; right: number; bottom: number; left: number }
type Viewport = { w: number; h: number; aspect: number; insets: Insets }

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Fit the mosque into the part of the map that panels do not cover. */
function frameFor(view: Viewport): Camera {
  const { minX, minY, width, height } = scene.bounds
  const cx0 = minX + width / 2
  const cy0 = minY + height / 2
  const pxW = Math.max(view.w, 1)
  const pxH = Math.max(view.h, 1)
  const visW = Math.max(48, pxW - view.insets.left - view.insets.right)
  const visH = Math.max(48, pxH - view.insets.top - view.insets.bottom)
  const worldVisW = Math.max(width, height / Math.max(visH / visW, 0.2)) * 1.12
  const w = worldVisW * (pxW / visW)
  const viewH = w * Math.max(view.aspect, 0.25)
  const visCenterX = (view.insets.left + visW / 2) / pxW
  const visCenterY = (view.insets.top + visH / 2) / pxH
  return {
    cx: cx0 + w * (0.5 - visCenterX),
    cy: cy0 + viewH * (0.5 - visCenterY),
    w,
  }
}

function readViewport(svg: SVGSVGElement): Viewport {
  const box = svg.getBoundingClientRect()
  const aspect = box.width > 0 ? box.height / box.width : 0.72
  const insets = { ...ZERO_INSETS }
  const root = svg.parentElement
  if (root && box.width > 0 && box.height > 0) {
    for (const el of root.querySelectorAll<HTMLElement>(".rf-roster, .rf-top")) {
      const rect = el.getBoundingClientRect()
      const overlapW = Math.min(rect.right, box.right) - Math.max(rect.left, box.left)
      const overlapH = Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top)
      if (overlapW < 24 || overlapH < 24) continue
      const fromLeft = Math.max(0, rect.left - box.left)
      const fromRight = Math.max(0, box.right - rect.right)
      const fromTop = Math.max(0, rect.top - box.top)
      const fromBottom = Math.max(0, box.bottom - rect.bottom)
      if (overlapH > box.height * 0.45 && overlapW < box.width * 0.55) {
        if (fromLeft <= fromRight) insets.left = Math.max(insets.left, overlapW + 8)
        else insets.right = Math.max(insets.right, overlapW + 8)
      } else if (fromTop <= fromBottom) {
        insets.top = Math.max(insets.top, overlapH + 8)
      } else {
        insets.bottom = Math.max(insets.bottom, overlapH + 8)
      }
    }
  }
  return { w: box.width || 390, h: box.height || 700, aspect, insets }
}

type Props = {
  members: PublicMember[]
  selfId: string
  floor: FloorId
  now: number
  onSelect: (id: string) => void
  onUserMove: () => void
}

type Camera = { cx: number; cy: number; w: number }
type Point = { x: number; y: number }
type Box = { left: number; top: number; width: number; height: number }

function applyHaramGesture(start: Camera, origin: Point[], current: Point[], box: Box): Camera | null {
  if (box.width < 1 || origin.length === 0 || origin.length !== current.length) return null
  const metersPerPixel = (width: number) => width / box.width
  if (origin.length === 1) {
    const scale = metersPerPixel(start.w)
    return {
      cx: start.cx - (current[0].x - origin[0].x) * scale,
      cy: start.cy - (current[0].y - origin[0].y) * scale,
      w: start.w,
    }
  }
  const dist0 = Math.hypot(origin[1].x - origin[0].x, origin[1].y - origin[0].y) || 1
  const dist1 = Math.hypot(current[1].x - current[0].x, current[1].y - current[0].y) || 1
  const w = Math.min(4200, Math.max(90, start.w / (dist1 / dist0)))
  const mid0 = { x: (origin[0].x + origin[1].x) / 2, y: (origin[0].y + origin[1].y) / 2 }
  const mid1 = { x: (current[0].x + current[1].x) / 2, y: (current[0].y + current[1].y) / 2 }
  const startScale = metersPerPixel(start.w)
  const worldX = start.cx + (mid0.x - box.left - box.width / 2) * startScale
  const worldY = start.cy + (mid0.y - box.top - box.height / 2) * startScale
  const nextScale = metersPerPixel(w)
  return {
    cx: worldX - (mid1.x - box.left - box.width / 2) * nextScale,
    cy: worldY - (mid1.y - box.top - box.height / 2) * nextScale,
    w,
  }
}

export const SvgMap = forwardRef<MapHandle, Props>(function SvgMap(
  { members, selfId, floor, now, onSelect, onUserMove },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<Viewport>({
    w: 390,
    h: 700,
    aspect: 0.72,
    insets: ZERO_INSETS,
  })
  const [cam, setCam] = useState<Camera>(() =>
    frameFor({ w: 390, h: 700, aspect: 0.72, insets: ZERO_INSETS }),
  )
  const camRef = useRef(cam)
  const gestureCam = useRef<Camera | null>(null)
  const gesturing = useRef(false)
  const onUserMoveRef = useRef(onUserMove)
  const fitted = useRef(true)
  camRef.current = cam
  onUserMoveRef.current = onUserMove
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const next = readViewport(svg)
      setView((current) => {
        const same =
          Math.abs(current.w - next.w) < 1 &&
          Math.abs(current.h - next.h) < 1 &&
          Math.abs(current.aspect - next.aspect) < 0.01 &&
          Math.abs(current.insets.top - next.insets.top) < 2 &&
          Math.abs(current.insets.right - next.insets.right) < 2 &&
          Math.abs(current.insets.bottom - next.insets.bottom) < 2 &&
          Math.abs(current.insets.left - next.insets.left) < 2
        return same ? current : next
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    const root = svg.parentElement
    if (root) {
      observer.observe(root)
      for (const el of root.querySelectorAll(".rf-roster, .rf-top")) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!fitted.current) return
    setCam(frameFor(view))
  }, [view])

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      const point = toSvg(lat, lng)
      setCam((current) => ({ ...current, cx: point.x, cy: point.y, w: Math.min(current.w, 320) }))
    },
    panTo(lat, lng) {
      if (gesturing.current) return
      const point = toSvg(lat, lng)
      setCam((current) => ({ ...current, cx: point.x, cy: point.y }))
    },
    fitHaram() {
      fitted.current = true
      setCam(frameFor(viewRef.current))
    },
    fitWorld() {
      fitted.current = true
      setCam(frameFor(viewRef.current))
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
    const unbind = bindMapGesture(svg, {
      shouldIgnore: (target) => target instanceof Element && Boolean(target.closest(".svg-hit")),
      onStart() {
        fitted.current = false
        gestureCam.current = camRef.current
        gesturing.current = true
        onUserMoveRef.current()
      },
      onMove(origin, current, rect) {
        const start = gestureCam.current
        if (!start) return
        const next = applyHaramGesture(start, origin, current, rect)
        if (next) setCam(next)
      },
      onEnd() {
        gesturing.current = false
      },
    })
    return () => {
      svg.removeEventListener("wheel", onWheel)
      unbind()
    }
  }, [])

  const viewH = cam.w * Math.max(view.aspect, 0.25)
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
    >
      <rect x={cam.cx - cam.w} y={cam.cy - viewH} width={cam.w * 3} height={viewH * 3} className="svg-bg" />
      {scene.paths.map((path, index) => (
        <path
          key={`${path.kind}-${index}`}
          d={path.d}
          className={`svg-${path.kind}${floor === "sai" && path.kind === "sai" ? " is-hot" : ""}${floor === "ground" && path.kind === "tawaf" ? " is-hot" : ""}`}
          fillRule="evenodd"
          vectorEffect={path.kind === "sai" ? undefined : "non-scaling-stroke"}
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
            <circle className="svg-hit" r={label * 0.28} fill={member.color} stroke="#f4efe6" strokeWidth={label * 0.06} />
            {member.location.heading != null ? (
              <polygon
                points={`0,${-label * 0.72} ${label * 0.16},${-label * 0.28} ${-label * 0.16},${-label * 0.28}`}
                className="svg-hit"
                fill={member.color}
                transform={`rotate(${member.location.heading})`}
              />
            ) : null}
            <text y={label * 0.85} fontSize={label * 0.38} textAnchor="middle" className="svg-text svg-hit">
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
