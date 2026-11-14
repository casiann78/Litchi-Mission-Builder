// Aufziehbares Panel für kleine Bildschirme.
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CaretUpIcon } from "@phosphor-icons/react";
import { prefersReducedMotion } from "../lib/motion";

const DESKTOP_QUERY = "(min-width: 1024px)";

const PEEK_HEIGHT = 168;

const HALF_RATIO = 0.5;

const DRAG_SLOP = 8;

const INTERACTIVE_SELECTOR =
  "input, select, textarea, button, a, [contenteditable]";

const SNAP_POINTS = ["peek", "half", "full"];

const SNAP_LABELS = {
  peek: "Vorschau",
  half: "halb geöffnet",
  full: "ganz geöffnet",
};

const projectMomentum = (e, t = 0.998) => ((e / 1e3) * t) / (1 - t);

const rubberBand = (e, t, n = 0.55) => (e * t * n) / (t + n * Math.abs(e));

const isDesktop = () =>
  typeof matchMedia == "function" && matchMedia(DESKTOP_QUERY).matches;

export const BottomSheet = forwardRef(function (
  { summary, children, onLayout },
  r,
) {
  let i = useRef(null),
    [a, o] = useState(isDesktop),
    [s, c] = useState("peek"),
    l = useRef("peek"),
    u = useRef(0),
    d = useRef(0),
    f = useRef(onLayout);
  f.current = onLayout;
  let p = useCallback(() => {
      let e = i.current?.offsetHeight || 0,
        t = window.innerHeight;
      return {
        full: 0,
        half: Math.max(0, e - Math.round(t * HALF_RATIO)),
        peek: Math.max(0, e - PEEK_HEIGHT),
      };
    }, []),
    m = useCallback((e) => {
      u.current = e;
      let t = i.current;
      t && (t.style.transform = `translate3d(0, ${e.toFixed(2)}px, 0)`);
    }, []),
    h = useCallback(() => {
      let e = i.current;
      e &&
        f.current?.(
          isDesktop()
            ? {
                left: e.getBoundingClientRect().right,
                bottom: 0,
              }
            : {
                left: 0,
                bottom: Math.max(0, e.offsetHeight - u.current),
              },
        );
    }, []),
    g = useCallback(
      (e, t = 0) => {
        if ((cancelAnimationFrame(d.current), prefersReducedMotion())) {
          m(e);
          h();
          return;
        }
        let n = 0.36,
          r = Math.abs(t) > 300 ? 0.82 : 1,
          i = ((2 * Math.PI) / n) ** 2,
          a = (4 * Math.PI * r) / n,
          o = u.current,
          s = t,
          c = performance.now(),
          l = (t) => {
            let n = Math.min(0.032, (t - c) / 1e3);
            if (
              ((c = t),
              (s += (-i * (o - e) - a * s) * n),
              (o += s * n),
              Math.abs(o - e) < 0.4 && Math.abs(s) < 12)
            ) {
              m(e);
              h();
              return;
            }
            m(o);
            d.current = requestAnimationFrame(l);
          };
        d.current = requestAnimationFrame(l);
      },
      [m, h],
    ),
    _ = useCallback(
      (e, t = 0) => {
        isDesktop() || ((l.current = e), c(e), g(p()[e], t));
      },
      [p, g],
    );
  useImperativeHandle(
    r,
    () => ({
      open: (e = "full") => _(e),
    }),
    [_],
  );
  useEffect(() => {
    let e = typeof matchMedia == "function" ? matchMedia(DESKTOP_QUERY) : null,
      t = () => o(isDesktop());
    e?.addEventListener("change", t);
    let n = () => {
      isDesktop() || m(p()[l.current]);
      h();
    };
    window.addEventListener("resize", n);
    return () => {
      e?.removeEventListener("change", t);
      window.removeEventListener("resize", n);
    };
  }, [m, p, h]);
  useLayoutEffect(() => {
    let e = i.current;
    e &&
      (cancelAnimationFrame(d.current),
      a ? ((e.style.transform = ""), (u.current = 0)) : m(p()[l.current]),
      h());
  }, [a, m, p, h]);
  useEffect(() => {
    if (a) return;
    let e = i.current,
      t = null,
      n = false,
      r = (e) => {
        if (
          !(t || (e.pointerType === "mouse" && e.button !== 0)) &&
          (e.target.closest(".sheet-grab") || l.current !== "full")
        ) {
          if (
            e.target.closest(INTERACTIVE_SELECTOR) &&
            !e.target.closest(".sheet-handle")
          ) {
            t = {
              id: e.pointerId,
              y0: e.clientY,
              soft: true,
              hist: [
                {
                  t: e.timeStamp,
                  y: e.clientY,
                },
              ],
              active: false,
            };
            return;
          }
          t = {
            id: e.pointerId,
            y0: e.clientY,
            soft: false,
            hist: [
              {
                t: e.timeStamp,
                y: e.clientY,
              },
            ],
            active: false,
          };
        }
      },
      o = (n) => {
        if (!t || n.pointerId !== t.id) return;
        let r = n.clientY - t.y0;
        if (!t.active) {
          if (Math.abs(r) < DRAG_SLOP) return;
          cancelAnimationFrame(d.current);
          t.active = true;
          t.start = u.current;
          e.setPointerCapture?.(n.pointerId);
          e.dataset.dragging = "true";
        }
        let i = p().peek,
          a = t.start + (n.clientY - t.y0);
        a < 0 && (a = -rubberBand(-a, window.innerHeight));
        a > i && (a = i + rubberBand(a - i, window.innerHeight));
        m(a);
        t.hist.push({
          t: n.timeStamp,
          y: n.clientY,
        });
        t.hist.length > 5 && t.hist.shift();
      },
      s = (e, t) => {
        let n = e.hist[e.hist.length - 1];
        (!n || t.clientY !== n.y) &&
          e.hist.push({
            t: t.timeStamp,
            y: t.clientY,
          });
      },
      c = (r) => {
        if (!t || r.pointerId !== t.id) return;
        let i = t;
        if (((t = null), !i.active)) return;
        s(i, r);
        delete e.dataset.dragging;
        n = true;
        setTimeout(() => (n = false), 0);
        let a = i.hist[0],
          o = i.hist[i.hist.length - 1],
          c = a && o && o.t > a.t ? ((o.y - a.y) / (o.t - a.t)) * 1e3 : 0,
          l = p(),
          d = u.current + projectMomentum(c),
          f = SNAP_POINTS.reduce(
            (e, t) => (Math.abs(l[t] - d) < Math.abs(l[e] - d) ? t : e),
            "peek",
          );
        _(f, c);
      },
      f = (e) => {
        n && (e.preventDefault(), e.stopPropagation());
      };
    e.addEventListener("pointerdown", r);
    e.addEventListener("pointermove", o);
    e.addEventListener("pointerup", c);
    e.addEventListener("pointercancel", c);
    e.addEventListener("click", f, true);
    return () => {
      e.removeEventListener("pointerdown", r);
      e.removeEventListener("pointermove", o);
      e.removeEventListener("pointerup", c);
      e.removeEventListener("pointercancel", c);
      e.removeEventListener("click", f, true);
      cancelAnimationFrame(d.current);
    };
  }, [a, m, p, _]);
  let v = s === "full" ? "peek" : SNAP_POINTS[SNAP_POINTS.indexOf(s) + 1];
  return (
    <div ref={i} className="sheet" data-snap={a ? "wide" : s}>
      <div className="sheet-grab">
        {!a && (
          <button
            type="button"
            className="sheet-handle"
            onClick={() => _(v)}
            aria-label={`Bedienbereich ${SNAP_LABELS[s]}. Tippen für ${SNAP_LABELS[v]}`}
          >
            <span className="sheet-bar" aria-hidden="true" />
            <CaretUpIcon
              size={14}
              weight="bold"
              className="sheet-caret"
              aria-hidden="true"
            />
          </button>
        )}
        {summary}
      </div>
      <main id="main" className="sheet-body">
        {children}
      </main>
    </div>
  );
});
