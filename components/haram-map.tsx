"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { GlMap } from "@/components/gl-map"
import { SvgMap } from "@/components/svg-map"
import type { FloorId, PublicMember } from "@/lib/types"

export type MapHandle = {
  focus: (lat: number, lng: number) => void
  panTo: (lat: number, lng: number) => void
  fitHaram: () => void
  north: () => void
  zoomIn: () => void
  zoomOut: () => void
}

type Props = {
  members: PublicMember[]
  selfId: string
  floor: FloorId
  now: number
  onSelect: (id: string) => void
  onUserMove: () => void
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

export const HaramMap = forwardRef<MapHandle, Props>(function HaramMap(props, ref) {
  const [engine, setEngine] = useState<"pending" | "gl" | "svg">("pending")
  const glRef = useRef<MapHandle>(null)
  const svgRef = useRef<MapHandle>(null)

  useEffect(() => {
    setEngine(hasWebGL() ? "gl" : "svg")
  }, [])

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      ;(engine === "svg" ? svgRef : glRef).current?.focus(lat, lng)
    },
    panTo(lat, lng) {
      ;(engine === "svg" ? svgRef : glRef).current?.panTo(lat, lng)
    },
    fitHaram() {
      ;(engine === "svg" ? svgRef : glRef).current?.fitHaram()
    },
    north() {
      ;(engine === "svg" ? svgRef : glRef).current?.north()
    },
    zoomIn() {
      ;(engine === "svg" ? svgRef : glRef).current?.zoomIn()
    },
    zoomOut() {
      ;(engine === "svg" ? svgRef : glRef).current?.zoomOut()
    },
  }))

  if (engine === "pending") {
    return <div className="rf-canvas rf-boot">نجهّز خريطة الحرم…</div>
  }

  if (engine === "svg") {
    return <SvgMap ref={svgRef} {...props} />
  }

  return <GlMap ref={glRef} {...props} onFail={() => setEngine("svg")} />
})
