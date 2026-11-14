// Kleine Vorschau einer Route für die Missionsliste.
import { toRad } from "../lib/geo";

const THUMB_W = 64;

const THUMB_H = 40;

function thumbPoints(e) {
  if (!Array.isArray(e) || e.length === 0) return [];
  let t = e.reduce((e, t) => e + t.lat, 0) / e.length,
    n = Math.cos(toRad(t)),
    r = e.map((e) => ({
      x: e.lon * n,
      y: -e.lat,
    })),
    i = r.map((e) => e.x),
    a = r.map((e) => e.y),
    o = Math.min(...i),
    s = Math.min(...a),
    c = Math.max(...i) - o,
    l = Math.max(...a) - s,
    u = c === 0 && l === 0 ? 0 : Math.min(54 / (c || 1e-12), 30 / (l || 1e-12)),
    d = (THUMB_W - c * u) / 2,
    f = (THUMB_H - l * u) / 2;
  return r.map((e) => ({
    x: (e.x - o) * u + d,
    y: (e.y - s) * u + f,
  }));
}

export function MissionThumb({ waypoints: e, className = "" }) {
  let n = thumbPoints(e);
  return (
    <svg
      viewBox={`0 0 ${THUMB_W} ${THUMB_H}`}
      className={className}
      aria-hidden="true"
      fill="none"
    >
      {n.length > 1 && (
        <polyline
          points={n.map((e) => `${e.x.toFixed(1)},${e.y.toFixed(1)}`).join(" ")}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {n.length > 0 && (
        <circle cx={n[0].x} cy={n[0].y} r="2.6" fill="currentColor" />
      )}
    </svg>
  );
}
