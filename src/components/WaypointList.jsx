// Liste der Wegpunkte mit Details, Reihenfolge und Löschen.
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  PathIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  foldIn,
  flipMove,
  captureTops,
  collapseOut,
  clearRowEnter,
} from "../lib/motion";
import { Field, NumberInput, OverrideCell } from "./ui";

function WaypointDetails({
  wp,
  index,
  defaultAltitude: n,
  defaultGimbalPitch,
  customHeading,
  onUpdate,
  children,
}) {
  let s = index;
  return (
    <div className="wp-edit">
      <Field label="Breite (lat)">
        <NumberInput
          step="0.000001"
          aria-label={`Breite von Wegpunkt ${s + 1}`}
          value={wp.lat}
          onChange={(t) => onUpdate(wp.id, "lat", t)}
          className="field-mono"
        />
      </Field>
      <Field label="Länge (lon)">
        <NumberInput
          step="0.000001"
          aria-label={`Länge von Wegpunkt ${s + 1}`}
          value={wp.lon}
          onChange={(t) => onUpdate(wp.id, "lon", t)}
          className="field-mono"
        />
      </Field>
      <Field label="Höhe (m)">
        <OverrideCell
          aria-label={`Höhe von Wegpunkt ${s + 1}`}
          resetLabel={`Höhe von Wegpunkt ${s + 1} auf die Standardhöhe zurücksetzen`}
          value={wp.altitude}
          fallback={n}
          onChange={(t) => onUpdate(wp.id, "altitude", t)}
          className="field-mono"
        />
      </Field>
      {customHeading && (
        <Field label="Kurs (°)">
          <NumberInput
            aria-label={`Kurs von Wegpunkt ${s + 1}`}
            value={wp.heading}
            onChange={(t) => onUpdate(wp.id, "heading", t)}
            className="field-mono"
          />
        </Field>
      )}
      <Field label="Gimbalneigung (°)">
        <OverrideCell
          aria-label={`Gimbalneigung von Wegpunkt ${s + 1}`}
          resetLabel={`Gimbalneigung von Wegpunkt ${s + 1} auf den Standard zurücksetzen`}
          value={wp.gimbalPitch}
          fallback={defaultGimbalPitch}
          onChange={(t) => onUpdate(wp.id, "gimbalPitch", t)}
          className="field-mono"
        />
      </Field>
      <Field label="Aktion">
        <select
          aria-label={`Aktion von Wegpunkt ${s + 1}`}
          value={wp.action}
          className="field"
          onChange={(t) => onUpdate(wp.id, "action", t.target.value)}
        >
          <option value="none">Keine</option>
          <option value="photo">Foto</option>
          <option value="stay">Warten (s)</option>
          <option value="rotate">Drehen (°)</option>
        </select>
      </Field>
      {wp.action !== "none" && (
        <Field
          label={
            wp.action === "stay"
              ? "Wartezeit (s)"
              : wp.action === "rotate"
                ? "Drehung (°)"
                : "Parameter"
          }
        >
          <NumberInput
            aria-label={`Parameter von Wegpunkt ${s + 1}`}
            value={wp.actionParam}
            onChange={(t) => onUpdate(wp.id, "actionParam", t)}
            className="field-mono"
          />
        </Field>
      )}
      {children}
    </div>
  );
}

const waypointRole = (e, t) =>
  e === 0 ? "Start" : t > 1 && e === t - 1 ? "Ziel" : "";

const actionLabel = (e) =>
  e.action === "photo"
    ? "Foto"
    : e.action === "stay"
      ? `Warten ${e.actionParam} s`
      : e.action === "rotate"
        ? `Drehen ${e.actionParam}°`
        : "";

export function WaypointList({
  waypoints: e,
  segments,
  defaultAltitude: n,
  defaultGimbalPitch,
  customHeading,
  selectedId: a,
  onSelect,
  onUpdate,
  onMove,
  onRemove,
}) {
  let u = useRef(new Map()),
    d = useRef(new Set()),
    f = useRef(null),
    p = e.map((e) => e.id).join(",");
  useEffect(() => {
    a != null &&
      u.current.get(a)?.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [a]);
  let m = useRef(new Set(e.map((e) => e.id)));
  useLayoutEffect(() => {
    let t = e.filter((e) => !m.current.has(e.id));
    m.current = new Set(e.map((e) => e.id));
    t.forEach((e) => {
      let t = u.current.get(e.id);
      t && (t.classList.remove("row-enter"), foldIn(t));
    });
  }, [e]);
  useLayoutEffect(() => {
    f.current &&= (flipMove(f.current, u.current), null);
  }, [p]);
  let h = (e, t) => {
      f.current = captureTops(u.current);
      onMove(e, t);
    },
    g = (t, n) => {
      if (d.current.has(t.id)) return;
      d.current.add(t.id);
      let r = u.current.get(t.id),
        i = !!r?.contains(document.activeElement),
        a = (e[n + 1] ?? e[n - 1])?.id;
      collapseOut(r).done.then(() => {
        d.current.delete(t.id);
        onRemove(t.id);
        i &&
          a !== undefined &&
          requestAnimationFrame(() =>
            u.current.get(a)?.querySelector(".wp-head")?.focus({
              preventScroll: true,
            }),
          );
      });
    };
  if (e.length === 0)
    return (
      <div className="empty row-enter">
        <PathIcon size={28} aria-hidden="true" />
        <div>
          <div className="empty-title">Noch keine Wegpunkte gesetzt</div>
          <div className="hint">
            Lade eine Team-Mission, ein Bild mit Koordinaten oder trage sie
            manuell ein.
          </div>
        </div>
      </div>
    );
  let _ = e.length;
  return (
    <ol className="wp-list">
      {e.map((e, c) => {
        let l = e.id === a,
          d = waypointRole(c, _),
          f = `wp-edit-${e.id}`;
        return (
          <li
            key={e.id}
            ref={(t) => (t ? u.current.set(e.id, t) : u.current.delete(e.id))}
            className="wp row-enter"
            data-open={l ? "true" : "false"}
            onAnimationEnd={clearRowEnter}
          >
            <button
              type="button"
              className="wp-head"
              aria-expanded={l}
              aria-controls={f}
              aria-label={`Wegpunkt ${c + 1}${d ? `, ${d}` : ""}, ${e.lat.toFixed(6)}, ${e.lon.toFixed(6)}`}
              onClick={() => onSelect(l ? null : e.id)}
            >
              <span className="wp-num num">
                {String(c + 1).padStart(2, "0")}
                <span className="wp-role">
                  {e.altitude ?? n}
                  {" m"}
                </span>
              </span>
              <span className="wp-main">
                <span className="wp-title">
                  {d || `Wegpunkt ${c + 1}`}
                  {e.action !== "none" && (
                    <span className="tag">{actionLabel(e)}</span>
                  )}
                </span>
                <span className="wp-coords num">
                  {e.lat.toFixed(6)}
                  {", "}
                  {e.lon.toFixed(6)}
                </span>
              </span>
              <span
                className="wp-next num"
                title="Strecke und Kurs zum nächsten Wegpunkt"
              >
                {c < _ - 1
                  ? `weiter ${segments[c].dist.toFixed(0)} m, ${segments[c].brg.toFixed(0)}°`
                  : "Endpunkt"}
              </span>
              <CaretDownIcon
                size={18}
                className="wp-caret"
                aria-hidden="true"
              />
            </button>
            <div
              id={f}
              className="foldout"
              data-open={l ? "true" : "false"}
              inert={!l}
            >
              <div className="foldout-inner">
                <WaypointDetails
                  wp={e}
                  index={c}
                  defaultAltitude={n}
                  defaultGimbalPitch={defaultGimbalPitch}
                  customHeading={customHeading}
                  onUpdate={onUpdate}
                >
                  <div className="wp-actions">
                    <button
                      type="button"
                      onClick={() => h(c, -1)}
                      disabled={c === 0}
                      aria-label={`Wegpunkt ${c + 1} nach oben`}
                      className="btn btn-secondary btn-sm"
                    >
                      <ArrowUpIcon size={16} aria-hidden="true" />
                      {" Nach oben"}
                    </button>
                    <button
                      type="button"
                      onClick={() => h(c, 1)}
                      disabled={c === _ - 1}
                      aria-label={`Wegpunkt ${c + 1} nach unten`}
                      className="btn btn-secondary btn-sm"
                    >
                      <ArrowDownIcon size={16} aria-hidden="true" />
                      {" Nach unten"}
                    </button>
                    <button
                      type="button"
                      onClick={() => g(e, c)}
                      aria-label={`Wegpunkt ${c + 1} löschen`}
                      className="btn btn-danger btn-sm"
                    >
                      <TrashIcon size={16} aria-hidden="true" />
                      {" Löschen"}
                    </button>
                  </div>
                </WaypointDetails>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
