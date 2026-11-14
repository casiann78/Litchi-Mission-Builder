// Plant die Standbilder eines Videos und formatiert Fortschritt und Dauer.
export const FRAME_INTERVALS = [3, 5, 10];

const FRAME_START_OFFSET = 0.3;

const FRAME_END_MARGIN = 0.2;

export function nearestInterval(e) {
  let t = Number(e);
  return Number.isFinite(t)
    ? FRAME_INTERVALS.reduce((e, n) =>
        Math.abs(n - t) <= Math.abs(e - t) ? n : e,
      )
    : 5;
}

export function planFrameTimes(e, t = 5, n = 40) {
  let requested = nearestInterval(t);
  if (!Number.isFinite(e) || e <= 0)
    return {
      times: [],
      interval: requested,
      requested: requested,
      capped: false,
      count: 0,
    };
  let i = Math.max(0, e - FRAME_END_MARGIN),
    interval = requested,
    o = Math.floor(e / requested) + 1,
    capped = false;
  o > n && ((capped = true), (o = n), (interval = e / (n - 1)));
  let c = [];
  for (let e = 0; e < o; e++) {
    let t = Math.min(
      e === 0 ? Math.min(FRAME_START_OFFSET, i) : e * interval,
      i,
    );
    (c.length === 0 || t - c[c.length - 1] > 0.05) &&
      c.push(Math.round(t * 1e3) / 1e3);
  }
  return {
    times: c,
    interval: interval,
    requested: requested,
    capped: capped,
    count: c.length,
  };
}

export function formatClock(e) {
  let t = Math.max(0, Math.round(e)),
    n = Math.floor(t / 3600),
    r = Math.floor((t % 3600) / 60),
    i = t % 60,
    a = String(i).padStart(2, "0");
  return n > 0 ? `${n}:${String(r).padStart(2, "0")}:${a}` : `${r}:${a}`;
}

export function isVideoFile(e) {
  return e?.type
    ? e.type.startsWith("video/")
    : /\.(mp4|m4v|mov|webm|mkv|avi|3gp|ogv)$/i.test(e?.name || "");
}

export function estimateDuration(e) {
  let t = e * 3;
  return t < 50
    ? "unter einer Minute"
    : t < 90
      ? "etwa eine Minute"
      : `etwa ${Math.round(t / 60)} Minuten`;
}

export function progressLabel(e) {
  if (!e) return "Erkenne Koordinaten…";
  let t = `${Math.round((e.progress || 0) * 100)} %`;
  return e.stage === "prepare"
    ? "Bild wird vorbereitet…"
    : e.stage === "model"
      ? `Lade Erkennungsmodell (einmalig, ca. 7 MB)… ${t}`
      : e.stage === "tiles"
        ? `Kleine Schrift? Lese das Bild in Ausschnitten, ${e.pass} von ${e.passes}… ${t}`
        : `Erkenne Text, Durchgang ${e.pass} von ${e.passes}… ${t}`;
}

export function progressFraction(e) {
  return !e || e.stage === "prepare"
    ? 0.03
    : e.stage === "model"
      ? 0.4 * (e.progress || 0)
      : e.stage === "tiles"
        ? 0.7 +
          0.3 * (((e.pass || 1) - 1 + (e.progress || 0)) / (e.passes || 1))
        : 0.4 +
          0.6 * (((e.pass || 1) - 1 + (e.progress || 0)) / (e.passes || 1));
}
