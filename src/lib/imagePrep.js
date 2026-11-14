// Bereitet Bilder für die Texterkennung vor: Skalierung, Kontrast, Schwellwerte, Schräglage.
const TARGET_LONG_SIDE = 2e3;

const MAX_LONG_SIDE = 3200;

const MAX_UPSCALE = 4;

function borderColor(e) {
  let t = document.createElement("canvas");
  t.width = 8;
  t.height = 8;
  let n = t.getContext("2d", {
    willReadFrequently: true,
  });
  n.drawImage(e, 0, 0, 8, 8);
  let r = n.getImageData(0, 0, 8, 8).data,
    i = 0,
    a = 0,
    o = 0,
    s = 0;
  for (let e = 0; e < 64; e++) {
    let t = e % 8,
      n = (e / 8) | 0;
    (t === 0 || t === 7 || n === 0 || n === 7) &&
      ((i += r[e * 4]), (a += r[e * 4 + 1]), (o += r[e * 4 + 2]), s++);
  }
  return `rgb(${Math.round(i / s)},${Math.round(a / s)},${Math.round(o / s)})`;
}

export async function loadBitmap(e) {
  try {
    return await createImageBitmap(e, {
      imageOrientation: "from-image",
    });
  } catch {
    throw Error(
      "Dieses Bildformat kann der Browser nicht lesen (z. B. HEIC). Bitte als JPEG oder PNG speichern.",
    );
  }
}

function otsuThreshold(e, t) {
  let n = 0;
  for (let t = 0; t < 256; t++) n += t * e[t];
  let r = 0,
    i = 0,
    a = -1,
    o = 127;
  for (let s = 0; s < 256; s++) {
    if (((i += e[s]), !i)) continue;
    let c = t - i;
    if (!c) break;
    r += s * e[s];
    let l = r / i,
      u = (n - r) / c,
      d = i * c * (l - u) * (l - u);
    d > a && ((a = d), (o = s));
  }
  return o;
}

function otsuThresholds3(e, t) {
  let n = new Float64Array(257),
    r = new Float64Array(257);
  for (let t = 0; t < 256; t++)
    ((n[t + 1] = n[t] + e[t]), (r[t + 1] = r[t] + t * e[t]));
  let i = r[256] / t,
    a = -1,
    o = 85,
    s = 170;
  for (let e = 1; e < 255; e++)
    for (let c = e + 1; c < 256; c++) {
      let l = n[e],
        u = n[c] - n[e],
        d = t - n[c];
      if (!l || !u || !d) continue;
      let f = r[e] / l,
        p = (r[c] - r[e]) / u,
        m = (r[256] - r[c]) / d,
        h = l * (f - i) ** 2 + u * (p - i) ** 2 + d * (m - i) ** 2;
      h > a && ((a = h), (o = e), (s = c));
    }
  return [o, s];
}

function histogramPercentile(e, t, n) {
  let r = 0,
    i = t * n;
  for (let t = 0; t < 256; t++) if (((r += e[t]), r >= i)) return t;
  return 255;
}

function boxBlur3(e, t, n) {
  let r = new Uint8ClampedArray(e.length),
    i = new Uint8ClampedArray(e.length);
  for (let i = 0; i < n; i++) {
    let n = i * t;
    for (let i = 0; i < t; i++) {
      let a = e[n + Math.max(0, i - 1)],
        o = e[n + i],
        s = e[n + Math.min(t - 1, i + 1)];
      r[n + i] = (a + o + s) / 3;
    }
  }
  for (let e = 0; e < n; e++) {
    let a = Math.max(0, e - 1) * t,
      o = e * t,
      s = Math.min(n - 1, e + 1) * t;
    for (let e = 0; e < t; e++) i[o + e] = (r[a + e] + r[o + e] + r[s + e]) / 3;
  }
  return i;
}

function adaptiveBinarize(e, t, n, r) {
  let i = boxBlur3(e, t, n),
    a = new Uint32Array(256);
  for (let e = 0; e < i.length; e++) a[i[e]]++;
  let o = histogramPercentile(a, i.length, 0.5),
    s = 0,
    c = 0;
  for (let e = 0; e < i.length; e++) i[e] > o + 40 ? s++ : i[e] < o - 40 && c++;
  let l = r ? s <= c : s > c,
    u = t + 1,
    d = new Uint32Array(u * (n + 1));
  for (let e = 0; e < n; e++) {
    let n = 0;
    for (let r = 0; r < t; r++)
      ((n += i[e * t + r]),
        (d[(e + 1) * u + (r + 1)] = d[e * u + (r + 1)] + n));
  }
  let f = Math.max(8, Math.floor(Math.min(t, n) / 40)),
    p = new Uint8ClampedArray(t * n).fill(255);
  for (let e = 0; e < n; e++) {
    let r = Math.max(0, e - f),
      a = Math.min(n - 1, e + f);
    for (let n = 0; n < t; n++) {
      let o = Math.max(0, n - f),
        s = Math.min(t - 1, n + f),
        c = (s - o + 1) * (a - r + 1),
        m =
          (d[(a + 1) * u + (s + 1)] -
            d[r * u + (s + 1)] -
            d[(a + 1) * u + o] +
            d[r * u + o]) /
          c,
        h = i[e * t + n];
      (l ? h > m + 10 : h < m - 10) && (p[e * t + n] = 0);
    }
  }
  return p;
}

function otsuBinarize(e, t, n) {
  let r = boxBlur3(e, t, n),
    i = new Uint32Array(256);
  for (let e = 0; e < r.length; e++) i[r[e]]++;
  let a = otsuThreshold(i, r.length),
    o = 0;
  for (let e = 0; e < r.length; e++) r[e] > a && o++;
  let s = o < r.length - o,
    c = new Uint8ClampedArray(r.length).fill(255);
  for (let e = 0; e < r.length; e++) (s ? r[e] > a : r[e] <= a) && (c[e] = 0);
  return c;
}

function otsu3Binarize(e, t, n) {
  let r = boxBlur3(e, t, n),
    i = new Uint32Array(256);
  for (let e = 0; e < r.length; e++) i[r[e]]++;
  let [a, o] = otsuThresholds3(i, r.length),
    s = 0,
    c = 0;
  for (let e = 0; e < r.length; e++) r[e] < a ? s++ : r[e] >= o && c++;
  let l = c <= s,
    u = new Uint8ClampedArray(r.length).fill(255);
  for (let e = 0; e < r.length; e++) (l ? r[e] >= o : r[e] < a) && (u[e] = 0);
  return u;
}

const MAX_SKEW_DEG = 10;

const MIN_SKEW_DEG = 0.75;

const SKEW_GAIN = 1.12;

export function estimateSkew(e) {
  let t = Math.max(e.width, e.height),
    n = Math.min(1, 900 / t),
    r = Math.max(1, Math.round(e.width * n)),
    i = Math.max(1, Math.round(e.height * n)),
    a = document.createElement("canvas");
  a.width = r;
  a.height = i;
  let o = a.getContext("2d", {
    willReadFrequently: true,
  });
  o.imageSmoothingQuality = "high";
  o.fillStyle = "#ffffff";
  o.fillRect(0, 0, r, i);
  o.drawImage(e, 0, 0, r, i);
  let s = o.getImageData(0, 0, r, i).data,
    c = r * i,
    l = new Uint8ClampedArray(c),
    u = new Uint32Array(256);
  for (let e = 0, t = 0; e < s.length; e += 4, t++)
    ((l[t] = (s[e] * 299 + s[e + 1] * 587 + s[e + 2] * 114) / 1e3), u[l[t]]++);
  let d = otsuThreshold(u, c),
    f = 0;
  for (let e = 0; e < c; e++) l[e] > d && f++;
  let p = f < c - f,
    m = 0;
  for (let e = 0; e < c; e++) (p ? l[e] > d : l[e] <= d) && m++;
  if (m < 200) return 0;
  let h = Math.max(1, Math.ceil(m / 6e4)),
    g = [],
    _ = [],
    v = 0;
  for (let e = 0; e < c; e++)
    (p ? l[e] <= d : l[e] > d) ||
      (v++ % h === 0 && (g.push(e % r), _.push((e / r) | 0)));
  let y = new Uint32Array(i + 2 * r + 4),
    b = (e) => {
      let t = (e * Math.PI) / 180,
        n = Math.cos(t),
        i = Math.sin(t);
      y.fill(0);
      for (let e = 0; e < g.length; e++)
        y[Math.round(_[e] * n - g[e] * i + r)]++;
      let a = 0;
      for (let e = 0; e < y.length; e++) a += y[e] * y[e];
      return a;
    },
    x = b(0),
    S = 0,
    ee = x;
  for (let e = -10; e <= MAX_SKEW_DEG; e += 1) {
    let t = b(e);
    t > ee && ((ee = t), (S = e));
  }
  for (let e = S - 0.75; e <= S + 0.75; e += 0.25) {
    let t = b(e);
    t > ee && ((ee = t), (S = e));
  }
  return Math.abs(S) < MIN_SKEW_DEG || ee < x * SKEW_GAIN ? 0 : S;
}

export function renderVariant(e, t, n = 0) {
  let r = Math.max(e.width, e.height),
    i = 1;
  r < TARGET_LONG_SIDE
    ? (i = Math.min(MAX_UPSCALE, TARGET_LONG_SIDE / r))
    : r > MAX_LONG_SIDE && (i = MAX_LONG_SIDE / r);
  let a = e.width * i,
    o = e.height * i,
    s = (n * Math.PI) / 180,
    c = Math.abs(Math.cos(s)),
    l = Math.abs(Math.sin(s)),
    u = document.createElement("canvas");
  u.width = Math.max(1, Math.round(n ? a * c + o * l : a));
  u.height = Math.max(1, Math.round(n ? a * l + o * c : o));
  let d = u.getContext("2d", {
    willReadFrequently: true,
  });
  d.imageSmoothingEnabled = true;
  d.imageSmoothingQuality = "high";
  d.fillStyle = n ? borderColor(e) : "#ffffff";
  d.fillRect(0, 0, u.width, u.height);
  n
    ? (d.translate(u.width / 2, u.height / 2),
      d.rotate(-s),
      d.drawImage(e, -a / 2, -o / 2, a, o),
      d.setTransform(1, 0, 0, 1, 0, 0))
    : d.drawImage(e, 0, 0, u.width, u.height);
  let f = d.getImageData(0, 0, u.width, u.height),
    p = f.data,
    { width, height } = u,
    g = width * height,
    _ = new Uint8ClampedArray(g),
    v = new Uint32Array(256);
  for (let e = 0, t = 0; e < p.length; e += 4, t++) {
    let n = (p[e] * 299 + p[e + 1] * 587 + p[e + 2] * 114) / 1e3;
    _[t] = n;
    v[_[t]]++;
  }
  let y = histogramPercentile(v, g, 2e-4),
    b = Math.max(y + 1, histogramPercentile(v, g, 0.9998)) - y,
    x = new Uint8ClampedArray(g);
  for (let e = 0; e < g; e++) x[e] = ((_[e] - y) * 255) / b;
  let S = x;
  t === "inverted"
    ? (S = x.map((e) => 255 - e))
    : t === "otsu"
      ? (S = otsuBinarize(x, width, height))
      : t === "otsu3"
        ? (S = otsu3Binarize(x, width, height))
        : t === "adaptive"
          ? (S = adaptiveBinarize(x, width, height, false))
          : t === "adaptive-flip" &&
            (S = adaptiveBinarize(x, width, height, true));
  for (let e = 0, t = 0; e < p.length; e += 4, t++)
    ((p[e] = p[e + 1] = p[e + 2] = S[t]), (p[e + 3] = 255));
  d.putImageData(f, 0, 0);
  return u;
}
