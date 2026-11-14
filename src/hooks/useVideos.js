// Verwaltet die hochgeladenen Videos und ihre Auswertung.
import { useCallback, useEffect, useRef, useState } from "react";
import { planFrameTimes, nearestInterval } from "../lib/videoPlan";
import { openVideo, scanVideo } from "../lib/video";

let nextVideoId = 1;

export function useVideos() {
  let [videos, setVideos] = useState([]),
    n = useRef(videos);
  n.current = videos;
  let r = useRef(new Map()),
    i = useRef(new Set()),
    a = useCallback((e, n) => {
      setVideos((t) =>
        t.map((t) =>
          t.id === e
            ? {
                ...t,
                ...(typeof n == "function" ? n(t) : n),
              }
            : t,
        ),
      );
    }, []),
    addFiles = useCallback(
      async (e) => {
        for (let n of e) {
          let e = `video-${nextVideoId++}`;
          setVideos((t) => [
            ...t,
            {
              id: e,
              name: n.name,
              size: n.size,
              status: "loading",
              interval: 5,
              results: [],
              stats: null,
              error: null,
              progress: null,
            },
          ]);
          try {
            let t = await openVideo(n);
            if (i.current.has(e)) {
              t.dispose();
              continue;
            }
            r.current.set(e, {
              session: t,
              controller: null,
            });
            a(e, {
              status: "idle",
              duration: t.duration,
              width: t.width,
              height: t.height,
              poster: t.poster,
            });
          } catch (t) {
            a(e, {
              status: "error",
              error: t.message || "Das Video konnte nicht geöffnet werden.",
            });
          }
        }
      },
      [a],
    ),
    setInterval = useCallback(
      (e, interval) =>
        a(e, {
          interval: interval,
        }),
      [a],
    ),
    c = useCallback(
      async (e) => {
        let t = r.current.get(e),
          i = n.current.find((t) => t.id === e);
        if (!t || !i || t.controller || i.status === "processing") return;
        let o = planFrameTimes(t.session.duration, nearestInterval(i.interval)),
          s = new AbortController();
        t.controller = s;
        a(e, {
          status: "processing",
          results: [],
          error: null,
          progress: null,
          stats: {
            total: o.times.length,
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
        });
        try {
          let n = await scanVideo({
            session: t.session,
            times: o.times,
            signal: s.signal,
            onProgress: (t) =>
              a(e, {
                progress: t,
              }),
            onPoint: (t) =>
              a(e, (e) => ({
                results: [...e.results, t],
              })),
            onStats: (t) =>
              a(e, {
                stats: t,
              }),
          });
          a(e, {
            status: n.aborted ? "stopped" : "done",
            stats: n.stats,
            progress: null,
          });
        } catch (t) {
          a(e, {
            status: "error",
            error: t.message || "Fehler bei der Auswertung des Videos.",
            progress: null,
          });
        } finally {
          t.controller = null;
        }
      },
      [a],
    ),
    cancel = useCallback((e) => r.current.get(e)?.controller?.abort(), []),
    remove = useCallback((e) => {
      i.current.add(e);
      let n = r.current.get(e);
      n?.controller?.abort();
      n?.session.dispose();
      r.current.delete(e);
      setVideos((t) => t.filter((t) => t.id !== e));
    }, []);
  useEffect(
    () => () => {
      for (let e of r.current.values())
        (e.controller?.abort(), e.session.dispose());
      r.current.clear();
    },
    [],
  );
  return {
    videos: videos,
    addFiles: addFiles,
    setInterval: setInterval,
    start: c,
    cancel: cancel,
    remove: remove,
  };
}
