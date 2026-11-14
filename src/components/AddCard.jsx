// Karte zum Hinzufügen: Dateien wählen oder ablegen, Koordinate eintippen.
import { useRef, useState } from "react";
import { PlusIcon, WarningIcon } from "@phosphor-icons/react";
import { Field } from "./ui";

function AddCardArt() {
  return (
    <svg
      viewBox="0 0 168 128"
      className="addcard-art"
      aria-hidden="true"
      fill="none"
    >
      <g transform="rotate(-9 60 66)">
        <rect
          x="14"
          y="28"
          width="86"
          height="68"
          rx="14"
          fill="#0b0d0f"
          opacity="0.28"
        />
      </g>
      <g transform="rotate(7 100 64)">
        <rect x="52" y="20" width="92" height="76" rx="16" fill="#0b0d0f" />
        <path
          d="M60 84 L84 58 L100 74 L112 62 L136 84 Z"
          fill="#ffffff"
          opacity="0.92"
        />
        <circle cx="120" cy="40" r="7" fill="var(--accent)" />
      </g>
      <g transform="translate(112 74)">
        <circle cx="16" cy="40" r="5" fill="#0b0d0f" opacity="0.28" />
        <path
          d="M16 38 C6 26 4 18 4 13 a12 12 0 0 1 24 0 c0 5 -2 13 -12 25Z"
          fill="#ffffff"
          stroke="#0b0d0f"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="13" r="4.5" fill="#0b0d0f" />
      </g>
    </svg>
  );
}

export function AddCard({
  onPick,
  onFiles,
  form: n,
  onForm,
  onAdd,
  error,
  latRef: o,
}) {
  let [s, c] = useState(false),
    l = useRef(0),
    u = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
  return (
    <div>
      <div
        className="addcard"
        data-over={s ? "true" : undefined}
        onDragEnter={(e) => {
          u(e) && (e.preventDefault(), (l.current += 1), c(true));
        }}
        onDragOver={(e) => {
          u(e) && (e.preventDefault(), (e.dataTransfer.dropEffect = "copy"));
        }}
        onDragLeave={() => {
          l.current = Math.max(0, l.current - 1);
          l.current === 0 && c(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          l.current = 0;
          c(false);
          e.dataTransfer?.files?.length && onFiles(e.dataTransfer.files);
        }}
      >
        <div className="addcard-main">
          <h3 className="addcard-title">
            {s ? "Zum Hinzufügen loslassen" : "Bilder oder Video hinzufügen"}
          </h3>
          <p className="addcard-text">
            Screenshots, Fotos oder ein Video mit sichtbaren GPS-Koordinaten.
            Die Erkennung läuft auf diesem Gerät, nichts wird hochgeladen.
          </p>
          <button
            type="button"
            className="btn btn-dark btn-lg"
            onClick={onPick}
          >
            Datei wählen
          </button>
        </div>
        <AddCardArt />
      </div>
      <form
        className="manual"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <h3 className="manual-title">Oder Koordinate eintippen</h3>
        <div className="manual-row">
          <Field label="Breite (lat)" className="manual-field">
            <input
              ref={o}
              type="number"
              step="0.000001"
              name="lat"
              autoComplete="off"
              placeholder="z. B. 53.551086"
              value={n.lat}
              className="field field-mono"
              onChange={(e) =>
                onForm((t) => ({
                  ...t,
                  lat: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Länge (lon)" className="manual-field">
            <input
              type="number"
              step="0.000001"
              name="lon"
              autoComplete="off"
              placeholder="z. B. 9.993682"
              value={n.lon}
              className="field field-mono"
              onChange={(e) =>
                onForm((t) => ({
                  ...t,
                  lon: e.target.value,
                }))
              }
            />
          </Field>
          <button type="submit" className="btn btn-secondary">
            <PlusIcon size={17} aria-hidden="true" />
            {" Hinzufügen"}
          </button>
        </div>
        {error && (
          <p role="alert" className="note mt-3" data-tone="error">
            <WarningIcon size={17} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </form>
    </div>
  );
}
