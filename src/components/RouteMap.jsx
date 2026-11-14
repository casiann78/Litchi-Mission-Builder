// Karte mit Route, Wegpunkten und Drohnen-Animation (Leaflet).
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  CornersOutIcon,
  MapPinIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";
import { TILE_LAYERS, MAP_MODES } from "../lib/mapLayers";
import { Segmented } from "./ui";
import { SketchMap } from "./SketchMap";

const DEFAULT_VIEW = {
  center: [51.2, 10.4],
  zoom: 5,
};

const TILE_TIMEOUT_MS = 8e3;

const reducedMotion = () =>
  typeof matchMedia == "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const FLY_MS = 700;

function markerHtml(e, t, n, r = null) {
  let i = e === 0 ? "start" : t > 1 && e === t - 1 ? "end" : "mid",
    a = String(e + 1),
    o =
      r === null
        ? ""
        : ` data-new="true" style="animation-delay:${Math.round(r)}ms"`;
  return L.divIcon({
    className: "mk-wrap",
    html: `<span class="mk" data-role="${i}" data-selected="${n ? "true" : "false"}" data-long="${a.length > 2 ? "true" : "false"}"${o}>${a}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const arrowHtml = (e, t = null) => {
  let n = `<svg class="arrow-svg" viewBox="-9 -9 18 18" aria-hidden="true" style="transform:rotate(${e}deg)"><path d="M -6 -6.5 L 7.5 0 L -6 6.5 Z"/></svg>`;
  return t === null
    ? n
    : `<span class="arrow-in" style="animation-delay:${Math.round(t)}ms">${n}</span>`;
};

const DRONE_HTML = `<span class="drone"><svg viewBox="-24 -24 48 48" aria-hidden="true">
  <g class="drone-arms"><path d="M-12 -12 L12 12 M12 -12 L-12 12"/></g>
  <g class="drone-rotors"><circle cx="-12" cy="-12" r="7.5"/><circle cx="12" cy="-12" r="7.5"/><circle cx="-12" cy="12" r="7.5"/><circle cx="12" cy="12" r="7.5"/></g>
  <rect class="drone-body" x="-6" y="-7" width="12" height="14" rx="4"/><path class="drone-nose" d="M-3.5 -4 L0 -9 L3.5 -4 Z"/>
</svg></span>`;

function offsetCenter(e, t, n, r) {
  let { left = 0, bottom = 0 } = r || {};
  if (!left && !bottom) return t;
  let o = e.project(t, n).subtract(L.point(left / 2, -bottom / 2));
  return e.unproject(o, n);
}

const easeInOutCubic = (e) =>
  e < 0.5 ? 4 * e * e * e : 1 - (-2 * e + 2) ** 3 / 2;

export function RouteMap({
  waypoints: e,
  segments,
  plot,
  selectedId: r,
  onSelect,
  mode,
  onModeChange,
  fitKey: s,
  unavailable,
  onUnavailable,
  onRetry,
  inset = null,
}) {
  let f = useRef(null),
    p = useRef(null),
    m = useRef(null),
    h = useRef(null),
    g = useRef(null),
    _ = useRef(new Map()),
    v = useRef(new Set()),
    y = useRef({
      start: -1 / 0,
      reach: [0],
      total: 1,
    }),
    b = useRef(null),
    [S, ee] = useState(false),
    C = useRef({});
  C.current = {
    waypoints: e,
    selectedId: r,
    onSelect: onSelect,
    onUnavailable: onUnavailable,
    mode: mode,
    inset: inset,
  };
  let w = mode !== "sketch",
    T = useCallback(() => {
      let e = p.current,
        t = g.current;
      if (!e || !t) return;
      t.clearLayers();
      let n = C.current.waypoints,
        { start, reach, total } = y.current,
        o = performance.now() - start,
        s = (e) => {
          if (o >= FLY_MS || reach.length !== n.length) return null;
          let t = (FLY_MS * (reach[e] + reach[e + 1])) / 2 / total - o;
          return t > 0 ? t : null;
        };
      for (let r = 0; r < n.length - 1; r++) {
        let i = e.latLngToLayerPoint([n[r].lat, n[r].lon]),
          a = e.latLngToLayerPoint([n[r + 1].lat, n[r + 1].lon]);
        if (i.distanceTo(a) < 56) continue;
        let o = e.layerPointToLatLng(L.point((i.x + a.x) / 2, (i.y + a.y) / 2)),
          c = (Math.atan2(a.y - i.y, a.x - i.x) * 180) / Math.PI;
        L.marker(o, {
          icon: L.divIcon({
            className: "arrow",
            html: arrowHtml(c.toFixed(1), s(r)),
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          interactive: false,
          keyboard: false,
          zIndexOffset: -1e3,
        }).addTo(t);
      }
    }, []),
    handleClick = useCallback(() => {
      let e = p.current,
        t = C.current.waypoints;
      if (!e || t.length === 0) return;
      let animate = !reducedMotion();
      if (t.length === 1) {
        e.setView(
          offsetCenter(e, L.latLng(t[0].lat, t[0].lon), 16, C.current.inset),
          16,
          {
            animate: animate,
          },
        );
        return;
      }
      let { left = 0, bottom = 0 } = C.current.inset || {};
      e.fitBounds(L.latLngBounds(t.map((e) => [e.lat, e.lon])), {
        paddingTopLeft: [64 + left, 64],
        paddingBottomRight: [64, 64 + bottom],
        maxZoom: 18,
        animate: animate,
      });
    }, []),
    D = useCallback(() => {
      let e = b.current;
      e &&
        (cancelAnimationFrame(e.raf),
        clearTimeout(e.timer),
        e.marker.remove(),
        e.trail.remove(),
        (b.current = null),
        ee(false));
    }, []),
    te = useCallback(
      (e = 0) => {
        D();
        let t = p.current,
          n = C.current.waypoints;
        if (!t || n.length < 2 || reducedMotion()) return;
        let r = n.map((e) => L.latLng(e.lat, e.lon)),
          i = [0];
        for (let e = 1; e < r.length; e++)
          i.push(i[e - 1] + t.distance(r[e - 1], r[e]));
        let a = i[i.length - 1] || 1,
          o = Math.min(9e3, Math.max(3e3, 1100 * (r.length - 1))),
          trail = L.polyline([r[0]], {
            interactive: false,
            className: "flight-trail",
            weight: 4,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(t),
          marker = L.marker(r[0], {
            icon: L.divIcon({
              className: "drone-wrap",
              html: DRONE_HTML,
              iconSize: [48, 48],
              iconAnchor: [24, 24],
            }),
            interactive: false,
            keyboard: false,
            zIndexOffset: 3e3,
          }).addTo(t),
          l = {
            marker: marker,
            trail: trail,
            raf: 0,
            timer: 0,
            start: performance.now() + e,
            heading: null,
          };
        b.current = l;
        ee(true);
        let u = (e) => {
          if (b.current !== l) return;
          let n = Math.min(1, Math.max(0, (e - l.start) / o)),
            d = easeInOutCubic(n) * a,
            f = 0;
          for (; f < i.length - 2 && i[f + 1] < d;) f++;
          let p = Math.min(1, (d - i[f]) / (i[f + 1] - i[f] || 1)),
            m = r[f],
            h = r[f + 1],
            g = L.latLng(
              m.lat + (h.lat - m.lat) * p,
              m.lng + (h.lng - m.lng) * p,
            );
          marker.setLatLng(g);
          trail.setLatLngs([...r.slice(0, f + 1), g]);
          let _ = t.latLngToLayerPoint(m),
            v = t.latLngToLayerPoint(h),
            y = (Math.atan2(v.y - _.y, v.x - _.x) * 180) / Math.PI + 90;
          l.heading !== null &&
            (y = l.heading + ((((y - l.heading) % 360) + 540) % 360) - 180);
          l.heading = y;
          let x = marker.getElement()?.firstElementChild;
          if (
            (x &&
              (x.style.setProperty("--hdg", `${y.toFixed(1)}deg`),
              (x.dataset.phase = n <= 0 ? "wait" : "fly")),
            n < 1)
          ) {
            l.raf = requestAnimationFrame(u);
            return;
          }
          x && (x.dataset.phase = "land");
          trail.getElement()?.classList.add("flight-trail--fade");
          l.timer = setTimeout(() => b.current === l && D(), 900);
        };
        l.raf = requestAnimationFrame(u);
      },
      [D],
    );
  useEffect(() => {
    if (!w || p.current || !f.current) return;
    let e = L.map(f.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 19,
      worldCopyJump: false,
    });
    e.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
    L.control
      .attribution({
        position: "bottomleft",
        prefix: false,
      })
      .addTo(e);
    h.current = L.layerGroup().addTo(e);
    g.current = L.layerGroup().addTo(e);
    e.on("zoomend", T);
    p.current = e;
    let t = new ResizeObserver(() => e.invalidateSize());
    t.observe(f.current);
    return () => {
      t.disconnect();
      D();
      e.remove();
      p.current = null;
      m.current = null;
      _.current.clear();
    };
  }, [w, T, D]);
  useEffect(() => {
    let e = p.current;
    if (!e) return;
    m.current &&= (m.current.remove(), null);
    let t = TILE_LAYERS[mode];
    if (!t) return;
    if (typeof navigator < "u" && navigator.onLine === false) {
      C.current.onUnavailable?.();
      return;
    }
    let n = 0,
      r = 0,
      i = L.tileLayer(t.url, {
        attribution: t.attribution,
        maxZoom: t.maxZoom,
        referrerPolicy: t.referrerPolicy,
        keepBuffer: 2,
      });
    i.on("tileload", () => (n += 1));
    i.on("tileerror", () => (r += 1));
    i.addTo(e);
    m.current = i;
    let o = setTimeout(() => {
      n === 0 && r > 0 && C.current.onUnavailable?.();
    }, TILE_TIMEOUT_MS);
    return () => clearTimeout(o);
  }, [mode, w]);
  useEffect(() => {
    let t = p.current,
      n = h.current;
    if (!t || !n) return;
    n.clearLayers();
    _.current.clear();
    let r = e.map((e) => [e.lat, e.lon]),
      i = !reducedMotion(),
      a = new Set(e.filter((e) => !v.current.has(e.id)).map((e) => e.id));
    v.current = new Set(e.map((e) => e.id));
    let o = i && r.length > 1 && a.size === e.length,
      s = [0];
    for (let e = 1; e < r.length; e++)
      s.push(s[e - 1] + t.distance(r[e - 1], r[e]));
    let c = s[s.length - 1] || 1;
    if (
      ((y.current = {
        start: o ? performance.now() : -1 / 0,
        reach: s,
        total: c,
      }),
      r.length > 1)
    ) {
      let e = {
          interactive: false,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1,
        },
        t = [
          L.polyline(r, {
            ...e,
            className: "route-shadow",
            color: "#000",
            weight: 11,
            opacity: 0.5,
          }).addTo(n),
          L.polyline(r, {
            ...e,
            className: "route-casing",
            color: "#050607",
            weight: 10,
            opacity: 1,
          }).addTo(n),
          L.polyline(r, {
            ...e,
            className: "route-line",
            color: "#c8f84a",
            weight: 5,
            opacity: 1,
          }).addTo(n),
        ];
      o &&
        t.forEach((e) => {
          let t = e.getElement();
          t &&
            (t.setAttribute("pathLength", "1"),
            t.classList.add("route-draw"),
            t.addEventListener(
              "animationend",
              () => {
                t.classList.remove("route-draw");
                t.removeAttribute("pathLength");
              },
              {
                once: true,
              },
            ));
        });
    }
    e.forEach((t, r) => {
      let l = !i || !a.has(t.id) ? null : o ? (FLY_MS * s[r]) / c : 0,
        u = L.marker([t.lat, t.lon], {
          icon: markerHtml(r, e.length, t.id === C.current.selectedId, l),
          title: `Wegpunkt ${r + 1}`,
          alt: `Wegpunkt ${r + 1}`,
          keyboard: true,
          riseOnHover: true,
        });
      u.on("click", () => C.current.onSelect?.(t.id));
      u.addTo(n);
      _.current.set(t.id, u);
    });
    T();
    o ? te(950) : D();
  }, [e, w, T, te, D]);
  let O = useRef(null);
  useEffect(() => {
    let e = p.current,
      t = C.current.waypoints,
      n = (e, n) => {
        let r = t.findIndex((t) => t.id === e);
        return r < 0 ? null : markerHtml(r, t.length, n);
      };
    if (O.current !== null && O.current !== r) {
      let e = _.current.get(O.current),
        t = n(O.current, false);
      e && t && e.setIcon(t);
    }
    if (((O.current = r), !e || r == null)) return;
    let i = _.current.get(r),
      a = n(r, true);
    if (!i || !a) return;
    i.setIcon(a);
    i.setZIndexOffset(1e3);
    let o = Math.max(e.getZoom(), 16),
      s = offsetCenter(e, i.getLatLng(), o, C.current.inset);
    reducedMotion()
      ? e.setView(s, o, {
          animate: false,
        })
      : e.flyTo(s, o, {
          duration: 0.6,
        });
  }, [r, w]);
  useEffect(() => {
    p.current && handleClick();
  }, [s, w, handleClick, !!inset]);
  let ne = useRef(new Set(e.map((e) => e.id))),
    k = useRef(s),
    re = useRef(false),
    A = useCallback(() => {
      let e = p.current,
        t = C.current.waypoints;
      if (!e || t.length === 0) return;
      if (reducedMotion()) {
        handleClick();
        return;
      }
      let { left = 0, bottom = 0 } = C.current.inset || {};
      re.current = true;
      e.once("moveend", () => {
        re.current = false;
      });
      let i = (t) => Math.min(1.8, 0.9 + Math.abs(t - e.getZoom()) * 0.08);
      if (t.length === 1)
        e.flyTo(
          offsetCenter(e, L.latLng(t[0].lat, t[0].lon), 16, C.current.inset),
          16,
          {
            duration: i(16),
          },
        );
      else {
        let a = L.latLngBounds(t.map((e) => [e.lat, e.lon])),
          o = L.point(128 + left, 128 + bottom);
        e.flyToBounds(a, {
          duration: i(Math.min(18, e.getBoundsZoom(a, false, o))),
          maxZoom: 18,
          paddingTopLeft: [64 + left, 64],
          paddingBottomRight: [64, 64 + bottom],
        });
      }
    }, [handleClick]);
  useEffect(() => {
    let t = ne.current;
    ne.current = new Set(e.map((e) => e.id));
    let n = k.current !== s;
    k.current = s;
    let r = p.current;
    if (!r || !w || n || e.length === 0) return;
    let i = e.filter((e) => !t.has(e.id)),
      a = t.size - (e.length - i.length) > 0;
    if (i.length === 0 && !a) return;
    if (t.size === 0) {
      A();
      return;
    }
    if (re.current) {
      A();
      return;
    }
    let { left = 0, bottom = 0 } = C.current.inset || {},
      l = r.getSize(),
      u = (e) => {
        let t = r.latLngToContainerPoint([e.lat, e.lon]);
        return (
          t.x >= left + 24 &&
          t.x <= l.x - 24 &&
          t.y >= 24 &&
          t.y <= l.y - bottom - 24
        );
      };
    if (i.some((e) => !u(e)) || (a && !e.every(u))) {
      A();
      return;
    }
    if (!a) return;
    let d = 16;
    if (e.length > 1) {
      let t = L.latLngBounds(e.map((e) => [e.lat, e.lon]));
      d = Math.min(
        18,
        r.getBoundsZoom(t, false, L.point(128 + left, 128 + bottom)),
      );
    }
    d >= r.getZoom() + 1 && A();
  }, [e, s, w, handleClick, A]);
  let j = (e) => p.current?.setZoom(p.current.getZoom() + e),
    disabled = e.length === 0;
  return (
    <div
      className="mapcard"
      id="sec-map"
      role="region"
      aria-label="Karte der Route"
      data-mode={mode}
    >
      <div className="map-canvas" data-layer={mode}>
        <div ref={f} className="leaflet-host" hidden={!w} />
        {!w && (
          <div className="sketch-host">
            <SketchMap plot={plot} count={e.length} segments={segments} />
          </div>
        )}
        {disabled && w && (
          <div className="map-empty" aria-live="polite">
            <MapPinIcon size={28} aria-hidden="true" />
            <strong>Noch keine Wegpunkte</strong>
            <span>Sobald Punkte da sind, erscheint hier die Route.</span>
          </div>
        )}
      </div>
      <Segmented
        className="seg--map"
        label="Kartenansicht"
        options={MAP_MODES}
        value={mode}
        onChange={onModeChange}
      />
      {w && (
        <div className="map-tools">
          <button
            type="button"
            className="map-btn"
            onClick={() => (S ? D() : te())}
            disabled={e.length < 2}
            aria-pressed={S}
            aria-label={S ? "Probeflug beenden" : "Probeflug abspielen"}
            title={S ? "Probeflug beenden" : "Probeflug abspielen"}
          >
            {S ? (
              <StopIcon size={20} weight="fill" aria-hidden="true" />
            ) : (
              <PlayIcon size={20} weight="fill" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="map-btn"
            onClick={handleClick}
            disabled={disabled}
            aria-label="Route einpassen"
            title="Route einpassen"
          >
            <CornersOutIcon size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="map-btn"
            onClick={() => j(1)}
            aria-label="Vergrößern"
            title="Vergrößern"
          >
            <PlusIcon size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="map-btn"
            onClick={() => j(-1)}
            aria-label="Verkleinern"
            title="Verkleinern"
          >
            <MinusIcon size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      {unavailable && (
        <p role="status" className="map-notice">
          <WifiSlashIcon size={18} aria-hidden="true" />
          <span>
            Die Karte ist nicht erreichbar. Hier steht die Skizze der Route.
          </span>
          <button type="button" onClick={onRetry}>
            Erneut versuchen
          </button>
        </p>
      )}
    </div>
  );
}
