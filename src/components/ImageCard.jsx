// Karte für ein hochgeladenes Bild.
import { useRef } from "react";
import { InfoIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { clearRowEnter, leaveThenRemove } from "../lib/motion";
import { Spinner } from "./ui";
import { progressLabel, progressFraction } from "../lib/videoPlan";
import { ResultList } from "./ResultList";

export function ImageCard({
  img,
  waypoints: t,
  onRecognize,
  onRemove,
  addedWp,
  onAdd,
  onAddAll,
}) {
  let s = useRef(null);
  return (
    <li
      ref={s}
      className="ledger-row row-enter flex gap-4 py-5"
      onAnimationEnd={clearRowEnter}
    >
      <img
        src={img.dataUrl}
        alt={`Vorschau von ${img.name}`}
        width={72}
        height={72}
        loading="lazy"
        className="thumb size-[72px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="num truncate text-[12.5px] text-ink-2">
            {img.name}
          </span>
          <button
            onClick={() => leaveThenRemove(s.current, onRemove)}
            aria-label={`Bild ${img.name} entfernen`}
            className="btn btn-icon-bare -mr-1.5 -mt-1"
          >
            <TrashIcon size={17} aria-hidden="true" />
          </button>
        </div>
        {img.status === "idle" && (
          <button
            onClick={onRecognize}
            className="btn btn-secondary btn-sm mt-1.5"
          >
            Koordinaten erkennen
          </button>
        )}
        {img.status === "processing" && (
          <div role="status" className="mt-2">
            <div className="flex items-center gap-2 text-[14px] text-ink-2">
              <Spinner size={15} /> {progressLabel(img.progress)}
            </div>
            <div className="progress mt-2" aria-hidden="true">
              <span
                style={{
                  transform: `scaleX(${progressFraction(img.progress)})`,
                }}
              />
            </div>
          </div>
        )}
        {img.status === "error" && (
          <div role="alert" className="note mt-2" data-tone="error">
            <WarningIcon size={17} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {img.error}{" "}
              <button
                onClick={onRecognize}
                className="underline underline-offset-2"
              >
                Erneut versuchen
              </button>
            </span>
          </div>
        )}
        {img.status === "done" && img.results && img.results.length > 0 && (
          <ResultList
            className="mt-2 flex flex-col gap-2.5"
            cardId={img.id}
            results={img.results}
            waypoints={t}
            addedWp={addedWp}
            onAdd={onAdd}
            onAddAll={onAddAll}
          />
        )}
        {img.status === "done" &&
          (!img.results || img.results.length === 0) && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="note" data-tone="warn">
                <InfoIcon size={17} aria-hidden="true" />
                <span>
                  Keine Koordinaten gefunden. Sind sie im Bild als Text
                  sichtbar? Sonst hilft ein Ausschnitt mit den Koordinaten.
                </span>
              </p>
              {img.results?.rawTexts?.some((e) => e.trim()) && (
                <details className="text-[13.5px] text-ink-2">
                  <summary className="cursor-pointer underline underline-offset-2">
                    Was die Erkennung gelesen hat
                  </summary>
                  <pre className="num mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--r-field)] bg-sheet-2 p-3 text-[13.5px]">
                    {img.results.rawTexts[0].trim()}
                  </pre>
                </details>
              )}
            </div>
          )}
      </div>
    </li>
  );
}
