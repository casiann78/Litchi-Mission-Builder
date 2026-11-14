// Liest Koordinaten, Höhe und Kurs aus erkanntem Text (Dezimalgrad, Grad/Minuten/Sekunden, mit und ohne Beschriftung).
const isNum = (e) => typeof e == "number" && Number.isFinite(e);

const isValidLat = (e) => isNum(e) && e >= -90 && e <= 90;

const isValidLon = (e) => isNum(e) && e >= -180 && e <= 180;

const parseDecimal = (e) => parseFloat(String(e).replace(",", "."));

const stripSign = (e) => String(e).replace(",", ".").replace(/^[+-]/, "");

function normalizeLine(e) {
  let t = String(e)
    .replace(/[   \t]/g, " ")
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″“”]/g, '"')
    .replace(/[−‒–—]/g, "-")
    .replace(/[º˚⁰]/g, "°");
  t = t.replace(/[\dOoIlSB@][\dOoIlSB.,@]{2,}[\dOoIlSB@]/g, (e) =>
    (e.match(/\d/g) || []).length < 2 || !/[.,]/.test(e)
      ? e
      : e
          .replace(/[Oo@]/g, "0")
          .replace(/[Il]/g, "1")
          .replace(/S/g, "5")
          .replace(/B/g, "8"),
  );
  t = t.replace(/@(?=\d)/g, "0");
  t = t.replace(/(\d)\s*\.\s*(\d)/g, "$1.$2");
  t = t.replace(/(\d),(\d{3,})(?![\d.])/g, "$1.$2");
  t = t.replace(/(\d)\s*[o*]\s*(?=\d{1,2}(?:\.\d+)?\s*')/g, "$1°");
  return t.replace(/[ ]{2,}/g, " ").trim();
}

const HEMI = "[NSEWnsew]";

const DECIMAL = "-?\\d{1,3}\\.\\d{2,}";

const DMS_BODY = String.raw`([+-])?(\d{1,3})\s*°\s*(\d{1,2}(?:\.\d+)?)\s*(?:'\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|'')?)?)?`;

const DMS_PREFIX_RE = new RegExp(
  String.raw`(?<![A-Za-z])(${HEMI})?\s*${DMS_BODY}(?![A-Za-z])`,
  "g",
);

const DMS_SUFFIX_RE = new RegExp(
  String.raw`${DMS_BODY}\s*(${HEMI})?(?![A-Za-z])`,
  "g",
);

function pickDmsPattern(e) {
  let t = e.search(/\d{1,3}\s*°/),
    n = e.search(/(?<![A-Za-z])[NSEWnsew](?![A-Za-z])/);
  return t >= 0 && n >= 0 && n < t
    ? {
        re: DMS_PREFIX_RE,
        prefix: true,
      }
    : {
        re: DMS_SUFFIX_RE,
        prefix: false,
      };
}

const DEC_HEMI_PAIR_RE = RegExp(
  `(?<![\\d.])(${DECIMAL})\\s*°?\\s*(${HEMI})\\b[\\s,;/|]*(${DECIMAL})\\s*°?\\s*(${HEMI})\\b`,
  "g",
);

const HEMI_DEC_PAIR_RE = RegExp(
  `\\b(${HEMI})\\s*[:=]?\\s*(${DECIMAL})\\s*°?[\\s,;/|]*\\b(${HEMI})\\s*[:=]?\\s*(${DECIMAL})(?![\\d.])`,
  "g",
);

const HEMI_DEC_RE = RegExp(
  `\\b(${HEMI})\\s*[:=]?\\s*(${DECIMAL})\\s*°?(?![\\d.])`,
  "g",
);

const DEC_HEMI_RE = RegExp(
  `(?<![\\d.])(${DECIMAL})\\s*°?\\s*(${HEMI})\\b`,
  "g",
);

const LAT_LABEL = "(?:lat(?:itude)?|breite(?:ngrad)?)";

const LON_LABEL = "(?:lon(?:g|gitude)?|lng|l[aä]nge(?:ngrad)?|laengengrad)";

const LABELED_PAIR_TAIL =
  "\\.?\\s*[:=]?\\s*(-?\\d{1,3}\\.\\d{2,})(?![\\d.])[\\s,;/|]+(-?\\d{1,3}\\.\\d{2,})(?![\\d.])";

const LAT_LON_LABELED_RE = RegExp(
  `\\b${LAT_LABEL}\\s*[/,|&+-]?\\s*${LON_LABEL}\\b${LABELED_PAIR_TAIL}`,
  "gi",
);

const LON_LAT_LABELED_RE = RegExp(
  `\\b${LON_LABEL}\\s*[/,|&+-]?\\s*${LAT_LABEL}\\b${LABELED_PAIR_TAIL}`,
  "gi",
);

const LAT_RE =
  /\b(?:lat(?:itude)?|breite(?:ngrad)?)\b\.?\s*[:=]?\s*(-?\d{1,3}\.\d{2,})/gi;

const LON_RE =
  /\b(?:lon(?:g|gitude)?|lng|l[aä]nge|l[aä]ngengrad|laengengrad)\b\.?\s*[:=]?\s*(-?\d{1,3}\.\d{2,})/gi;

const PLAIN_PAIR_RE =
  /(?<![\d.])(-?\d{1,3}\.\d{4,})(?![\d.])[\s,;/|]+(-?\d{1,3}\.\d{4,})(?![\d.])/g;

const PLAIN_DECIMAL_RE = /(?<![\d.])(-?\d{1,3}\.\d{4,})(?![\d.])/g;

const ALTITUDE_RE =
  /\b(?:alt(?:itude)?|h[oö]he|hgt|height|elev(?:ation)?)\b\.?\s*[:=]?\s*(-?\d{1,4}(?:[.,]\d+)?)\s*(m|ft)?\b/gi;

const H_ALTITUDE_RE = /\bH\s*[:=]?\s*(-?\d{1,4}(?:[.,]\d+)?)\s*(m|ft)\b/g;

const HEADING_RE =
  /\b(?:hdg|heading|yaw|kurs|course)\b\.?\s*[:=]?\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?/gi;

function hemiAxis(e) {
  let t = e.toUpperCase();
  return t === "N" || t === "S" ? "lat" : "lon";
}

const hemiSign = (e) => (/[SW]/i.test(e) ? -1 : 1);

export function parseCoordinates(e) {
  let t = String(e ?? "")
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter((e) => e !== ""),
    n = t.slice(),
    r = t.map(() => []),
    i = [],
    a = [],
    o = (e, t, i) => {
      n[e] = n[e].slice(0, t) + " ".repeat(i - t) + n[e].slice(i);
      r[e].push([t, i]);
    },
    s = (e, t) => {
      for (let r = 0; r < n.length; r++) {
        let i = [...n[r].matchAll(e)];
        for (let e of i) t(e, r);
      }
    };
  for (let line = 0; line < n.length; line++) {
    let { re: t, prefix } = pickDmsPattern(n[line]);
    for (let a of [...n[line].matchAll(t)]) {
      let t = a[0],
        n = prefix ? a[1] : undefined,
        [s, c, l, u] = prefix
          ? [a[2], a[3], a[4], a[5]]
          : [a[1], a[2], a[3], a[4]],
        d = prefix ? undefined : a[5],
        f = Number(c),
        p = parseDecimal(l),
        m = u === undefined ? 0 : parseDecimal(u);
      if (!(p < 60) || !(m < 60)) continue;
      let h = n || d,
        g = f + p / 60 + m / 3600;
      s === "-" && (g = -g);
      h && (g *= hemiSign(h));
      let kind = h ? hemiAxis(h) : null;
      (kind !== "lat" || isValidLat(g)) &&
        (kind !== "lon" || isValidLon(g)) &&
        ((!h && f > 180) ||
          (i.push({
            kind: kind,
            value: g,
            line: line,
            col: a.index,
            text: t.trim(),
          }),
          o(line, a.index, a.index + t.length)));
    }
  }
  let c = (line, t, n, r, i, s) => {
    let c = hemiAxis(r);
    if (c === hemiAxis(s)) return false;
    let l = parseDecimal(n) * hemiSign(r),
      u = parseDecimal(i) * hemiSign(s),
      d = c === "lat" ? l : u,
      f = c === "lon" ? l : u;
    if (!isValidLat(d) || !isValidLon(f)) return false;
    let latText = stripSign(c === "lat" ? n : i),
      lonText = stripSign(c === "lon" ? n : i);
    a.push({
      lat: d,
      lon: f,
      latText: latText,
      lonText: lonText,
      line: line,
      col: t.index,
      text: t[0].trim(),
    });
    o(line, t.index, t.index + t[0].length);
    return true;
  };
  s(DEC_HEMI_PAIR_RE, (e, t) => c(t, e, e[1], e[2], e[3], e[4]));
  s(HEMI_DEC_PAIR_RE, (e, t) => c(t, e, e[2], e[1], e[4], e[3]));
  s(HEMI_DEC_RE, (e, line) => {
    let kind = hemiAxis(e[1]),
      r = parseDecimal(e[2]) * hemiSign(e[1]);
    (kind === "lat" ? !isValidLat(r) : !isValidLon(r)) ||
      (i.push({
        kind: kind,
        value: r,
        num: stripSign(e[2]),
        line: line,
        col: e.index,
        text: e[0].trim(),
      }),
      o(line, e.index, e.index + e[0].length));
  });
  s(DEC_HEMI_RE, (e, line) => {
    let kind = hemiAxis(e[2]),
      r = parseDecimal(e[1]) * hemiSign(e[2]);
    (kind === "lat" ? !isValidLat(r) : !isValidLon(r)) ||
      (i.push({
        kind: kind,
        value: r,
        num: stripSign(e[1]),
        line: line,
        col: e.index,
        text: e[0].trim(),
      }),
      o(line, e.index, e.index + e[0].length));
  });
  let l = (line, t, n) => {
    let [r, i] = n ? [t[1], t[2]] : [t[2], t[1]],
      s = parseDecimal(r),
      c = parseDecimal(i);
    isValidLat(s) &&
      isValidLon(c) &&
      (a.push({
        lat: s,
        lon: c,
        latText: stripSign(r),
        lonText: stripSign(i),
        line: line,
        col: t.index,
        text: t[0].trim(),
      }),
      o(line, t.index, t.index + t[0].length));
  };
  s(LAT_LON_LABELED_RE, (e, t) => l(t, e, true));
  s(LON_LAT_LABELED_RE, (e, t) => l(t, e, false));
  s(LAT_RE, (e, line) => {
    let n = parseDecimal(e[1]);
    isValidLat(n) &&
      (i.push({
        kind: "lat",
        value: n,
        num: stripSign(e[1]),
        line: line,
        col: e.index,
        text: e[0].trim(),
      }),
      o(line, e.index, e.index + e[0].length));
  });
  s(LON_RE, (e, line) => {
    let n = parseDecimal(e[1]);
    isValidLon(n) &&
      (i.push({
        kind: "lon",
        value: n,
        num: stripSign(e[1]),
        line: line,
        col: e.index,
        text: e[0].trim(),
      }),
      o(line, e.index, e.index + e[0].length));
  });
  s(PLAIN_PAIR_RE, (e, line) => {
    let n = parseDecimal(e[1]),
      r = parseDecimal(e[2]),
      i = n,
      s = r,
      latText = stripSign(e[1]),
      lonText = stripSign(e[2]);
    !isValidLat(n) &&
      isValidLat(r) &&
      isValidLon(n) &&
      ((i = r), (s = n), ([latText, lonText] = [lonText, latText]));
    isValidLat(i) &&
      isValidLon(s) &&
      (a.push({
        lat: i,
        lon: s,
        latText: latText,
        lonText: lonText,
        line: line,
        col: e.index,
        text: e[0].trim(),
      }),
      o(line, e.index, e.index + e[0].length));
  });
  let u = [],
    d = new Set();
  s(PLAIN_DECIMAL_RE, (e, line) => {
    u.push({
      value: parseDecimal(e[1]),
      num: stripSign(e[1]),
      line: line,
      col: e.index,
      text: e[0],
      len: e[0].length,
    });
  });
  for (let e = 0; e + 1 < u.length; e++) {
    let t = u[e],
      n = u[e + 1];
    n.line - t.line === 1 &&
      isValidLat(t.value) &&
      isValidLon(n.value) &&
      (a.push({
        lat: t.value,
        lon: n.value,
        latText: t.num,
        lonText: n.num,
        line: t.line,
        endLine: n.line,
        col: t.col,
        text: `${t.text} / ${n.text}`,
      }),
      o(t.line, t.col, t.col + t.len),
      o(n.line, n.col, n.col + n.len),
      d.add(t),
      d.add(n),
      (e += 1));
  }
  let f = [...a],
    p = i
      .filter((e) => e.kind === "lat")
      .sort((e, t) => e.line - t.line || e.col - t.col),
    m = i.filter((e) => e.kind === "lon"),
    h = new Set(),
    g = new Set(),
    _ = (e, t) => Math.abs(e.line - t.line) * 1e3 + Math.abs(e.col - t.col),
    v = [];
  for (let e of p)
    for (let t of m)
      Math.abs(e.line - t.line) <= 2 &&
        v.push({
          lat: e,
          lon: t,
          c: _(e, t),
        });
  v.sort((e, t) => e.c - t.c);
  for (let { lat, lon } of v) {
    if (g.has(lat) || h.has(lon)) continue;
    h.add(lon);
    g.add(lat);
    let n =
        lat.line < lon.line || (lat.line === lon.line && lat.col <= lon.col)
          ? lat
          : lon,
      r = n === lat ? lon : lat;
    f.push({
      lat: lat.value,
      lon: lon.value,
      latText: lat.num,
      lonText: lon.num,
      line: n.line,
      endLine: r.line,
      col: n.col,
      text: n.line === r.line ? `${n.text} ${r.text}` : `${n.text} / ${r.text}`,
    });
  }
  let y = i
    .filter((e) => e.kind === null)
    .sort((e, t) => e.line - t.line || e.col - t.col);
  for (let e = 0; e + 1 < y.length; e++) {
    let t = y[e],
      n = y[e + 1];
    n.line - t.line > 1 ||
      !isValidLat(t.value) ||
      !isValidLon(n.value) ||
      (f.push({
        lat: t.value,
        lon: n.value,
        line: t.line,
        endLine: n.line,
        col: t.col,
        text:
          t.line === n.line ? `${t.text} ${n.text}` : `${t.text} / ${n.text}`,
      }),
      (e += 1));
  }
  let b = (e, t, n) => (n ? `${e.text} ${t.text}` : `${e.text} / ${t.text}`);
  for (let e of p) {
    if (g.has(e)) continue;
    let t = u.find(
      (t) =>
        !d.has(t) &&
        isValidLon(t.value) &&
        (t.line === e.line ? t.col > e.col : t.line === e.line + 1),
    );
    t &&
      (d.add(t),
      o(t.line, t.col, t.col + t.len),
      f.push({
        lat: e.value,
        lon: t.value,
        latText: e.num,
        lonText: t.num,
        line: e.line,
        endLine: t.line,
        col: e.col,
        text: b(e, t, e.line === t.line),
      }));
  }
  for (let e of m) {
    if (h.has(e)) continue;
    let t = u.find(
      (t) =>
        !d.has(t) &&
        isValidLat(t.value) &&
        (t.line === e.line ? t.col < e.col : t.line === e.line - 1),
    );
    t &&
      (d.add(t),
      o(t.line, t.col, t.col + t.len),
      f.push({
        lat: t.value,
        lon: e.value,
        latText: t.num,
        lonText: e.num,
        line: t.line,
        endLine: e.line,
        col: t.col,
        text: b(t, e, e.line === t.line),
      }));
  }
  f.sort((e, t) => e.line - t.line || e.col - t.col);
  let x = [],
    S = [];
  t.forEach((e, line) => {
    for (let n of e.matchAll(ALTITUDE_RE)) {
      let e = parseDecimal(n[1]) * (n[2]?.toLowerCase() === "ft" ? 0.3048 : 1);
      isNum(e) &&
        e >= -500 &&
        e <= 3e4 &&
        x.push({
          value: Math.round(e * 10) / 10,
          line: line,
          text: n[0],
        });
    }
    for (let n of e.matchAll(H_ALTITUDE_RE)) {
      let e = parseDecimal(n[1]) * (n[2].toLowerCase() === "ft" ? 0.3048 : 1);
      isNum(e) &&
        e >= -500 &&
        e <= 3e4 &&
        x.push({
          value: Math.round(e * 10) / 10,
          line: line,
          text: n[0],
        });
    }
    for (let n of e.matchAll(HEADING_RE)) {
      let e = parseDecimal(n[1]);
      isNum(e) &&
        e >= 0 &&
        e <= 360 &&
        S.push({
          value: e,
          line: line,
          text: n[0],
        });
    }
  });
  let ee = (e, t) => {
      let n = t.endLine ?? t.line;
      return e.line < t.line ? t.line - e.line : e.line > n ? e.line - n : 0;
    },
    C = (e) => {
      let t = new Map();
      for (let n of e) {
        let e = null,
          r = 1 / 0;
        for (let t of f) {
          let i = ee(n, t);
          i < r && ((r = i), (e = t));
        }
        if (!e || r > 3) continue;
        let i = t.get(e);
        (!i || r < i.d) &&
          t.set(e, {
            c: n,
            d: r,
          });
      }
      return t;
    },
    w = C(x),
    T = C(S),
    E = [];
  for (let e of f) {
    let n = w.get(e)?.c,
      i = T.get(e)?.c,
      a = t[e.line];
    for (let [t, n] of r[e.line].slice().sort((e, t) => t[0] - e[0]))
      a = a.slice(0, t) + " " + a.slice(n);
    for (let e of [n?.text, i?.text]) e && (a = a.replace(e, " "));
    a = a.replace(/[\s,;:/|()[\]"'°=-]+/g, " ").trim();
    let o = (a.match(/\p{L}/gu) || []).length;
    E.push({
      lat: e.lat,
      lon: e.lon,
      ...(e.latText && e.lonText
        ? {
            latText: e.latText,
            lonText: e.lonText,
          }
        : {}),
      altitude: n ? n.value : null,
      heading: i ? i.value : null,
      ...(o >= 3
        ? {
            label: a.slice(0, 60),
          }
        : {}),
      source: e.text,
    });
  }
  let D = [];
  for (let e of E) {
    if (e.lat === 0 && e.lon === 0) continue;
    let t = D.find(
      (t) => Math.abs(t.lat - e.lat) < 1e-5 && Math.abs(t.lon - e.lon) < 1e-5,
    );
    if (t) {
      t.altitude === null && (t.altitude = e.altitude);
      t.heading === null && (t.heading = e.heading);
      continue;
    }
    D.push(e);
  }
  return D;
}
