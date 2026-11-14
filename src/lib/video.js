// Öffnet Videos, schneidet Standbilder heraus und lässt sie lesen.
import { haversineDistance } from "./geo";
import { recognizeImage, FAST_VARIANTS } from "./ocr";
import { createTrackFilter } from "./trackCheck";

function createDuplicateFilter(e = 3) {
  let t = [];
  return {
    accept(n, frame) {
      let i = t.find(
        (t) =>
          t.frame >= frame - 1 &&
          haversineDistance(t.lat, t.lon, n.lat, n.lon) <= e,
      );
      return i
        ? ((i.frame = frame), false)
        : (t.push({
            lat: n.lat,
            lon: n.lon,
            frame: frame,
          }),
          true);
    },
  };
}

const FRAME_MAX_SIDE = 3200;

const FRAME_JPEG_QUALITY = 0.92;

const FRAME_MIN_SIDE = 240;

const RETRY_OFFSETS = [0.5, -0.5];

const MAX_RETRIES = 3;

const RETRY_STEP = 0.5;

const LOAD_TIMEOUT_MS = 2e4;

const META_TIMEOUT_MS = 8e3;

const FRAME_BUDGET_MS = 2e4;

const SEEK_TIMEOUT_MS = 15e3;

const videoError = (e) =>
  Object.assign(Error(e), {
    code: "video",
  });

const MSG_UNSUPPORTED =
  "Dieses Video kann der Browser nicht öffnen. Entweder ist das Format nicht unterstützt (zum Beispiel H.265/HEVC mancher Kameras) oder die Datei ist beschädigt. Bitte in Chrome oder Edge öffnen, das Video als MP4 (H.264) speichern oder Standbilder verwenden.";

const MSG_NO_VIDEO_TRACK =
  "Diese Datei enthält keine Bildspur (nur Ton). Bitte ein Video mit Bild wählen.";

function waitForEvent(e, t, n, r) {
  return new Promise((i, a) => {
    let o = setTimeout(() => {
        c();
        r ? a(r()) : i("timeout");
      }, n),
      s = t.map((t) => {
        let n = () => {
          c();
          i(t);
        };
        e.addEventListener(t, n, {
          once: true,
        });
        return [t, n];
      });
    function c() {
      clearTimeout(o);
      for (let [t, n] of s) e.removeEventListener(t, n);
    }
  });
}

async function seekTo(e, t) {
  if (Math.abs(e.currentTime - t) < 0.001 && e.readyState >= 2) return;
  let n = waitForEvent(e, ["seeked", "emptied", "error"], SEEK_TIMEOUT_MS, () =>
    videoError("Das Video lässt sich an dieser Stelle nicht lesen."),
  );
  if (((e.currentTime = t), (await n) !== "seeked"))
    throw videoError("Das Video ist nicht mehr geöffnet.");
}

async function fixInfiniteDuration(e) {
  let t = waitForEvent(e, ["timeupdate", "seeked", "durationchange"], 4e3);
  e.currentTime = 1e101;
  await t;
  let n = e.duration;
  e.currentTime = 0;
  return n;
}

function grabFrame(e, t) {
  let n = e.videoWidth,
    r = e.videoHeight,
    i = Math.min(1, t / Math.max(n, r)),
    a = document.createElement("canvas");
  a.width = Math.max(1, Math.round(n * i));
  a.height = Math.max(1, Math.round(r * i));
  a.getContext("2d").drawImage(e, 0, 0, a.width, a.height);
  return a;
}

const canvasToJpeg = (e, t) =>
  new Promise((n, r) =>
    e.toBlob(
      (e) =>
        e ? n(e) : r(videoError("Aus dem Video ließ sich kein Bild holen.")),
      "image/jpeg",
      t,
    ),
  );

export async function openVideo(e) {
  let t = URL.createObjectURL(e),
    n = document.createElement("video");
  n.muted = true;
  n.playsInline = true;
  n.preload = "auto";
  let dispose = () => {
    n.removeAttribute("src");
    n.load();
    URL.revokeObjectURL(t);
  };
  try {
    if (
      (await new Promise((e, r) => {
        let i = setTimeout(
          () =>
            r(
              videoError(
                "Das Video ließ sich nicht rechtzeitig öffnen. Bitte eine kleinere Datei oder ein anderes Format versuchen.",
              ),
            ),
          FRAME_BUDGET_MS,
        );
        n.onloadedmetadata = () => {
          clearTimeout(i);
          e();
        };
        n.onerror = () => {
          clearTimeout(i);
          r(videoError(MSG_UNSUPPORTED));
        };
        n.src = t;
      }),
      (n.onerror = null),
      !n.videoWidth || !n.videoHeight)
    )
      throw videoError(MSG_NO_VIDEO_TRACK);
    let e = n.duration;
    if (
      (Number.isFinite(e) || (e = await fixInfiniteDuration(n)),
      !Number.isFinite(e) || e <= 0)
    )
      throw videoError(
        "Die Länge des Videos lässt sich nicht bestimmen. Bitte das Video als MP4 speichern und erneut versuchen.",
      );
    await seekTo(n, Math.min(1, e / 2));
    let poster = grabFrame(n, FRAME_MIN_SIDE).toDataURL("image/jpeg", 0.7);
    return {
      video: n,
      duration: e,
      width: n.videoWidth,
      height: n.videoHeight,
      poster: poster,
      dispose: dispose,
    };
  } catch (e) {
    throw (dispose(), e.code === "video" ? e : videoError(MSG_UNSUPPORTED));
  }
}

async function readFrame(e, t, n, r) {
  await seekTo(e.video, t);
  let i = grabFrame(e.video, FRAME_MAX_SIDE),
    a;
  try {
    a = await canvasToJpeg(i, FRAME_JPEG_QUALITY);
  } finally {
    i.width = i.height = 0;
  }
  try {
    return await recognizeImage(a, n, r);
  } catch (e) {
    if (e?.code === "slow") return [];
    throw e;
  }
}

export async function scanVideo({
  session,
  times,
  signal,
  onProgress,
  onPoint,
  onStats,
}) {
  let o = createDuplicateFilter(),
    s = createTrackFilter({
      twins: true,
    }),
    c = times.length,
    l = {
      total: c,
      done: 0,
      points: 0,
      merged: 0,
      empty: 0,
      failed: 0,
      rescued: 0,
      fixed: 0,
      rejected: 0,
      checked: 0,
    },
    u = 0,
    d = (e) => {
      for (let t of e) {
        l.fixed += t.fixed.length;
        l.rejected += t.rejected.length;
        for (let e of t.points) {
          let n = {
            ...e,
            frameTime: t.meta.usedTime,
          };
          o.accept(n, t.meta.index)
            ? ((l.points += 1), onPoint?.(n))
            : (l.merged += 1);
        }
      }
      e.length &&
        onStats?.({
          ...l,
        });
    },
    f = async (t) => {
      for (let i = s.requests(); i.length; i = s.requests())
        for (let { index, t: o } of i) {
          let i = Math.max(0, session.duration - 0.2),
            time =
              o + RETRY_STEP <= i
                ? o + RETRY_STEP
                : o - RETRY_STEP >= 0
                  ? o - RETRY_STEP
                  : null,
            f = [];
          if (time !== null && !signal?.aborted)
            try {
              let t = Math.min(l.done, c - 1);
              onProgress?.({
                index: t,
                total: c,
                time: time,
                check: true,
              });
              f = await readFrame(
                session,
                time,
                (ocr) =>
                  onProgress?.({
                    index: t,
                    total: c,
                    time: time,
                    check: true,
                    ocr: ocr,
                  }),
                {
                  tiles: 0,
                  budgetMs: META_TIMEOUT_MS,
                  variants: FAST_VARIANTS,
                },
              );
              l.checked += 1;
            } catch (e) {
              if (e?.code === "engine") throw e;
            }
          d(s.twin(index, [...f], t));
        }
    };
  for (let i = 0; i < c; i++) {
    if (signal?.aborted)
      return (
        d(
          s.flush({
            ask: false,
          }),
        ),
        {
          stats: l,
          aborted: true,
        }
      );
    let time = times[i],
      usedTime = time,
      m;
    try {
      onProgress?.({
        index: i,
        total: c,
        time: time,
      });
      m = await readFrame(
        session,
        time,
        (ocr) =>
          onProgress?.({
            index: i,
            total: c,
            time: time,
            ocr: ocr,
          }),
        {
          tiles: +(u === 0),
          budgetMs: LOAD_TIMEOUT_MS,
          ...(u >= MAX_RETRIES
            ? {
                variants: FAST_VARIANTS,
              }
            : {}),
        },
      );
    } catch (e) {
      if (e?.code === "engine") throw e;
      l.failed += 1;
      l.done += 1;
      d(
        s.push(time, [], {
          index: i,
          usedTime: time,
        }),
      );
      await f(false);
      onStats?.({
        ...l,
      });
      continue;
    }
    if (m.length === 0 && u < MAX_RETRIES)
      for (let t of RETRY_OFFSETS) {
        if (signal?.aborted) break;
        let a = Math.min(
          Math.max(0, time + t),
          Math.max(0, session.duration - 0.2),
        );
        if (!(Math.abs(a - time) < 0.2))
          try {
            onProgress?.({
              index: i,
              total: c,
              time: a,
              retry: true,
            });
            let t = await readFrame(
              session,
              a,
              (ocr) =>
                onProgress?.({
                  index: i,
                  total: c,
                  time: a,
                  retry: true,
                  ocr: ocr,
                }),
              {
                tiles: 0,
                budgetMs: META_TIMEOUT_MS,
                variants: FAST_VARIANTS,
              },
            );
            if (t.length > 0) {
              m = t;
              usedTime = a;
              l.rescued += 1;
              break;
            }
          } catch (e) {
            if (e?.code === "engine") throw e;
          }
      }
    m.length === 0 ? ((l.empty += 1), (u += 1)) : (u = 0);
    l.done += 1;
    d(
      s.push(usedTime, [...m], {
        index: i,
        usedTime: usedTime,
      }),
    );
    await f(false);
    onStats?.({
      ...l,
    });
  }
  return signal?.aborted
    ? (d(
        s.flush({
          ask: false,
        }),
      ),
      {
        stats: l,
        aborted: true,
      })
    : (d(s.flush()),
      await f(true),
      {
        stats: l,
        aborted: false,
      });
}
