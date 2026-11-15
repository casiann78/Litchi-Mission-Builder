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

const FIRST_SEEK_TIMEOUT_MS = 4e3;

const PRIME_TIMEOUT_MS = 3e3;

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

// iOS-Safari lädt Bilddaten eines Videos erst, wenn es einmal abgespielt wurde.
// Ein kurzes stummes Anspielen holt das nach; auf anderen Browsern schadet es nicht.
async function primeVideo(video) {
  try {
    await Promise.race([
      video.play(),
      new Promise((resolve) => setTimeout(resolve, PRIME_TIMEOUT_MS)),
    ]);
  } catch {
    // Abspielen nicht erlaubt (z. B. Stromsparmodus): Der Sprung wird trotzdem versucht.
  }
  video.pause();
}

// Wartet kurz darauf, dass der Browser ein Bild zum Zeichnen bereit hat.
async function waitForFrameData(video, timeoutMs) {
  if (video.readyState >= 2) return true;
  await waitForEvent(video, ["loadeddata", "canplay", "error"], timeoutMs);
  return video.readyState >= 2;
}

async function seekTo(video, time) {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2)
    return;
  // Erster Versuch mit kurzer Frist. Bleibt er hängen (iOS), wird das Video
  // angespielt und der Sprung mit der vollen Frist wiederholt.
  let first = waitForEvent(
    video,
    ["seeked", "emptied", "error"],
    FIRST_SEEK_TIMEOUT_MS,
  );
  video.currentTime = time;
  let result = await first;
  if (result === "timeout") {
    await primeVideo(video);
    let second = waitForEvent(
      video,
      ["seeked", "emptied", "error"],
      SEEK_TIMEOUT_MS,
      () => videoError("Das Video lässt sich an dieser Stelle nicht lesen."),
    );
    // Kleiner Versatz, damit der Browser den Sprung sicher neu ausführt.
    video.currentTime = Math.max(0, time - 0.001);
    video.currentTime = time;
    result = await second;
  }
  if (result !== "seeked")
    throw videoError("Das Video ist nicht mehr geöffnet.");
  if (!(await waitForFrameData(video, 1500))) {
    await primeVideo(video);
    await waitForFrameData(video, 3000);
  }
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
  // iOS-Safari braucht die Attribute im Markup und ein Element im Dokument,
  // sonst lädt es keine Bilder. Das Element bleibt unsichtbar.
  n.setAttribute("muted", "");
  n.setAttribute("playsinline", "");
  n.setAttribute("webkit-playsinline", "");
  n.setAttribute("aria-hidden", "true");
  n.style.cssText =
    "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;";
  document.body.appendChild(n);
  let dispose = () => {
    n.remove();
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
    // Hat der Browser nach dem Öffnen noch kein Bild geladen (iOS), kurz anspielen.
    if (!(await waitForFrameData(n, 1500))) await primeVideo(n);
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

// Wartet, bis der Browser nach einem Sprung wirklich ein neues Bild zeigt.
// „seeked“ allein genügt in Safari nicht: Dort zeichnet drawImage sonst noch das alte Bild.
function waitForPresentedFrame(video, timeoutMs) {
  return new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback != "function") {
      setTimeout(() => resolve(false), Math.min(timeoutMs, 120));
      return;
    }
    let timer = setTimeout(() => resolve(false), timeoutMs);
    video.requestVideoFrameCallback(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

// Spielt das Video einen Moment ab, damit der Browser das Bild an der aktuellen
// Stelle sicher dekodiert, und hält es wieder an.
async function nudgeFrame(video) {
  let presented = waitForPresentedFrame(video, 1200);
  try {
    await Promise.race([
      video.play(),
      new Promise((resolve) => setTimeout(resolve, PRIME_TIMEOUT_MS)),
    ]);
  } catch {
    // Abspielen nicht erlaubt: Es bleibt beim vorhandenen Bild.
  }
  await presented;
  video.pause();
}

// Kleiner Fingerabdruck des aktuellen Videobilds. Zwei verschiedene Stellen eines
// Videos liefern nie exakt dieselben Bytes, ein nicht aktualisiertes Bild schon.
function frameFingerprint(video) {
  let canvas = grabFrame(video, 160);
  try {
    let data = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++)
      hash = Math.imul(hash ^ data[i], 16777619);
    return hash >>> 0;
  } catch {
    return null;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

async function readFrame(session, time, onProgress, options) {
  let video = session.video;
  let presented = waitForPresentedFrame(video, 400);
  let moved = Math.abs(video.currentTime - time) >= 0.001;
  await seekTo(video, time);
  if (moved) await presented;
  // Zeigt das Video trotz Sprung exakt dasselbe Bild wie an der vorigen Stelle,
  // hat der Browser es nicht aktualisiert (iOS-Safari): kurz anspielen und neu prüfen.
  let fingerprint = frameFingerprint(video);
  if (
    fingerprint !== null &&
    session.lastFrame &&
    session.lastFrame.fingerprint === fingerprint &&
    Math.abs(session.lastFrame.time - time) > 0.05
  ) {
    await nudgeFrame(video);
    fingerprint = frameFingerprint(video);
  }
  session.lastFrame = { time, fingerprint };
  let i = grabFrame(video, FRAME_MAX_SIDE),
    a;
  try {
    a = await canvasToJpeg(i, FRAME_JPEG_QUALITY);
  } finally {
    i.width = i.height = 0;
  }
  try {
    return await recognizeImage(a, onProgress, options);
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
