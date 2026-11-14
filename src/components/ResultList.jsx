// Erkannte Koordinaten eines Bildes oder Videos mit Bewertung und „Hinzufügen“.
import { useEffect, useMemo, useRef, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { foldOut } from "../lib/motion";
import { AddButton, FoldIn } from "./ui";
import { formatClock } from "../lib/videoPlan";
import {
  confidenceInfo,
  distanceFromStartKm,
  judgeAgainstRoute,
  resultKey,
} from "../lib/trackCheck";

const intFormat = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

function ResultRow({
  result,
  waypoints: t,
  leaving = false,
  onAdd,
  onAddValue,
  onGone,
}) {
  let o = useRef(null);
  useEffect(() => {
    leaving && foldOut(o.current).done.then(onGone);
  }, [leaving]);
  let s = confidenceInfo(result),
    c = distanceFromStartKm(result, t),
    l = useMemo(
      () => (result.fix || !onAddValue ? null : judgeAgainstRoute(result, t)),
      [result, t, onAddValue],
    ),
    u = !l && c !== null && c > 100;
  return (
    <li ref={o} className="ocr-result row-enter">
      <div className="ocr-result-main">
        <div className="num ocr-coords">
          {result.lat.toFixed(6)}
          {", "}
          {result.lon.toFixed(6)}
          {typeof result.heading == "number" ? `, ${result.heading}°` : ""}
          {result.label ? (
            <span className="ocr-label"> {result.label}</span>
          ) : null}
        </div>
        {result.fix && (
          <div className="ocr-info">
            {result.fix.kind === "alt"
              ? "Ein zweiter Lesedurchgang passt zu den Nachbarbildern und wurde übernommen"
              : "Eine verlesene Ziffer wurde anhand der Nachbarbilder korrigiert"}{" "}
            {"(zuerst gelesen: "}
            <span className="num">
              {result.fix.from.lat.toFixed(6)}
              {", "}
              {result.fix.from.lon.toFixed(6)}
            </span>
            ).
          </div>
        )}
        {typeof result.altitude == "number" && (
          <div className="ocr-info">
            {"Höhe im Bild: "}
            {result.altitude}
            {"\xA0m. Übernommen wird die Standardhöhe der Mission."}
          </div>
        )}
        <div className="ocr-meta">
          {typeof result.frameTime == "number" && (
            <span>
              {"Bild bei "}
              {formatClock(result.frameTime)}
            </span>
          )}
          <span className="qual" data-level={s.level}>
            <i aria-hidden="true" />
            {s.label}
          </span>
          <span className="ocr-source">
            {"Gelesen: "}
            <q className="num">{result.source}</q>
          </span>
        </div>
        {result.alternatives?.length > 0 && (
          <p className="note" data-tone="warn" role="note">
            <WarningIcon size={17} aria-hidden="true" />
            <span>
              Ein anderer Durchgang las abweichend:{" "}
              <span className="num">
                {result.alternatives
                  .map((e) => `${e.lat.toFixed(6)}, ${e.lon.toFixed(6)}`)
                  .join(" oder ")}
              </span>
              . Bitte mit dem Bild vergleichen.
            </span>
          </p>
        )}
        {l && (
          <div className="note suggest" data-tone="warn" role="note">
            <WarningIcon size={17} aria-hidden="true" />
            <div className="min-w-0">
              <p>
                {"Liegt "}
                {intFormat.format(l.off / 1e3)}
                {
                  "\xA0km neben der bisherigen Strecke. Vermutlich ist eine Ziffer verlesen:"
                }{" "}
                <span className="num font-semibold">
                  {l.lat.toFixed(6)}
                  {", "}
                  {l.lon.toFixed(6)}
                </span>{" "}
                passt zur Strecke.
              </p>
              <AddButton
                onClick={() =>
                  onAddValue({
                    ...result,
                    lat: l.lat,
                    lon: l.lon,
                  })
                }
                label="Korrigiert hinzufügen"
                className="btn-secondary btn-sm mt-2"
              />
            </div>
          </div>
        )}
        {u && (
          <p className="note" data-tone="warn" role="note">
            <WarningIcon size={17} aria-hidden="true" />
            <span>
              {"Liegt "}
              {intFormat.format(c)}
              {
                "\xA0km vom ersten Wegpunkt entfernt. Möglicherweise falsch gelesen."
              }
            </span>
          </p>
        )}
      </div>
      <AddButton
        onClick={onAdd}
        className="btn-secondary btn-sm ocr-add shrink-0"
      />
    </li>
  );
}

function useLeaving() {
  let [e, t] = useState(() => new Set());
  return {
    leaving: e,
    start: (e) =>
      t((t) => {
        let n = new Set(t);
        e.forEach((e) => n.add(e));
        return n;
      }),
    end: (e) =>
      t((t) => {
        let n = new Set(t);
        n.delete(e);
        return n;
      }),
  };
}

const plural = (e, t, n) => `${e} ${e === 1 ? t : n}`;

export function ResultList({
  cardId,
  results,
  waypoints: n,
  addedWp,
  onAdd,
  onAddAll,
  className = "",
}) {
  let { leaving, start, end } = useLeaving(),
    u = (t) => resultKey(cardId, t),
    d = results.filter((e) => !addedWp(u(e))),
    f = results.length - d.length,
    p = results.filter((e) => !addedWp(u(e)) || leaving.has(u(e))),
    m = (e, t = e) => {
      start([u(e)]);
      onAdd(u(e), t);
    };
  return (
    <div className={className}>
      {f > 0 && (
        <FoldIn as="p" role="status" className="hint">
          {d.length === 0
            ? `Alle ${f} Punkte übernommen.`
            : `${plural(f, "Punkt", "Punkte")} übernommen.`}
          {
            " Sie stehen unten bei den Wegpunkten und lassen sich dort bearbeiten."
          }
        </FoldIn>
      )}
      {results.length > 1 && (
        <AddButton
          onClick={() => {
            start(d.map(u));
            onAddAll(cardId, results);
          }}
          done={d.length === 0}
          label={
            f > 0
              ? `Die übrigen ${d.length} hinzufügen`
              : `Alle ${d.length} hinzufügen`
          }
          doneLabel={`Alle ${results.length} hinzugefügt`}
          iconSize={16}
          className="btn-primary btn-sm self-start"
        />
      )}
      <ul className="ocr-results">
        {p.map((e) => (
          <ResultRow
            key={u(e)}
            result={e}
            waypoints={n}
            leaving={leaving.has(u(e))}
            onGone={() => end(u(e))}
            onAdd={() => m(e)}
            onAddValue={(t) => m(e, t)}
          />
        ))}
      </ul>
    </div>
  );
}
