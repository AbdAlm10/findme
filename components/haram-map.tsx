"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"
import { SvgMap } from "@/components/svg-map"
import { KAABA_LAT, KAABA_LNG } from "@/lib/geo"
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

export const HaramMap = forwardRef<MapHandle, Props>(function HaramMap(props, ref) {
  const svgRef = useRef<MapHandle>(null)

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      svgRef.current?.focus(lat, lng)
    },
    panTo(lat, lng) {
      svgRef.current?.panTo(lat, lng)
    },
    fitHaram() {
      svgRef.current?.fitHaram()
    },
    north() {
      svgRef.current?.focus(KAABA_LAT, KAABA_LNG)
    },
    zoomIn() {
      svgRef.current?.zoomIn()
    },
    zoomOut() {
      svgRef.current?.zoomOut()
    },
  }))

  return <SvgMap ref={svgRef} {...props} />
})
