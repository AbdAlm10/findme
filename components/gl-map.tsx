"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import {
  AttributionControl,
  ErrorEvent as MapErrorEvent,
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  type StyleSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { circleRing, distanceMeters, KAABA_LAT, KAABA_LNG } from "@/lib/geo"
import { formatAccuracy, formatDistance } from "@/lib/format"
import { featureCollection, haramFeatures, svgScene } from "@/lib/haram"
import type { FloorId, PublicMember } from "@/lib/types"
import type { MapHandle } from "@/components/haram-map"

type Props = {
  members: PublicMember[]
  selfId: string
  floor: FloorId
  now: number
  onSelect: (id: string) => void
  onUserMove: () => void
  onFail: () => void
}

function accuracyData(members: PublicMember[]) {
  return {
    type: "FeatureCollection" as const,
    features: members.flatMap((member) => {
      if (!member.location) return []
      return [
        {
          type: "Feature" as const,
          properties: { color: member.color },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              circleRing(
                member.location.lat,
                member.location.lng,
                Math.min(Math.max(member.location.accuracy, 5), 250),
              ),
            ],
          },
        },
      ]
    }),
  }
}

function mapStyle() {
  const scene = featureCollection(haramFeatures())
  return {
    version: 8 as const,
    sources: {
      basemap: {
        type: "raster" as const,
        tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap © CARTO",
      },
      haram: { type: "geojson" as const, data: scene },
      accuracy: {
        type: "geojson" as const,
        data: { type: "FeatureCollection" as const, features: [] },
      },
    },
    layers: [
      { id: "bg", type: "background" as const, paint: { "background-color": "#101c18" } },
      { id: "basemap", type: "raster" as const, source: "basemap", paint: { "raster-opacity": 0.72 } },
      {
        id: "range",
        type: "line" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "range"],
        paint: { "line-color": "#e0c48a", "line-opacity": 0.35, "line-width": 1.2, "line-dasharray": [1.2, 1.4] },
      },
      {
        id: "mataf",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "mataf"],
        paint: { "fill-color": "#4c5846" },
      },
      {
        id: "mosque",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "mosque"],
        paint: { "fill-color": "#1d3b31", "fill-opacity": 0.93 },
      },
      {
        id: "safa",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "safa"],
        paint: { "fill-color": "#617056" },
      },
      {
        id: "marwa",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "marwa"],
        paint: { "fill-color": "#617056" },
      },
      {
        id: "sai-line",
        type: "line" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "sai"],
        paint: { "line-color": "#8eae86", "line-width": 7, "line-opacity": 0.55 },
      },
      {
        id: "tawaf-line",
        type: "line" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "tawaf"],
        paint: { "line-color": "#e0c48a", "line-width": 1.4, "line-opacity": 0.45 },
      },
      {
        id: "tawaf-first-line",
        type: "line" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "tawaf-first"],
        paint: { "line-color": "#f4efe6", "line-width": 1.2, "line-opacity": 0.18 },
      },
      {
        id: "mosque-line",
        type: "line" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "mosque"],
        paint: { "line-color": "#e0c48a", "line-width": 1.3, "line-opacity": 0.55 },
      },
      {
        id: "hijr",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "hijr"],
        paint: { "fill-color": "#7b624c" },
      },
      {
        id: "kaaba",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "kaaba"],
        paint: { "fill-color": "#0e0d0c" },
      },
      {
        id: "kaaba-line",
        type: "line" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "kaaba"],
        paint: { "line-color": "#e0c48a", "line-width": 2 },
      },
      {
        id: "maqam",
        type: "fill" as const,
        source: "haram",
        filter: ["==", ["get", "kind"], "maqam"],
        paint: { "fill-color": "#e0c48a" },
      },
      {
        id: "accuracy-fill",
        type: "fill" as const,
        source: "accuracy",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.16 },
      },
      {
        id: "accuracy-line",
        type: "line" as const,
        source: "accuracy",
        paint: { "line-color": ["get", "color"], "line-width": 1.4, "line-opacity": 0.85 },
      },
    ],
  }
}

export const GlMap = forwardRef<MapHandle, Props>(function GlMap(
  { members, selfId, floor, now, onSelect, onUserMove, onFail },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>())
  const [ready, setReady] = useState(false)
  const onSelectRef = useRef(onSelect)
  const onUserMoveRef = useRef(onUserMove)
  const onFailRef = useRef(onFail)
  onSelectRef.current = onSelect
  onUserMoveRef.current = onUserMove
  onFailRef.current = onFail

  useImperativeHandle(ref, () => ({
    focus(lat, lng) {
      const map = mapRef.current
      if (!map) return
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      map.easeTo({ center: [lng, lat], zoom: 17, duration: reduce ? 0 : 700 })
    },
    panTo(lat, lng) {
      const map = mapRef.current
      if (!map) return
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      map.easeTo({ center: [lng, lat], duration: reduce ? 0 : 800 })
    },
    fitHaram() {
      const map = mapRef.current
      if (!map) return
      const bounds = new LngLatBounds()
      const scene = featureCollection(haramFeatures())
      for (const feature of scene.features) {
        const geometry = feature.geometry
        const visit = (coord: number[]) => bounds.extend([coord[0], coord[1]])
        if (geometry.type === "Polygon") geometry.coordinates[0].forEach(visit)
        if (geometry.type === "MultiPolygon") geometry.coordinates.forEach((polygon) => polygon[0].forEach(visit))
        if (geometry.type === "LineString" && feature.properties.kind !== "range") geometry.coordinates.forEach(visit)
      }
      map.fitBounds(bounds, { padding: 48, duration: 600, maxZoom: 16.4 })
    },
    north() {
      mapRef.current?.easeTo({ bearing: 0, duration: 400 })
    },
    zoomIn() {
      mapRef.current?.zoomIn()
    },
    zoomOut() {
      mapRef.current?.zoomOut()
    },
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container,
        style: mapStyle() as StyleSpecification,
        center: [KAABA_LNG, KAABA_LAT],
        zoom: 15.4,
        attributionControl: false,
        pitchWithRotate: false,
        maxPitch: 0,
        fadeDuration: 0,
      })
    } catch {
      onFailRef.current()
      return
    }
    mapRef.current = map
    map.addControl(new AttributionControl({ compact: true }), "bottom-left")
    map.on("load", () => {
      setReady(true)
      const bounds = new LngLatBounds()
      for (const polygon of (featureCollection(haramFeatures()).features)) {
        if (polygon.properties.kind !== "mosque" || polygon.geometry.type !== "MultiPolygon") continue
        polygon.geometry.coordinates.forEach((ring) => ring[0].forEach((coord) => bounds.extend([coord[0], coord[1]])))
      }
      map.fitBounds(bounds, { padding: 36, duration: 0, maxZoom: 16 })
      const scene = svgScene()
      for (const place of scene.landmarks) {
        const el = document.createElement("div")
        el.className = "place-label"
        el.textContent = place.name
        new Marker({ element: el, anchor: "center" })
          .setLngLat([place.lng, place.lat])
          .addTo(map)
      }
      for (const gate of scene.gates) {
        const el = document.createElement("div")
        el.className = gate.major ? "gate gate-major" : "gate"
        el.innerHTML = `<span class="gate-dot"></span><span class="gate-name"></span>`
        const name = el.querySelector(".gate-name")
        if (name) name.textContent = gate.name
        new Marker({ element: el, anchor: "center" }).setLngLat([gate.lng, gate.lat]).addTo(map)
      }
    })
    map.on("dragstart", () => onUserMoveRef.current())
    map.on("zoom", () => {
      container.classList.toggle("rf-gates-named", map.getZoom() >= 16.3)
    })
    map.on("error", (event: MapErrorEvent) => {
      const message = String(event.error?.message ?? "")
      if (/tile|ajax|fetch|sprite|basemap/i.test(message)) {
        if (map.getLayer("basemap")) map.setLayoutProperty("basemap", "visibility", "none")
      }
    })
    const onResize = () => map.resize()
    window.addEventListener("resize", onResize)
    const markerMap = markers.current
    return () => {
      window.removeEventListener("resize", onResize)
      markerMap.forEach((record) => record.marker.remove())
      markerMap.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    map.setPaintProperty("sai-line", "line-opacity", floor === "sai" ? 0.95 : 0.4)
    map.setPaintProperty("sai-line", "line-width", floor === "sai" ? 11 : 7)
    map.setPaintProperty("tawaf-line", "line-opacity", floor === "ground" ? 0.7 : 0.2)
    map.setPaintProperty("tawaf-first-line", "line-opacity", floor === "first" ? 0.8 : 0.12)
  }, [floor, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const self = members.find((member) => member.id === selfId)?.location
    const seen = new Set<string>()
    for (const member of members) {
      if (!member.location) continue
      seen.add(member.id)
      let record = markers.current.get(member.id)
      if (!record) {
        const el = document.createElement("button")
        el.type = "button"
        el.className = "pin"
        el.innerHTML =
          '<span class="pin-head"></span><span class="pin-dot"></span><span class="pin-label"><b data-name></b><small data-meta></small></span>'
        el.addEventListener("click", (event) => {
          event.stopPropagation()
          const id = el.dataset.id
          if (id) onSelectRef.current(id)
        })
        const marker = new Marker({ element: el, anchor: "center" })
          .setLngLat([member.location.lng, member.location.lat])
          .addTo(map)
        record = { marker, el }
        markers.current.set(member.id, record)
      }
      record.el.dataset.id = member.id
      record.el.style.setProperty("--c", member.color)
      const stale = now - member.location.at > 45000
      record.el.classList.toggle("is-self", member.id === selfId)
      record.el.classList.toggle("is-example", Boolean(member.example))
      record.el.classList.toggle("is-stale", stale)
      record.el.classList.toggle("is-other-floor", member.location.floor !== floor)
      const name = record.el.querySelector("[data-name]")
      const meta = record.el.querySelector("[data-meta]")
      if (name) name.textContent = member.name
      let metaText = formatAccuracy(member.location.accuracy)
      if (member.id !== selfId && self) {
        metaText = formatDistance(
          distanceMeters(self.lat, self.lng, member.location.lat, member.location.lng),
        )
      }
      if (member.example) metaText = `تجريبي · ${metaText}`
      if (meta) meta.textContent = metaText
      record.el.setAttribute("aria-label", `${member.name} ${metaText}`)
      const head = record.el.querySelector(".pin-head") as HTMLElement | null
      if (head) {
        if (member.location.heading == null) head.hidden = true
        else {
          head.hidden = false
          head.style.transform = `rotate(${member.location.heading}deg)`
        }
      }
      record.marker.setLngLat([member.location.lng, member.location.lat])
    }
    for (const [id, record] of markers.current) {
      if (seen.has(id)) continue
      record.marker.remove()
      markers.current.delete(id)
    }
    const source = map.getSource("accuracy")
    if (source instanceof GeoJSONSource) source.setData(accuracyData(members))
  }, [floor, members, now, ready, selfId])

  return <div ref={containerRef} className="rf-canvas" />
})
