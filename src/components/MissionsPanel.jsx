// Liste der gespeicherten Missionen mit Speichern, Laden, Löschen und Team-Code.
import { useRef } from "react";
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  DownloadSimpleIcon,
  FloppyDiskIcon,
  FolderOpenIcon,
  LockKeyOpenIcon,
  NotePencilIcon,
  SignOutIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { missionStats } from "../lib/geo";
import { collapseOut } from "../lib/motion";
import { Popover, Field, Spinner, Tag } from "./ui";
import { MissionThumb } from "./MissionThumb";

const kmFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function MissionsPanel({
  open,
  onClose,
  triggerRef,
  missions: r,
  loading,
  isRemote,
  hasCode: o,
  codeInput: s,
  onCodeInput,
  codeBusy: disabled,
  onUnlock,
  onLogout,
  storageNotice: f,
  onRefresh,
  activeMissionId: m,
  hasActive,
  confirmDeleteId: g,
  onLoad,
  onDownload,
  onRequestDelete,
  onConfirmDelete,
  saveName: S,
  onSaveName,
  title,
  saveBusy: w,
  onSave,
  onSaveAsNew,
  saveMsg: D,
}) {
  let te = useRef(new Map()),
    O = useRef(new Set()),
    ne = async (e) => {
      if (O.current.has(e)) return;
      O.current.add(e);
      let t = r.findIndex((t) => t.id === e),
        n = (r[t + 1] ?? r[t - 1])?.id,
        i = collapseOut(te.current.get(e));
      await i.done;
      let a = await onConfirmDelete(e);
      if ((O.current.delete(e), !a)) {
        i.cancel();
        return;
      }
      requestAnimationFrame(() =>
        te.current.get(n)?.querySelector(".mrow-main")?.focus({
          preventScroll: true,
        }),
      );
    };
  return (
    <Popover
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      label="Missionen"
      className="switcher"
    >
      <div className="pop-head">
        <h2 className="pop-title">Missionen</h2>
        <button
          onClick={onRefresh}
          className="btn btn-quiet btn-sm"
          aria-label="Missionsliste aktualisieren"
        >
          <ArrowsClockwiseIcon
            size={16}
            className={loading ? "spin" : ""}
            aria-hidden="true"
          />
          {" Aktualisieren"}
        </button>
      </div>
      <div className="pop-block">
        {o ? (
          <div className="team-state">
            <div className="flex items-center gap-2 text-[14.5px]">
              <LockKeyOpenIcon
                size={18}
                aria-hidden="true"
                className="shrink-0"
              />
              {isRemote
                ? "Team-Zugang aktiv. Missionen sind geteilt."
                : "Team-Zugang gespeichert, der geteilte Speicher ist aber nicht verfügbar."}
            </div>
            <button onClick={onLogout} className="btn btn-quiet btn-sm">
              <SignOutIcon size={16} aria-hidden="true" />
              {" Abmelden"}
            </button>
          </div>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUnlock();
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <Field label="Team-Zugangscode" className="min-w-[180px] flex-1">
                <input
                  type="password"
                  name="team-code"
                  autoComplete="off"
                  value={s}
                  onChange={(e) => onCodeInput(e.target.value)}
                  placeholder="Zugangscode eingeben…"
                  className="field"
                />
              </Field>
              <button
                type="submit"
                disabled={disabled}
                className="btn btn-secondary"
              >
                {disabled ? (
                  <Spinner />
                ) : (
                  <LockKeyOpenIcon size={17} aria-hidden="true" />
                )}
                Freischalten
              </button>
            </form>
            <p className="hint mt-2.5">
              Ohne Code bleiben Missionen nur auf diesem Gerät. Der Code wird
              nur für geteilte Missionen gebraucht.
            </p>
          </>
        )}
        {f && (
          <p role="status" className="note mt-3" data-tone="warn">
            <WarningIcon size={17} aria-hidden="true" />
            <span>{f}</span>
          </p>
        )}
      </div>
      {loading ? (
        <div
          className="pop-block flex flex-col gap-2"
          role="status"
          aria-label="Lade gespeicherte Missionen…"
        >
          <div className="skeleton h-[64px]" />
          <div className="skeleton h-[64px]" />
        </div>
      ) : r.length === 0 ? (
        <div className="pop-block empty row-enter">
          <FolderOpenIcon size={26} aria-hidden="true" />
          <div>
            <div className="empty-title">
              Noch keine gespeicherten Missionen
            </div>
            <div className="hint">
              {isRemote
                ? "Alle mit Team-Zugang sehen dieselbe Liste."
                : "Missionen werden auf diesem Gerät gespeichert."}
            </div>
          </div>
        </div>
      ) : (
        <ul className="mlist">
          {r.map((e) => {
            let t = missionStats(e),
              n = g === e.id,
              r = e.id === m;
            return (
              <li
                key={e.id}
                ref={(t) =>
                  t ? te.current.set(e.id, t) : te.current.delete(e.id)
                }
                data-active={r}
                className="mrow"
              >
                <button
                  onClick={() => onLoad(e)}
                  className="mrow-main"
                  aria-label={`Mission „${e.name}“ laden`}
                >
                  <MissionThumb
                    waypoints={e.waypoints}
                    className="mrow-thumb"
                  />
                  <span className="min-w-0">
                    <span className="mrow-name">
                      <span className="truncate">{e.name}</span>
                      {r && <Tag>Aktiv</Tag>}
                    </span>
                    <span className="mrow-meta num">
                      {t.count}
                      {" Wegpunkte, "}
                      {kmFormat.format(t.totalDistance / 1e3)}
                      {"\xA0km, "}
                      {dateFormat.format(new Date(e.savedAt))}
                    </span>
                  </span>
                </button>
                <div className="mrow-tools">
                  <button
                    onClick={() => onDownload(e)}
                    aria-label={`CSV von „${e.name}“ herunterladen`}
                    title="Herunterladen"
                    className="btn btn-icon"
                  >
                    <DownloadSimpleIcon size={18} aria-hidden="true" />
                  </button>
                  {n ? (
                    <button
                      onClick={() => ne(e.id)}
                      aria-label={`Löschen von „${e.name}“ bestätigen`}
                      className="btn btn-sm btn-confirm"
                    >
                      <CheckIcon size={16} aria-hidden="true" />
                      {" Löschen?"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onRequestDelete(e.id)}
                      aria-label={`Mission „${e.name}“ löschen`}
                      title="Löschen"
                      className="btn btn-icon"
                    >
                      <TrashIcon size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pop-block pop-save">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label={
              hasActive
                ? "Name (überschreibt aktive Mission)"
                : "Name für Speichern"
            }
            className="min-w-[180px] flex-1"
          >
            <input
              value={S}
              onChange={(e) => onSaveName(e.target.value)}
              name="mission-name"
              autoComplete="off"
              placeholder={title}
              className="field"
            />
          </Field>
          <button onClick={onSave} disabled={w} className="btn btn-primary">
            {w ? <Spinner /> : <FloppyDiskIcon size={17} aria-hidden="true" />}
            {hasActive ? "Aktualisieren" : "Speichern"}
          </button>
          {hasActive && (
            <button onClick={onSaveAsNew} className="btn btn-secondary">
              <NotePencilIcon size={17} aria-hidden="true" />
              {" Als neu speichern"}
            </button>
          )}
        </div>
        {D && (
          <p
            role="status"
            className={`mt-3 text-[14px] ${D.type === "ok" ? "font-medium" : "note"}`}
            data-tone={D.type === "ok" ? undefined : "error"}
          >
            {D.type === "ok" ? (
              <CheckIcon
                size={16}
                aria-hidden="true"
                className="mr-1.5 inline align-[-3px]"
              />
            ) : (
              <WarningIcon size={17} aria-hidden="true" />
            )}
            <span>{D.text}</span>
          </p>
        )}
      </div>
    </Popover>
  );
}
