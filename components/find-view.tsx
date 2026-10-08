"use client"

import { bearingDegrees, distanceMeters } from "@/lib/geo"
import { cardinal, formatAccuracy, formatDistance, relativeDirection } from "@/lib/format"
import { floorLabel, type PublicMember } from "@/lib/types"

type Props = {
  member: PublicMember
  self: PublicMember
  onClose: () => void
  onEnableMotion: () => void
}

export function FindView({ member, self, onClose, onEnableMotion }: Props) {
  const location = member.location
  const origin = self.location
  const ready = Boolean(location && origin)
  const distance =
    location && origin ? distanceMeters(origin.lat, origin.lng, location.lat, location.lng) : null
  const bearing =
    location && origin ? bearingDegrees(origin.lat, origin.lng, location.lat, location.lng) : null
  const heading = origin?.heading ?? null
  const turn =
    bearing == null ? 0 : heading == null ? bearing : ((bearing - heading) % 360 + 360) % 360
  const where =
    bearing == null
      ? "بانتظار الموقعين"
      : heading == null
        ? cardinal(bearing)
        : (relativeDirection(bearing, heading) ?? cardinal(bearing))

  return (
    <section className="rf-find" role="dialog" aria-label={`البحث عن ${member.name}`}>
      <header className="rf-find-bar">
        <div>
          <p>البحث عن</p>
          <h2>{member.name}</h2>
        </div>
        <button type="button" className="rf-find-close" onClick={onClose} aria-label="إغلاق">
          ×
        </button>
      </header>

      <div className="rf-find-stage" aria-hidden={!ready}>
        <svg className="rf-find-arc" viewBox="0 0 240 140">
          <path d="M28 128 A 92 92 0 0 1 212 128" />
          <circle cx="120" cy="128" r="4" />
        </svg>
        <div className="rf-find-arrow" style={{ transform: `rotate(${turn}deg)` }}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <path d="M40 8l28 46H50.5V72h-21V54H12z" />
          </svg>
        </div>
      </div>

      <p className="rf-find-distance">{distance == null ? "—" : formatDistance(distance)}</p>
      <p className="rf-find-where">{where}</p>
      {location ? (
        <p className="rf-find-meta">
          {formatAccuracy(location.accuracy)}
          {location.floor ? ` · ${floorLabel(location.floor)}` : ""}
          {member.example ? " · مشهد تجريبي" : ""}
        </p>
      ) : (
        <p className="rf-find-meta">لم يصل موقع هذا الشخص بعد.</p>
      )}
      {heading == null ? (
        <button type="button" className="rf-find-compass" onClick={onEnableMotion}>
          فعّل البوصلة ليتحرك السهم مع هاتفك
        </button>
      ) : (
        <p className="rf-find-meta">السهم يتبع اتجاه هاتفك</p>
      )}
    </section>
  )
}
