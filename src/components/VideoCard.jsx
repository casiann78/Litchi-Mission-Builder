// Karte für ein hochgeladenes Video.
import { useRef } from "react";
import {
  InfoIcon,
  TrashIcon,
  VideoCameraIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { clearRowEnter, leaveThenRemove } from "../lib/motion";
import { Spinner, Segmented } from "./ui";
import {
  FRAME_INTERVALS,
  planFrameTimes,
  progressFraction,
  formatClock,
  nearestInterval,
  estimateDuration,
  progressLabel,
} from "../lib/videoPlan";
import { ResultList } from "./ResultList";

const pluralize = (e, t, n) => `${e} ${e === 1 ? t : n}`;

const INTERVAL_OPTIONS = FRAME_INTERVALS.map((e) => ({
  id: e,
  label: `${e} s`,
  ariaLabel: `${e} Sekunden`,
}));

function videoSummary(e, t) {
  let n = [
    `${e.done} von ${pluralize(e.total, "Bild", "Bildern")} gelesen`,
    pluralize(e.points, "Punkt", "Punkte"),
  ];
  e.merged && n.push(`${e.merged} identische zusammengefasst`);
  e.fixed &&
    n.push(
      `${pluralize(e.fixed, "verlesene Ziffer", "verlesene Ziffern")} anhand der Nachbarbilder korrigiert`,
    );
  e.rejected &&
    n.push(
      `${pluralize(e.rejected, "Lesung passte", "Lesungen passten")} nicht zur Strecke und ${e.rejected === 1 ? "wurde" : "wurden"} verworfen`,
    );
  e.rescued &&
    n.push(
      `${pluralize(e.rescued, "Bild", "Bilder")} erst mit einem Nachbarbild lesbar`,
    );
  e.checked &&
    n.push(
      `${pluralize(e.checked, "Kontrollbild", "Kontrollbilder")} am Anfang oder Ende gelesen`,
    );
  e.empty &&
    n.push(`in ${pluralize(e.empty, "Bild", "Bildern")} nichts erkannt`);
  e.failed && n.push(`${pluralize(e.failed, "Bild", "Bilder")} nicht lesbar`);
  return `${t === "stopped" ? "Abgebrochen. " : ""}${n.join(", ")}.`;
}

export function VideoCard({
  video,
  waypoints: t,
  onInterval,
  onStart,
  onCancel,
  onRemove,
  addedWp,
  onAdd,
  onAddAll,
}) {
  let l = useRef(null),
    { status, stats, progress } = video,
    p = video.duration ? planFrameTimes(video.duration, video.interval) : null,
    m =
      status === "idle" ||
      status === "done" ||
      status === "stopped" ||
      (status === "error" && !!video.duration),
    h =
      stats && stats.total
        ? Math.min(
            1,
            (stats.done +
              (progress?.ocr ? progressFraction(progress.ocr) : 0.03)) /
              stats.total,
          )
        : 0;
  return (
    <li
      ref={l}
      className="ledger-row row-enter py-5"
      onAnimationEnd={clearRowEnter}
    >
      <div className="flex gap-4">
        <span
          className="thumb-scan"
          data-active={status === "processing" ? "true" : undefined}
        >
          {video.poster ? (
            <img
              src={video.poster}
              alt={`Vorschau von ${video.name}`}
              width={112}
              height={63}
              className="thumb h-[63px] w-[112px]"
            />
          ) : (
            <div
              className="thumb grid h-[63px] w-[112px] place-items-center text-ink-3"
              aria-hidden="true"
            >
              <VideoCameraIcon size={26} />
            </div>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="num truncate text-[13.5px] text-ink-2">
              {video.name}
            </span>
            <button
              onClick={() => leaveThenRemove(l.current, onRemove)}
              aria-label={`Video ${video.name} entfernen`}
              className="btn btn-icon-bare -mr-1.5 -mt-1.5"
            >
              <TrashIcon size={18} aria-hidden="true" />
            </button>
          </div>
          {video.duration ? (
            <div className="num mt-0.5 flex items-center gap-1.5 text-[13.5px] text-ink-2">
              <VideoCameraIcon size={16} aria-hidden="true" />
              {formatClock(video.duration)}
              {" min"}
              {video.width ? `, ${video.width} × ${video.height}` : ""}
            </div>
          ) : null}
        </div>
      </div>
      {status === "loading" && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 text-[14.5px] text-ink-2"
        >
          <Spinner size={15} />
          {" Video wird geöffnet…"}
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="note mt-3" data-tone="error">
          <WarningIcon size={17} aria-hidden="true" />
          <span className="min-w-0 flex-1">{video.error}</span>
        </div>
      )}
      {m && p && (
        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="label" aria-hidden="true">
              Ein Bild alle
            </span>
            <Segmented
              className="seg--inline"
              label="Ein Standbild alle"
              options={INTERVAL_OPTIONS}
              value={nearestInterval(video.interval)}
              onChange={onInterval}
            />
          </div>
          <button onClick={onStart} className="btn btn-primary">
            {status === "idle" ? "Video auswerten" : "Erneut auswerten"}
          </button>
          <p className="hint min-w-[12rem] flex-1">
            {pluralize(p.count, "Bild", "Bilder")}
            {" aus "}
            {formatClock(video.duration)}
            {" min, Rechenzeit "}
            {estimateDuration(p.count)}.
            {p.capped
              ? ` Mehr als 40 Bilder werden nicht gelesen, deshalb liegt ein Bild alle ${Math.round(p.interval)} s, damit das ganze Video abgedeckt ist.`
              : ""}
          </p>
        </div>
      )}
      {status === "processing" && stats && (
        <div role="status" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2 text-[14.5px] text-ink-2">
              <Spinner size={15} />
              <span className="min-w-0">
                <span className="num font-semibold text-ink">
                  {"Bild "}
                  {Math.min(stats.done + 1, stats.total)}
                  {" von "}
                  {stats.total}
                </span>
                {progress
                  ? `, bei ${formatClock(progress.time)}${progress.retry ? " (zweiter Versuch mit einem Nachbarbild)" : progress.check ? " (Kontrollbild)" : ""}. `
                  : ". "}
                {progressLabel(progress?.ocr)}
              </span>
            </div>
            <button onClick={onCancel} className="btn btn-secondary btn-sm">
              Abbrechen
            </button>
          </div>
          <div className="progress mt-3" aria-hidden="true">
            <span
              style={{
                transform: `scaleX(${h})`,
              }}
            />
          </div>
          <p className="hint mt-2">
            Jeder Punkt wird mit den Bildern davor und danach abgeglichen und
            erscheint deshalb etwas später (der erste nach fünf Bildern).
            Abbrechen wirkt nach dem Bild, das gerade gelesen wird.
          </p>
        </div>
      )}
      {(status === "done" || status === "stopped") && stats && (
        <p role="status" className="hint mt-3">
          {videoSummary(stats, status)}
        </p>
      )}
      {status === "done" && stats && stats.points === 0 && (
        <p className="note mt-3" data-tone="warn">
          <InfoIcon size={17} aria-hidden="true" />
          <span>
            Keine Koordinaten gefunden. Sind sie im Video als Text eingeblendet?
            Sonst hilft ein Standbild oder ein Ausschnitt, der die Koordinaten
            zeigt.
          </span>
        </p>
      )}
      {video.results.length > 0 && (
        <ResultList
          className="mt-4 flex flex-col gap-3"
          cardId={video.id}
          results={video.results}
          waypoints={t}
          addedWp={addedWp}
          onAdd={onAdd}
          onAddAll={onAddAll}
        />
      )}
    </li>
  );
}
