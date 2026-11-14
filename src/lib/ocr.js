// Texterkennung mit tesseract.js. Läuft vollständig im Browser, die Dateien liegen in public/ocr.
import { parseCoordinates } from "./parseCoordinates";
import { renderVariant, loadBitmap, estimateSkew } from "./imagePrep";

const ALL_VARIANTS = [
  "normal",
  "otsu",
  "otsu3",
  "inverted",
  "adaptive",
  "adaptive-flip",
];

const BINARY_VARIANTS = new Set(["otsu", "otsu3", "adaptive", "adaptive-flip"]);

export const FAST_VARIANTS = ["normal", "otsu", "otsu3", "inverted"];

const FAST_BUDGET_MS = 15e3;

const DEFAULT_BUDGET_MS = 45e3;

const MIN_TILE_SIDE = 1200;

const TILE_GRID = 3;

const TILE_VARIANTS = ["normal", "inverted"];

const PSM_SPARSE_TEXT = "11";

const PSM_AUTO = "3";

let workerPromise = null;

let progressListener = null;

async function getWorker() {
  workerPromise ||= (async () => {
    let e;
    try {
      e = await import("tesseract.js");
    } catch (e) {
      throw (
        typeof location < "u" &&
          !sessionStorage.getItem("litchi.reloadedForUpdate") &&
          (sessionStorage.setItem("litchi.reloadedForUpdate", "1"),
          location.reload()),
        e
      );
    }
    sessionStorage.removeItem("litchi.reloadedForUpdate");
    let { createWorker } = e,
      n = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        workerBlobURL: false,
        gzip: true,
        logger: (e) => progressListener?.(e),
      });
    await n.setParameters({
      tessedit_pageseg_mode: PSM_SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    return n;
  })().catch((e) => {
    throw ((workerPromise = null), e);
  });
  return workerPromise;
}

function withTimeout(e, t) {
  let n,
    r = new Promise((e, r) => {
      n = setTimeout(() => r(Error("timeout")), t);
    });
  return Promise.race([e, r]).finally(() => clearTimeout(n));
}

let ocrQueue = Promise.resolve();

function enqueueOcr(e) {
  let t = ocrQueue.then(e, e);
  ocrQueue = t.catch(() => {});
  return t;
}

function collectWords(e) {
  let t = [];
  for (let n of e.blocks || [])
    for (let e of n.paragraphs || [])
      for (let n of e.lines || []) for (let e of n.words || []) t.push(e);
  return t;
}

function readingConfidence(e, t) {
  let n = (e.match(/\d[\d.,]*\d/g) || []).map((e) =>
      e.replace(",", ".").slice(0, 6),
    ),
    r = t.filter((e) => /\d/.test(e.text)),
    i = r.filter((e) => {
      let t = e.text.replace(",", ".");
      return n.some((e) => t.includes(e));
    }),
    a = i.length ? i : r;
  return a.length
    ? Math.round(a.reduce((e, t) => e + (t.confidence ?? 0), 0) / a.length)
    : null;
}

function mergeReadings(e) {
  let t = e.filter((e) => e.length > 0);
  if (t.length === 0) return [];
  let n = (e, t) =>
      Math.abs(e.lat - t.lat) < 1e-6 && Math.abs(e.lon - t.lon) < 1e-6,
    r = [];
  if (t.every((e) => e.length === t[0].length))
    for (let e = 0; e < t[0].length; e++) r.push(t.map((t) => t[e]));
  else
    for (let e of t)
      for (let t of e) {
        let e = r.find((e) => e.some((e) => n(e, t)));
        e ? e.push(t) : r.push([t]);
      }
  let i = (e) =>
    e.reduce((e, t) => ((t.confidence ?? -1) > (e.confidence ?? -1) ? t : e));
  return r.map((e) => {
    let t = [];
    for (let r of e) {
      let e = t.find((e) => n(e[0], r));
      e ? e.push(r) : t.push([r]);
    }
    t.sort(
      (e, t) =>
        t.length - e.length ||
        (i(t).confidence ?? -1) - (i(e).confidence ?? -1),
    );
    let r = t[0],
      a = i(r);
    return {
      lat: a.lat,
      lon: a.lon,
      ...(a.latText
        ? {
            latText: a.latText,
            lonText: a.lonText,
          }
        : {}),
      altitude: r.find((e) => e.altitude !== null)?.altitude ?? null,
      heading: r.find((e) => e.heading !== null)?.heading ?? null,
      ...(a.label
        ? {
            label: a.label,
          }
        : {}),
      source: a.source,
      confidence: a.confidence,
      agreement: r.length,
      alternatives: t.slice(1).map((e) => ({
        lat: e[0].lat,
        lon: e[0].lon,
        ...(e[0].latText
          ? {
              latText: e[0].latText,
              lonText: e[0].lonText,
            }
          : {}),
        source: e[0].source,
        count: e.length,
      })),
      counts: t.map((e) => e.length),
    };
  });
}

function readingsAgree(e) {
  let t = mergeReadings(e);
  return (
    t.length !== 0 &&
    t.every((e) => e.counts[0] >= 2 && e.counts[0] > (e.counts[1] ?? 0))
  );
}

async function recognizeTiles(e, t, n, r, i, a, o) {
  let s = e.width,
    c = e.height,
    l = Math.round(s / 2),
    u = Math.round(c / 2),
    d = [];
  for (let e = 0; e < TILE_GRID; e++)
    for (let t = 0; t < TILE_GRID; t++)
      d.push([
        Math.round((t * (s - l)) / 2),
        Math.round((e * (c - u)) / 2),
        l,
        u,
      ]);
  let passes = d.length * o.length,
    p = await getWorker();
  await p.setParameters({
    tessedit_pageseg_mode: PSM_AUTO,
  });
  let m = false;
  try {
    for (let s = 0; s < o.length; s++) {
      let c = [];
      for (let l = 0; l < d.length; l++) {
        if (Date.now() - n > r)
          return {
            results: c,
            timedOut: true,
          };
        let pass = s * d.length + l + 1;
        progressListener = (e) => {
          e.status === "recognizing text" &&
            i({
              stage: "tiles",
              pass: pass,
              passes: passes,
              progress: e.progress ?? 0,
            });
        };
        i({
          stage: "tiles",
          pass: pass,
          passes: passes,
          progress: 0,
        });
        let h = await createImageBitmap(e, ...d[l]),
          g = renderVariant(h, o[s], t);
        h.close?.();
        let data;
        try {
          ({ data } = await withTimeout(
            p.recognize(
              g,
              {},
              {
                text: true,
                blocks: true,
              },
            ),
            FAST_BUDGET_MS,
          ));
        } catch (e) {
          let t = workerPromise;
          if (
            ((workerPromise = null),
            (m = true),
            t?.then((e) => e.terminate()).catch(() => {}),
            e?.message !== "timeout")
          )
            throw e;
          return {
            results: c,
            timedOut: true,
          };
        } finally {
          g.width = g.height = 0;
        }
        a.push(data.text || "");
        let v = collectWords(data);
        for (let e of parseCoordinates(data.text || ""))
          c.some(
            (t) =>
              Math.abs(t.lat - e.lat) < 1e-6 && Math.abs(t.lon - e.lon) < 1e-6,
          ) ||
            c.push({
              ...e,
              confidence: readingConfidence(e.source, v),
            });
      }
      if (c.length)
        return {
          results: c,
          timedOut: false,
        };
    }
    return {
      results: [],
      timedOut: false,
    };
  } finally {
    m ||
      (await p
        .setParameters({
          tessedit_pageseg_mode: PSM_SPARSE_TEXT,
        })
        .catch(() => {}));
  }
}

export function recognizeImage(
  e,
  t = () => {},
  {
    tiles = TILE_VARIANTS.length,
    budgetMs = DEFAULT_BUDGET_MS,
    variants = ALL_VARIANTS,
  } = {},
) {
  return enqueueOcr(async () => {
    t({
      stage: "prepare",
    });
    let a = await loadBitmap(e);
    try {
      let e = 0;
      progressListener = (n) => {
        n.status !== "recognizing text" &&
          ((e = Math.max(e, n.progress ?? 0)),
          t({
            stage: "model",
            progress: e,
          }));
      };
      t({
        stage: "model",
        progress: 0,
      });
      let o;
      try {
        o = await getWorker();
      } catch (e) {
        throw Object.assign(
          Error(
            `Die Texterkennung konnte nicht gestartet werden${e?.message ? ` (${String(e.message).slice(0, 120)})` : ""}.`,
          ),
          {
            code: "engine",
          },
        );
      }
      let s = [],
        c = [],
        l = Date.now(),
        u = false,
        d = false,
        f = estimateSkew(a);
      for (let e = 0; e < variants.length; e++) {
        if (Date.now() - l > budgetMs) {
          d = true;
          u = true;
          break;
        }
        if (u && !BINARY_VARIANTS.has(variants[e])) continue;
        progressListener = (n) => {
          n.status === "recognizing text" &&
            t({
              stage: "recognize",
              pass: e + 1,
              passes: variants.length,
              progress: n.progress ?? 0,
            });
        };
        t({
          stage: "recognize",
          pass: e + 1,
          passes: variants.length,
          progress: 0,
        });
        let n = renderVariant(a, variants[e], f),
          data;
        try {
          ({ data } = await withTimeout(
            o.recognize(
              n,
              {},
              {
                text: true,
                blocks: true,
              },
            ),
            FAST_BUDGET_MS,
          ));
        } catch (e) {
          if (e?.message !== "timeout") {
            let t = workerPromise;
            throw (
              (workerPromise = null),
              t?.then((e) => e.terminate()).catch(() => {}),
              e
            );
          }
          u = true;
          let t = workerPromise;
          if (
            ((workerPromise = null),
            t?.then((e) => e.terminate()).catch(() => {}),
            Date.now() - l > budgetMs - FAST_BUDGET_MS / 2)
          ) {
            d = true;
            break;
          }
          o = await getWorker();
          continue;
        }
        n.width = n.height = 0;
        let m = collectWords(data);
        c.push(data.text || "");
        let h = parseCoordinates(data.text || "").map((e) => ({
          ...e,
          confidence: readingConfidence(e.source, m),
        }));
        if (
          (s.push(h),
          (e === 0 &&
            h.length > 0 &&
            h.every((e) => (e.confidence ?? 0) >= 88)) ||
            (e >= 1 && readingsAgree(s)))
        )
          break;
      }
      if (
        tiles > 0 &&
        !u &&
        !d &&
        mergeReadings(s).length === 0 &&
        Math.max(a.width, a.height) >= MIN_TILE_SIDE
      ) {
        let e = await recognizeTiles(
          a,
          f,
          l,
          budgetMs,
          t,
          c,
          TILE_VARIANTS.slice(0, tiles),
        );
        e.timedOut && (u = true);
        e.results.length && s.push(e.results);
      }
      let p = mergeReadings(s);
      if (p.length === 0 && (u || d))
        throw Object.assign(
          Error(
            "Die Erkennung hat zu lange gebraucht. Das Bild ist vermutlich zu unruhig oder zu komplex. Bitte einen Ausschnitt mit den Koordinaten verwenden.",
          ),
          {
            code: "slow",
          },
        );
      return Object.defineProperty(p, "rawTexts", {
        value: c,
        enumerable: false,
      });
    } finally {
      progressListener = null;
      a.close?.();
    }
  });
}
