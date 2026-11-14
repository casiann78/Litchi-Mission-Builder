// Erzeugt die CSV-Datei für den Litchi Mission Hub und lädt sie herunter.
import { computeLegs } from "./geo";

function buildLitchiCsv(e) {
  let t = e.waypoints || [],
    n = computeLegs(t),
    r = [
      "latitude",
      "longitude",
      "altitude(m)",
      "heading(deg)",
      "curvesize(m)",
      "rotationdir",
      "gimbalmode",
      "gimbalpitchangle",
      ...Array.from(
        {
          length: 15,
        },
        (e, t) => [`actiontype${t + 1}`, `actionparam${t + 1}`],
      ).flat(),
      "altitudemode",
      "speed(m/s)",
      "poi_latitude",
      "poi_longitude",
      "poi_altitude(m)",
      "poi_altitudemode",
      "photo_timeinterval",
      "photo_distinterval",
    ],
    i = t.map((t, r) => {
      let i;
      i =
        e.headingMode === "auto"
          ? n[r].brg === null
            ? n[r - 1]
              ? n[r - 1].brg
              : 0
            : n[r].brg
          : e.headingMode === "fixed"
            ? e.fixedHeading
            : t.heading;
      let a = Array.from(
        {
          length: 15,
        },
        () => [-1, 0],
      );
      t.action === "photo"
        ? (a[0] = [1, 0])
        : t.action === "stay"
          ? (a[0] = [0, Math.round((t.actionParam || 0) * 1e3)])
          : t.action === "rotate" && (a[0] = [4, t.actionParam || 0]);
      return [
        t.lat,
        t.lon,
        t.altitude,
        Math.round(i * 100) / 100,
        e.curveSize,
        e.rotationDir,
        e.gimbalMode,
        t.gimbalPitch,
        ...a.flat(),
        e.altitudeMode,
        e.defaultSpeed,
        0,
        0,
        0,
        0,
        0,
        0,
      ];
    });
  return [r.join(","), ...i.map((e) => e.join(","))].join(`
`);
}

export function downloadCsv(e, t) {
  let n = new Blob([e], {
      type: "text/csv;charset=utf-8;",
    }),
    r = URL.createObjectURL(n),
    i = document.createElement("a"),
    a = (t || "mission").trim().replace(/[^a-z0-9\-_]+/gi, "_") || "mission";
  i.href = r;
  i.download = `${a}.csv`;
  document.body.appendChild(i);
  i.click();
  document.body.removeChild(i);
  URL.revokeObjectURL(r);
}

const isFiniteNumber = (e) => typeof e == "number" && Number.isFinite(e);

function applyWaypointDefaults(e, { defaultAltitude: t, defaultGimbalPitch }) {
  return (e || []).map((e) => ({
    ...e,
    altitude: isFiniteNumber(e.altitude) ? e.altitude : t,
    gimbalPitch: isFiniteNumber(e.gimbalPitch)
      ? e.gimbalPitch
      : defaultGimbalPitch,
  }));
}

export function missionToCsv(e) {
  return buildLitchiCsv({
    ...e,
    waypoints: applyWaypointDefaults(e.waypoints, e),
  });
}
