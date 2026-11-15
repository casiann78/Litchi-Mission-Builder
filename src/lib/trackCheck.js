// Prüft gelesene Koordinaten gegen die Strecke und korrigiert falsch gelesene Ziffern.
import { haversineDistance } from "./geo";

export function confidenceInfo(e) {
  if (e.fix)
    return {
      level: "high",
      label: "Korrigiert, passt zur Strecke",
    };
  if (e.trackSupport >= 2)
    return {
      level: "high",
      label: "Passt zur Strecke",
    };
  if (e.jump)
    return {
      level: "mid",
      label: "Ortswechsel, bitte prüfen",
    };
  let t = e.confidence,
    n = Array.isArray(e.alternatives) && e.alternatives.length > 0;
  return typeof t == "number"
    ? n
      ? t >= 65
        ? {
            level: "mid",
            label: "Bitte prüfen",
          }
        : {
            level: "low",
            label: "Unsicher, bitte prüfen",
          }
      : t >= 85 && e.agreement >= 2
        ? {
            level: "high",
            label: "Sicher gelesen",
          }
        : t >= 85
          ? {
              level: "high",
              label: "Gut lesbar",
            }
          : t >= 65
            ? {
                level: "mid",
                label: "Bitte prüfen",
              }
            : {
                level: "low",
                label: "Unsicher, bitte prüfen",
              }
    : {
        level: "unknown",
        label: "Sicherheit unbekannt",
      };
}

export function distanceFromStartKm(e, t) {
  if (!t.length) return null;
  let n = t[0];
  return haversineDistance(n.lat, n.lon, e.lat, e.lon) / 1e3;
}

export const resultKey = (e, t) =>
  `${e}:${t.frameTime ?? ""}:${t.lat}:${t.lon}`;

const MIN_SUPPORT = 2;

const METERS_PER_DEG = 111320;

const MAX_EDITS = 2;

const SPEED_FACTOR = 2.5;

const MAX_SPEED_MS = 55;

const toleranceMeters = (e) => 30 * Math.abs(e) + 25;

// Feinprüfung: ab dieser Abweichung von der Linie zwischen den Nachbarn (zusätzlich
// zu deren Abstand) wird nach einer verwechselten Ziffer gesucht …
const FINE_MIN_DEVIATION_M = 3;

// … und so nah an der Linie muss der korrigierte Punkt mindestens liegen.
const FINE_WINDOW_M = 1.5;

const CONFUSABLE_DIGITS = new Set(
  [
    "09",
    "08",
    "06",
    "89",
    "68",
    "69",
    "56",
    "35",
    "38",
    "58",
    "17",
    "27",
    "28",
    "49",
    "14",
    "02",
  ].flatMap((e) => [e, e[1] + e[0]]),
);

const digitCost = (e, t) => (CONFUSABLE_DIGITS.has(e + t) ? 0.5 : 1);

const isDigit = (e) => e >= "0" && e <= "9";

const isDecimalText = (e) => /^\d{1,3}\.\d+$/.test(e);

const decimalPlaces = (e) =>
  e && e.includes(".") ? e.split(".")[1].length : null;

function singleEdits(e) {
  let t = [];
  for (let n = 0; n < e.length; n++) {
    let r = e[n];
    if (isDigit(r)) {
      for (let i = 0; i <= 9; i++) {
        let a = String(i);
        a !== r &&
          t.push([
            e.slice(0, n) + a + e.slice(n + 1),
            digitCost(r, a),
            +!CONFUSABLE_DIGITS.has(r + a),
          ]);
      }
      t.push([e.slice(0, n) + e.slice(n + 1), 1, 0]);
    }
  }
  for (let n = 0; n <= e.length; n++)
    for (let r = 0; r <= 9; r++) t.push([e.slice(0, n) + r + e.slice(n), 1, 0]);
  return t;
}

const variantCache = new Map();

function digitVariants(e, t, n, r = 1, i = null) {
  if (!e || !/^[\d.]+$/.test(e)) return [];
  let a = `${e}|${t}|${n}|${r}|${i}`;
  if (variantCache.has(a)) return variantCache.get(a);
  let o = new Map([[e, [0, 0]]]),
    s = [[e, 0, 0]],
    c = [],
    l = (e, t) => e[0] < t[0] || (e[0] === t[0] && e[1] < t[1]);
  for (let e = 1; e <= MAX_EDITS && !c.length; e++) {
    let e = [],
      a = [];
    for (let [c, u, d] of s)
      for (let [text, f, p] of singleEdits(c)) {
        let cost = u + f,
          atypical = d + p;
        if (
          (o.has(text) && !l([cost, atypical], o.get(text))) ||
          (o.set(text, [cost, atypical]),
          a.push([text, cost, atypical]),
          !isDecimalText(text) || (i !== null && decimalPlaces(text) !== i))
        )
          continue;
        let h = r * parseFloat(text);
        h >= t &&
          h <= n &&
          e.push({
            value: h,
            cost: cost,
            text: text,
            atypical: atypical,
          });
      }
    let u = new Map();
    for (let t of e) {
      let e = u.get(t.value);
      (!e || l([t.cost, t.atypical], [e.cost, e.atypical])) &&
        u.set(t.value, t);
    }
    c = [...u.values()].sort((e, t) => e.cost - t.cost);
    s = a;
  }
  variantCache.size > 5e3 && variantCache.clear();
  variantCache.set(a, c);
  return c;
}

const coordText = (e, t) =>
  t && isDecimalText(t) ? t : Math.abs(e).toFixed(6);

const signOf = (e) => (e < 0 ? -1 : 1);

const hasReadings = (e) => e && e.readings.length > 0;

function commonDecimals(e, t) {
  let n = new Map();
  for (let r of e) {
    let e = decimalPlaces(r[t]);
    e !== null && n.set(e, (n.get(e) || 0) + 1);
  }
  let r = [...n.entries()].sort((e, t) => t[1] - e[1]);
  return !r.length || r[0][1] < 2 || (r[1] && r[1][1] === r[0][1])
    ? null
    : r[0][0];
}

function checkAgainstTrack(e, t, n) {
  let r = e[t],
    i = (i, a, o) => {
      let s = [];
      for (
        let c = t + i;
        c >= 0 && c < e.length && Math.abs(c - t) <= o && s.length < a;
        c += i
      ) {
        let pts =
          i < 0 && n[c]
            ? n[c].points.map((e) => ({
                lat: e.lat,
                lon: e.lon,
                w: 1,
                r: e,
              }))
            : e[c].readings.flatMap((e) => [
                {
                  lat: e.lat,
                  lon: e.lon,
                  w: 1,
                  r: e,
                },
                ...(e.alternatives || []).map((e) => ({
                  lat: e.lat,
                  lon: e.lon,
                  w: 0.4,
                })),
              ]);
        pts.length &&
          s.push({
            j: c,
            tol: toleranceMeters(e[c].t - r.t),
            pts: pts,
          });
      }
      return s;
    },
    a = i(-1, 2, 4),
    o = i(1, 2, 4),
    s = new Set([...a, ...o].map((e) => e.j));
  !a.length && o.length && (o = i(1, 4, 8));
  !o.length && a.length && (a = i(-1, 4, 8));
  let c = [...a, ...o],
    l = (e, t) =>
      t.reduce((t, n) => {
        let r = 0;
        for (let t of n.pts)
          t.w > r &&
            haversineDistance(t.lat, t.lon, e.lat, e.lon) <= n.tol &&
            (r = t.w);
        return t + r;
      }, 0),
    u = (e) => l(e, c),
    d = (e) =>
      l(
        e,
        c.filter((e) => s.has(e.j)),
      ),
    f = c
      .map((e) => ({
        ...e,
        pts: e.pts.filter((e) => e.w >= 1),
      }))
      .filter((e) => e.pts.length),
    p = [];
  for (let t of f)
    for (let n of t.pts)
      f.some(
        (r) =>
          r !== t &&
          r.pts.some(
            (i) =>
              haversineDistance(n.lat, n.lon, i.lat, i.lon) <=
              toleranceMeters(e[t.j].t - e[r.j].t),
          ),
      ) &&
        p.push({
          p: n,
          tol: t.tol,
        });
  let m = p.length > 0,
    h = f.flatMap((e) => e.pts.map((e) => e.r).filter(Boolean)),
    g = commonDecimals(h, "latText"),
    _ = commonDecimals(h, "lonText"),
    oneSided = c.length > 0 && (!a.length || !o.length),
    y = r.twin || [],
    b = (e) =>
      y.some(
        (t) => haversineDistance(t.lat, t.lon, e.lat, e.lon) <= MAX_SPEED_MS,
      ),
    x = () =>
      y.map((e) => ({
        lat: e.lat,
        lon: e.lon,
        cost: 0.9,
        atypical: 0,
        kind: "twin",
      })),
    points = [],
    fixed = [],
    rejected = [],
    w = (e, t) => {
      let n = {
        ...e,
        lat: t.lat,
        lon: t.lon,
        alternatives: [],
        fix: {
          kind: t.kind,
          from: {
            lat: e.lat,
            lon: e.lon,
          },
          support: t.support,
        },
      };
      delete n.latText;
      delete n.lonText;
      points.push(n);
      fixed.push(n);
    },
    T = (e, t) => {
      let n = null;
      for (let r of e?.pts || [])
        r.w >= 1 &&
          (!n ||
            haversineDistance(r.lat, r.lon, t.lat, t.lon) <
              haversineDistance(n.lat, n.lon, t.lat, t.lon)) &&
          (n = r);
      return n;
    },
    E = (t) => {
      let n = T(a[0], t),
        i = T(o[0], t);
      if (n && i) {
        let t = e[a[0].j].t,
          s = e[o[0].j].t,
          c = s === t ? 0.5 : (r.t - t) / (s - t);
        return {
          predicted: {
            lat: n.lat + (i.lat - n.lat) * c,
            lon: n.lon + (i.lon - n.lon) * c,
          },
          span: haversineDistance(n.lat, n.lon, i.lat, i.lon),
          twoSided: true,
        };
      }
      let s = a.length ? a : o,
        c = T(s[0], t),
        l = c && T(s[1], c);
      return c && l
        ? {
            predicted: {
              lat: c.lat,
              lon: c.lon,
            },
            span: haversineDistance(c.lat, c.lon, l.lat, l.lon),
          }
        : null;
    },
    D = (e, t) => {
      let n = E(t);
      if (!n) return null;
      let { predicted, span } = n,
        a = 2 * span + 25,
        deviation = haversineDistance(
          t.lat,
          t.lon,
          predicted.lat,
          predicted.lon,
        ),
        // Feinprüfung für langsame, kleine Flüge: Der Punkt liegt deutlich neben der
        // Linie zwischen seinen beiden Nachbarn, und eine einzige typische
        // Ziffernverwechslung (z. B. 8 statt 0) brächte ihn genau dorthin.
        fine = false;
      if (deviation <= a + 10) {
        if (!n.twoSided || deviation <= span + FINE_MIN_DEVIATION_M)
          return null;
        fine = true;
        a = Math.max(FINE_WINDOW_M, 0.5 * span);
      }
      let o = Math.max(0.05, Math.cos((e.lat * Math.PI) / 180)),
        s = a / METERS_PER_DEG,
        c = a / (METERS_PER_DEG * o),
        l = (e, t, n) => Math.abs(e - t) <= n,
        f = l(e.lat, predicted.lat, s)
          ? [
              {
                value: e.lat,
                cost: 0,
                atypical: 0,
              },
            ]
          : digitVariants(
              coordText(e.lat, e.latText),
              predicted.lat - s,
              predicted.lat + s,
              signOf(e.lat),
              g,
            ),
        p = l(e.lon, predicted.lon, c)
          ? [
              {
                value: e.lon,
                cost: 0,
                atypical: 0,
              },
            ]
          : digitVariants(
              coordText(e.lon, e.lonText),
              predicted.lon - c,
              predicted.lon + c,
              signOf(e.lon),
              _,
            ),
        m = null;
      for (let e of f)
        for (let t of p) {
          let cost = e.cost + t.cost;
          if (
            cost === 0 ||
            cost > (fine ? 0.5 : 1) ||
            (e.atypical || 0) + (t.atypical || 0) > 0
          )
            continue;
          let i = {
            lat: e.value,
            lon: t.value,
            cost: cost,
            kind: "fix",
          };
          if (((i.close = d(i)), (i.support = u(i)), i.close < 1)) continue;
          let a = haversineDistance(i.lat, i.lon, predicted.lat, predicted.lon);
          if (fine && a > deviation / 8) continue;
          (!m || a < m.d) &&
            (m = {
              ...i,
              d: a,
            });
        }
      return m;
    };
  for (let e of r.readings) {
    if (!c.length) {
      points.push(e);
      continue;
    }
    if (
      (g !== null && decimalPlaces(e.latText) > g) ||
      (_ !== null && decimalPlaces(e.lonText) > _)
    ) {
      let t = x()
        .map((e) => ({
          ...e,
          support: u(e),
          close: d(e),
        }))
        .filter((e) => e.support >= MIN_SUPPORT && e.close >= 1)
        .sort((e, t) => t.support - e.support)[0];
      t ? w(e, t) : rejected.push(e);
      continue;
    }
    let t = {
      lat: e.lat,
      lon: e.lon,
      cost: 0,
      kind: "raw",
    };
    t.support = u(t);
    t.close = d(t);
    let n = [];
    for (let t of e.alternatives || [])
      n.push({
        lat: t.lat,
        lon: t.lon,
        cost: 0.3,
        atypical: 0,
        kind: "alt",
      });
    if ((oneSided && n.push(...x()), t.support < MIN_SUPPORT && p.length)) {
      let t = Math.max(0.05, Math.cos((e.lat * Math.PI) / 180)),
        r = coordText(e.lat, e.latText),
        i = coordText(e.lon, e.lonText),
        a = new Set();
      for (let { p: o, tol } of p) {
        let c = tol / METERS_PER_DEG,
          l = tol / (METERS_PER_DEG * t),
          u = Math.abs(e.lat - o.lat) <= c,
          d = Math.abs(e.lon - o.lon) <= l,
          f = u
            ? [
                {
                  value: e.lat,
                  cost: 0,
                },
              ]
            : digitVariants(r, o.lat - c, o.lat + c, signOf(e.lat), g).slice(
                0,
                6,
              ),
          p = d
            ? [
                {
                  value: e.lon,
                  cost: 0,
                },
              ]
            : digitVariants(i, o.lon - l, o.lon + l, signOf(e.lon), _).slice(
                0,
                6,
              );
        for (let e of f)
          for (let t of p) {
            let cost = e.cost + t.cost,
              i = `${e.value},${t.value}`;
            cost === 0 ||
              cost > SPEED_FACTOR ||
              a.has(i) ||
              (a.add(i),
              n.push({
                lat: e.value,
                lon: t.value,
                cost: cost,
                atypical: (e.atypical || 0) + (t.atypical || 0),
                kind: "fix",
              }));
          }
      }
    }
    for (let e of n) ((e.support = u(e)), (e.close = d(e)));
    let r = (e) => (e.cost > 1 ? 3 : MIN_SUPPORT),
      i = n
        .filter((e) => e.support >= r(e) && e.close >= 1)
        .sort((e, t) => t.support - e.support || e.cost - t.cost)[0],
      a = t.close >= 1;
    if (a) {
      let n = D(e, t);
      if (n) {
        w(e, n);
        continue;
      }
    }
    let o = b(t),
      s = y.length > 0 && !o;
    (
      oneSided
        ? i && !a && (i.atypical === 0 || s)
        : i && (!a || i.support >= t.support + 2)
    )
      ? w(e, i)
      : a
        ? points.push({
            ...e,
            trackSupport: t.support,
            ...(t.support >= MIN_SUPPORT
              ? {
                  alternatives: [],
                }
              : {}),
          })
        : m
          ? oneSided && o
            ? points.push({
                ...e,
                jump: true,
              })
            : rejected.push(e)
          : points.push(e);
  }
  return {
    points: points,
    fixed: fixed,
    rejected: rejected,
    oneSided: oneSided,
  };
}

export function judgeAgainstRoute(e, t, { far = 5e3, near = 1e3 } = {}) {
  if (!t || !t.length) return null;
  let i = (e, n) =>
      Math.min(...t.map((t) => haversineDistance(t.lat, t.lon, e, n))),
    off = i(e.lat, e.lon);
  if (off <= far) return null;
  let o = Math.max(0.05, Math.cos((e.lat * Math.PI) / 180)),
    s = near / METERS_PER_DEG,
    c = near / (METERS_PER_DEG * o),
    l = Math.min(...t.map((e) => e.lat)) - s,
    u = Math.max(...t.map((e) => e.lat)) + s,
    d = Math.min(...t.map((e) => e.lon)) - c,
    f = Math.max(...t.map((e) => e.lon)) + c,
    p = e.lat >= l && e.lat <= u,
    m = e.lon >= d && e.lon <= f,
    h = p
      ? [
          {
            value: e.lat,
            cost: 0,
          },
        ]
      : digitVariants(coordText(e.lat, e.latText), l, u, signOf(e.lat)).slice(
          0,
          12,
        ),
    g = m
      ? [
          {
            value: e.lon,
            cost: 0,
          },
        ]
      : digitVariants(coordText(e.lon, e.lonText), d, f, signOf(e.lon)).slice(
          0,
          12,
        ),
    _ = null;
  for (let e of h)
    for (let t of g) {
      let cost = e.cost + t.cost;
      if (cost === 0 || cost > 2) continue;
      let distance = i(e.value, t.value);
      distance > near ||
        ((!_ || cost < _.cost || (cost === _.cost && distance < _.distance)) &&
          (_ = {
            lat: e.value,
            lon: t.value,
            cost: cost,
            distance: distance,
            off: off,
          }));
    }
  return _;
}

export function createTrackFilter({ twins = false } = {}) {
  let t = [],
    n = [],
    r = [],
    i = 0,
    a = (e) => {
      for (let t = e - 1; t >= 0 && e - t <= 4; t--)
        if (n[t]?.points.length) return true;
      return false;
    },
    o = (e) => {
      let n = !a(e),
        r = n ? 4 : 2,
        i = n ? 8 : 4,
        o = 0;
      for (let n = e + 1; n < t.length && n - e <= i; n++)
        hasReadings(t[n]) && (o += 1);
      return o >= r || t.length - 1 - e >= i;
    },
    s = (a, s = true) => {
      let c = [];
      for (; i < t.length && (a || o(i));) {
        let a = t[i],
          o = checkAgainstTrack(t, i, n);
        if (
          twins &&
          s &&
          a.twin === undefined &&
          o.oneSided &&
          o.rejected.length > 0
        ) {
          r.some((e) => e.index === i) ||
            r.push({
              index: i,
              t: a.t,
            });
          break;
        }
        n[i] = o;
        c.push({
          index: i,
          t: a.t,
          meta: a.meta,
          ...o,
        });
        i += 1;
      }
      return c;
    };
  return {
    push(e, readings, meta) {
      t.push({
        t: e,
        readings: readings,
        meta: meta,
      });
      return s(false);
    },
    flush: ({ ask = true } = {}) => s(true, ask),
    requests: () => r.splice(0),
    twin(e, n, r = false) {
      t[e] && t[e].twin === undefined && (t[e].twin = n);
      return s(r);
    },
  };
}
