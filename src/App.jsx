// Hauptkomponente: Zustand der Mission, Datei-Upload, Speichern und Seitenaufbau.
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowRightIcon,
  CaretDownIcon,
  CaretUpDownIcon,
  CheckIcon,
  FloppyDiskIcon,
  IconContext,
  ImagesSquareIcon,
  InfoIcon,
  LockKeyIcon,
  MapPinPlusIcon,
  NotePencilIcon,
  PlusIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { computeLegs, toRad } from "./lib/geo";
import { downloadCsv, missionToCsv } from "./lib/litchiCsv";
import { recognizeImage } from "./lib/ocr";
import {
  loadMissions,
  getTeamCode,
  setTeamCode,
  clearTeamCode,
  saveMission,
  deleteMission,
} from "./lib/missionStore";
import { missionAccent, ACCENTS } from "./lib/accents";
import { isMapMode, DEFAULT_MAP_MODE } from "./lib/mapLayers";
import { prefersReducedMotion } from "./lib/motion";
import {
  Logo,
  Popover,
  Odometer,
  Tag,
  AccentPicker,
  Reveal,
} from "./components/ui";
import { RouteMap } from "./components/RouteMap";
import { MissionsPanel } from "./components/MissionsPanel";
import {
  FINISH_ACTIONS,
  MissionStats,
  AdvancedSettings,
} from "./components/MissionSettings";
import { AddCard } from "./components/AddCard";
import { isVideoFile } from "./lib/videoPlan";
import { resultKey } from "./lib/trackCheck";
import { ImageCard } from "./components/ImageCard";
import { VideoCard } from "./components/VideoCard";
import { WaypointList } from "./components/WaypointList";
import { BottomSheet } from "./components/BottomSheet";
import { useVideos } from "./hooks/useVideos";

function withViewTransition(e) {
  if (
    typeof document > "u" ||
    typeof document.startViewTransition != "function" ||
    prefersReducedMotion()
  ) {
    e();
    return;
  }
  document.startViewTransition(() => flushSync(e));
}

let idCounter = 1;

const nextId = () => idCounter++;

const distanceFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const savedAtFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function App() {
  let [missionName, setMissionName] = useState("Neue Drohnenstrecke"),
    [defaultAltitude, setDefaultAltitude] = useState(50),
    [defaultSpeed, setDefaultSpeed] = useState(8),
    [curveSize, setCurveSize] = useState(0),
    [rotationDir, setRotationDir] = useState(0),
    [gimbalMode, setGimbalMode] = useState(2),
    [gimbalPitch, setGimbalPitch] = useState(-30),
    [altitudeMode, setAltitudeMode] = useState(0),
    [headingMode, setHeadingMode] = useState("auto"),
    [fixedHeading, setFixedHeading] = useState(0),
    [finishAction, setFinishAction] = useState("none"),
    [accent, setAccent] = useState(0),
    [selectedId, setSelectedId] = useState(null),
    [fitKey, setFitKey] = useState(0),
    [missionsOpen, setMissionsOpen] = useState(false),
    [addOpen, setAddOpen] = useState(false),
    missionsTriggerRef = useRef(null),
    addTriggerRef = useRef(null),
    latRef = useRef(null),
    sheetRef = useRef(null),
    [sheetLayout, setSheetLayout] = useState(null),
    [mapMode, setMapMode] = useState(() => {
      try {
        let e = localStorage.getItem("litchi.mapMode");
        return isMapMode(e) ? e : DEFAULT_MAP_MODE;
      } catch {
        return DEFAULT_MAP_MODE;
      }
    }),
    [mapUnavailable, setMapUnavailable] = useState(false),
    activeMapMode = mapUnavailable ? "sketch" : mapMode,
    handleModeChange = (e) => {
      setMapUnavailable(false);
      setMapMode(e);
      try {
        localStorage.setItem("litchi.mapMode", e);
      } catch {}
    },
    [waypoints, setWaypoints] = useState(() => []),
    waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;
  let [form, setForm] = useState({
      lat: "",
      lon: "",
    }),
    [formError, setFormError] = useState(""),
    [settingsOpen, setSettingsOpen] = useState(() => {
      try {
        return localStorage.getItem("litchi.settingsOpen") === "1";
      } catch {
        return false;
      }
    }),
    toggleSettings = () =>
      setSettingsOpen((e) => {
        try {
          localStorage.setItem("litchi.settingsOpen", e ? "0" : "1");
        } catch {}
        return !e;
      }),
    [images, setImages] = useState([]),
    fileInputRef = useRef(null),
    [uploadNotice, setUploadNotice] = useState(""),
    videoStore = useVideos(),
    [missions, setMissions] = useState([]),
    [missionsLoading, setMissionsLoading] = useState(true),
    [saveName, setSaveName] = useState(""),
    [saveBusy, setSaveBusy] = useState(false),
    [saveMsg, setSaveMsg] = useState(null),
    [activeMissionId, setActiveMissionId] = useState(null),
    [storageMode, setStorageMode] = useState("local"),
    [storageNotice, setStorageNotice] = useState(null),
    [hasCode, setHasCode] = useState(false),
    [codeInput, setCodeInput] = useState(""),
    [codeBusy, setCodeBusy] = useState(false),
    [confirmDeleteId, setConfirmDeleteId] = useState(null),
    [lastRemoved, setLastRemoved] = useState(null),
    [savedSnapshot, setSavedSnapshot] = useState(null),
    markSavedRef = useRef(false),
    it = !!(activeMissionId && missions.some((e) => e.id === activeMissionId)),
    handleRefresh = async () => {
      setMissionsLoading(true);
      try {
        let e = await loadMissions();
        setMissions(Array.isArray(e.missions) ? e.missions : []);
        setStorageMode(e.mode);
        setStorageNotice(e.notice);
      } catch {
        setMissions([]);
      } finally {
        setHasCode(!!getTeamCode());
        setMissionsLoading(false);
      }
    };
  useEffect(() => {
    handleRefresh();
  }, []);
  useEffect(() => {
    if (!confirmDeleteId) return;
    let e = setTimeout(() => setConfirmDeleteId(null), 4e3);
    return () => clearTimeout(e);
  }, [confirmDeleteId]);
  let handleUnlock = async () => {
      let e = codeInput.trim();
      if (!e) {
        setStorageNotice("Bitte den Team-Zugangscode eingeben.");
        return;
      }
      setCodeBusy(true);
      setTeamCode(e);
      setCodeInput("");
      setActiveMissionId(null);
      setSaveMsg(null);
      await handleRefresh();
      setCodeBusy(false);
    },
    handleLogout = async () => {
      clearTeamCode();
      setActiveMissionId(null);
      setSaveMsg(null);
      await handleRefresh();
    },
    dt = (e, t, n) => {
      let r = nextId();
      setWaypoints((i) => [
        ...i,
        {
          id: r,
          lat: e,
          lon: t,
          altitude: null,
          heading: typeof n == "number" && !Number.isNaN(n) ? n : 0,
          gimbalPitch: null,
          action: "none",
          actionParam: 0,
        },
      ]);
      return r;
    },
    ft = (e, t) => dt(e, t, null),
    handleAdd = () => {
      let e = parseFloat(form.lat),
        t = parseFloat(form.lon);
      if (Number.isNaN(e) || Number.isNaN(t)) {
        setFormError("Bitte gültige Breiten- und Längengrade eingeben.");
        return;
      }
      if (e < -90 || e > 90 || t < -180 || t > 180) {
        setFormError(
          "Breite von −90 bis 90 und Länge von −180 bis 180 eingeben.",
        );
        return;
      }
      setFormError("");
      ft(e, t);
      setForm({
        lat: "",
        lon: "",
      });
    },
    handleUpdate = (e, t, n) => {
      setWaypoints((r) =>
        r.map((r) =>
          r.id === e
            ? {
                ...r,
                [t]: n,
              }
            : r,
        ),
      );
    },
    ht = (e) => setWaypoints((t) => t.filter((t) => t.id !== e)),
    handleRemove = (e) => {
      let t = waypointsRef.current.findIndex((t) => t.id === e);
      if (t < 0) return;
      let n = waypointsRef.current[t];
      ht(e);
      setSelectedId((t) => (t === e ? null : t));
      setLastRemoved({
        wp: n,
        index: t,
      });
    },
    vt = () => {
      if (!lastRemoved) return;
      let { wp, index } = lastRemoved;
      setWaypoints((n) => {
        let r = [...n];
        r.splice(Math.min(index, r.length), 0, wp);
        return r;
      });
      setLastRemoved(null);
    },
    handleMove = (e, t) => {
      setWaypoints((n) => {
        let r = [...n],
          i = e + t;
        return i < 0 || i >= r.length ? n : (([r[e], r[i]] = [r[i], r[e]]), r);
      });
    },
    handleFiles = async (e) => {
      let t = Array.from(e || []);
      if (t.length === 0) return;
      let n = t.filter(isVideoFile),
        r = t.filter(
          (e) => !isVideoFile(e) && (!e.type || e.type.startsWith("image/")),
        ),
        i = t.length - n.length - r.length;
      if (
        (setUploadNotice(
          i > 0
            ? `${i === 1 ? "Eine Datei wurde" : `${i} Dateien wurden`} übersprungen: nur Bilder und Videos werden gelesen.`
            : "",
        ),
        n.length > 0 && videoStore.addFiles(n),
        r.length === 0)
      )
        return;
      let a = [];
      for (let file of r) {
        let dataUrl = await new Promise((t) => {
          let n = new FileReader();
          n.onload = () => t(n.result);
          n.readAsDataURL(file);
        });
        a.push({
          id: nextId(),
          name: file.name,
          file: file,
          dataUrl: dataUrl,
          status: "idle",
          results: null,
          error: null,
        });
      }
      setImages((e) => [...e, ...a]);
    },
    St = async (e) => {
      setImages((t) =>
        t.map((t) =>
          t.id === e
            ? {
                ...t,
                status: "processing",
                error: null,
              }
            : t,
        ),
      );
      let t =
        images.find((t) => t.id === e) ||
        (await new Promise((t) => {
          setImages((n) => (t(n.find((t) => t.id === e)), n));
        }));
      try {
        let n = await recognizeImage(t.file, (t) =>
          setImages((n) =>
            n.map((n) =>
              n.id === e
                ? {
                    ...n,
                    progress: t,
                  }
                : n,
            ),
          ),
        );
        setImages((t) =>
          t.map((t) =>
            t.id === e
              ? {
                  ...t,
                  status: "done",
                  results: n,
                  error: n.length === 0 ? "Keine Koordinaten gefunden." : null,
                }
              : t,
          ),
        );
      } catch (t) {
        setImages((n) =>
          n.map((n) =>
            n.id === e
              ? {
                  ...n,
                  status: "error",
                  error: t.message || "Fehler bei der Erkennung.",
                }
              : n,
          ),
        );
      }
    },
    z = () => {
      images
        .filter((e) => e.status === "idle" || e.status === "error")
        .forEach((e) => St(e.id));
    },
    [addedByCard, setAddedByCard] = useState({}),
    Tt = (e) => {
      let t = addedByCard[e];
      return t === undefined
        ? null
        : (waypoints.find((e) => e.id === t) ?? null);
    },
    Et = (e, t) => {
      if (Tt(e)) return;
      let n = dt(t.lat, t.lon, t.heading);
      setAddedByCard((t) => ({
        ...t,
        [e]: n,
      }));
    },
    handleAddAll = (e, t) => {
      let n = {};
      t.forEach((t) => {
        Tt(resultKey(e, t)) ||
          (n[resultKey(e, t)] = dt(t.lat, t.lon, t.heading));
      });
      setAddedByCard((e) => ({
        ...e,
        ...n,
      }));
    },
    Dt = (e) => setImages((t) => t.filter((t) => t.id !== e)),
    Ot = (e) => ({
      name: e,
      defaultAltitude: defaultAltitude,
      defaultSpeed: defaultSpeed,
      curveSize: curveSize,
      rotationDir: rotationDir,
      gimbalMode: gimbalMode,
      defaultGimbalPitch: gimbalPitch,
      altitudeMode: altitudeMode,
      headingMode: headingMode,
      fixedHeading: fixedHeading,
      finishAction: finishAction,
      accent: accent,
      waypoints: waypoints.map(({ id, ...t }) => t),
    }),
    handleSave = async () => {
      let t = saveName.trim() || missionName.trim();
      if (!t) {
        setSaveMsg({
          type: "error",
          text: "Bitte einen Namen für die Mission angeben.",
        });
        return;
      }
      if (waypoints.length === 0) {
        setSaveMsg({
          type: "error",
          text: "Mission hat noch keine Wegpunkte. Füge zuerst Punkte hinzu.",
        });
        return;
      }
      setSaveBusy(true);
      setSaveMsg(null);
      try {
        let e = it,
          n = {
            ...Ot(t),
            id: e
              ? activeMissionId
              : `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          },
          r = await saveMission(storageMode, n);
        markSavedRef.current = true;
        e
          ? setMissions((e) => e.map((e) => (e.id === r.id ? r : e)))
          : (setMissions((e) => [...e, r]), setActiveMissionId(r.id));
        setSaveMsg({
          type: "ok",
          text: e ? "Aktualisiert." : "Gespeichert.",
        });
      } catch (e) {
        setSaveMsg({
          type: "error",
          text: e.status
            ? e.message
            : "Speichern fehlgeschlagen. Prüfe die Verbindung und versuche es erneut.",
        });
        e.status === 401 && (await handleRefresh());
      } finally {
        setSaveBusy(false);
      }
    },
    At = (e) => {
      setMissionName(e.name);
      setDefaultAltitude(e.defaultAltitude);
      setDefaultSpeed(e.defaultSpeed);
      setCurveSize(e.curveSize);
      setRotationDir(e.rotationDir);
      setGimbalMode(e.gimbalMode);
      setGimbalPitch(e.defaultGimbalPitch);
      setAltitudeMode(e.altitudeMode);
      setHeadingMode(e.headingMode);
      setFixedHeading(e.fixedHeading);
      setFinishAction(e.finishAction || "none");
      setAccent(missionAccent(e));
      setSelectedId(null);
      setFitKey((e) => e + 1);
      setWaypoints(
        (e.waypoints || []).map((e) => ({
          ...e,
          id: nextId(),
        })),
      );
      markSavedRef.current = true;
      setLastRemoved(null);
      setActiveMissionId(e.id);
      setSaveName(e.name);
      setSaveMsg(null);
    },
    Mt = async (e) => {
      try {
        await deleteMission(storageMode, e);
        setMissions((t) => t.filter((t) => t.id !== e));
        setActiveMissionId((t) => (t === e ? null : t));
        return true;
      } catch (e) {
        setSaveMsg({
          type: "error",
          text: e.status
            ? e.message
            : "Löschen fehlgeschlagen. Prüfe die Verbindung und versuche es erneut.",
        });
        return false;
      }
    },
    handleRequestDelete = (e) => setConfirmDeleteId(e),
    handleConfirmDelete = (e) => (setConfirmDeleteId(null), Mt(e)),
    snapshot = JSON.stringify(Ot("")),
    isDirty = waypoints.length > 0 && snapshot !== savedSnapshot;
  useEffect(() => {
    markSavedRef.current &&
      ((markSavedRef.current = false), setSavedSnapshot(snapshot));
  });
  useEffect(() => {
    if (!isDirty) return;
    let e = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", e);
    return () => window.removeEventListener("beforeunload", e);
  }, [isDirty]);
  useEffect(() => {
    if (!lastRemoved) return;
    let e = setTimeout(() => setLastRemoved(null), 8e3);
    return () => clearTimeout(e);
  }, [lastRemoved]);
  let legs = useMemo(() => computeLegs(waypoints), [waypoints]),
    totalDistance = legs.reduce((e, t) => e + t.dist, 0),
    Bt = defaultSpeed > 0 ? totalDistance / defaultSpeed : 0,
    Vt = Math.round(Bt),
    U = Math.floor(Vt / 60),
    Ut = Vt % 60,
    Gt = useMemo(() => {
      if (waypoints.length === 0) return null;
      let lat0 = waypoints[0].lat,
        lon0 = waypoints[0].lon,
        n = waypoints.map((n) => ({
          x: (n.lon - lon0) * 111320 * Math.cos(toRad(lat0)),
          y: -((n.lat - lat0) * 110540),
        })),
        r = n.map((e) => e.x),
        i = n.map((e) => e.y),
        a = Math.min(...r, 0),
        o = Math.max(...r, 0),
        s = Math.min(...i, 0),
        c = Math.max(...i, 0),
        l = Math.max(o - a, 1),
        u = Math.max(c - s, 1),
        scale = Math.min(320 / l, 320 / u),
        offsetX = 80 - a * scale + (320 - l * scale) / 2,
        offsetY = 80 - s * scale + (320 - u * scale) / 2,
        screenPts = n.map((e) => ({
          x: e.x * scale + offsetX,
          y: e.y * scale + offsetY,
        })),
        h = l > u ? l / 4 : u / 4,
        g = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1e3, 2e3, 5e3],
        barMeters = g.reduce(
          (e, t) => (Math.abs(t - h) < Math.abs(e - h) ? t : e),
          g[0],
        );
      return {
        screenPts: screenPts,
        size: 480,
        barMeters: barMeters,
        barPx: barMeters * scale,
        scale: scale,
        offsetX: offsetX,
        offsetY: offsetY,
        lat0: lat0,
        lon0: lon0,
      };
    }, [waypoints]),
    handleClick = () => {
      downloadCsv(
        missionToCsv({
          defaultAltitude: defaultAltitude,
          defaultSpeed: defaultSpeed,
          curveSize: curveSize,
          rotationDir: rotationDir,
          gimbalMode: gimbalMode,
          defaultGimbalPitch: gimbalPitch,
          altitudeMode: altitudeMode,
          headingMode: headingMode,
          fixedHeading: fixedHeading,
          waypoints: waypoints,
        }),
        missionName,
      );
    },
    qt = storageMode === "remote",
    G = headingMode === "custom",
    Jt = FINISH_ACTIONS[finishAction],
    Yt =
      headingMode === "auto"
        ? "automatisch"
        : headingMode === "fixed"
          ? `fest ${fixedHeading}°`
          : "pro Punkt",
    Xt = missions
      .slice()
      .sort((e, t) => new Date(t.savedAt) - new Date(e.savedAt)),
    Zt = it ? missions.find((e) => e.id === activeMissionId) : null,
    Qt = Zt
      ? `Gespeichert am ${savedAtFormat.format(new Date(Zt.savedAt))}`
      : "Neue Mission, noch nicht gespeichert";
  return (
    <IconContext.Provider
      value={{
        weight: "regular",
        size: 18,
      }}
    >
      <div className="app app-b" data-accent={ACCENTS[accent].id}>
        <a href="#main" className="skip-link">
          Zum Inhalt springen
        </a>
        <div className="map-stage">
          <RouteMap
            waypoints={waypoints}
            segments={legs}
            plot={Gt}
            selectedId={selectedId}
            onSelect={(e) => {
              setSelectedId(e);
              e != null && sheetRef.current?.open("full");
            }}
            mode={activeMapMode}
            onModeChange={handleModeChange}
            fitKey={fitKey}
            unavailable={mapUnavailable}
            onUnavailable={() => setMapUnavailable(true)}
            onRetry={() => setMapUnavailable(false)}
            inset={sheetLayout}
          />
        </div>
        <header className="island topbar">
          <div className="topbar-left">
            <div className="brand">
              <Logo size={32} />
              <span translate="no" className="brand-name">
                Litchi Mission Builder
              </span>
            </div>
            <div className="pop-wrap">
              <button
                ref={missionsTriggerRef}
                type="button"
                data-pop-trigger
                className="switch-btn"
                aria-haspopup="dialog"
                aria-expanded={missionsOpen}
                onClick={() => {
                  setAddOpen(false);
                  setMissionsOpen((e) => !e);
                }}
              >
                Missionen
                <CaretUpDownIcon size={18} aria-hidden="true" />
              </button>
              <MissionsPanel
                open={missionsOpen}
                onClose={() => setMissionsOpen(false)}
                triggerRef={missionsTriggerRef}
                missions={Xt}
                loading={missionsLoading}
                isRemote={qt}
                hasCode={hasCode}
                codeInput={codeInput}
                onCodeInput={setCodeInput}
                codeBusy={codeBusy}
                onUnlock={handleUnlock}
                onLogout={handleLogout}
                storageNotice={storageNotice}
                onRefresh={handleRefresh}
                activeMissionId={activeMissionId}
                hasActive={it}
                confirmDeleteId={confirmDeleteId}
                onLoad={(e) =>
                  withViewTransition(() => {
                    At(e);
                    setMissionsOpen(false);
                  })
                }
                onDownload={(e) => downloadCsv(missionToCsv(e), e.name)}
                onRequestDelete={handleRequestDelete}
                onConfirmDelete={handleConfirmDelete}
                saveName={saveName}
                onSaveName={setSaveName}
                title={missionName}
                saveBusy={saveBusy}
                onSave={handleSave}
                onSaveAsNew={() => {
                  setActiveMissionId(null);
                  setSaveName("");
                }}
                saveMsg={saveMsg}
              />
            </div>
          </div>
          <div className="topbar-right">
            <span
              className="store-state"
              title={
                qt
                  ? "Missionen werden im Team geteilt"
                  : "Missionen liegen nur in diesem Browser"
              }
            >
              {qt ? (
                <UsersThreeIcon size={16} aria-hidden="true" />
              ) : (
                <LockKeyIcon size={16} aria-hidden="true" />
              )}
              <span className="store-label">
                {qt ? "Geteilt" : "Nur lokal"}
              </span>
            </span>
            <div className="pop-wrap">
              <button
                ref={addTriggerRef}
                type="button"
                data-pop-trigger
                className="add-fab"
                aria-label="Hinzufügen"
                aria-haspopup="dialog"
                aria-expanded={addOpen}
                onClick={() => {
                  setMissionsOpen(false);
                  setAddOpen((e) => !e);
                }}
              >
                <PlusIcon size={20} weight="bold" aria-hidden="true" />
              </button>
              <Popover
                open={addOpen}
                onClose={() => setAddOpen(false)}
                triggerRef={addTriggerRef}
                label="Hinzufügen"
                align="right"
                className="menu"
              >
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setAddOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <ImagesSquareIcon size={22} aria-hidden="true" />
                  <span>
                    <strong>Bilder oder Video wählen</strong>
                    <small>Koordinaten werden auf diesem Gerät gelesen</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setAddOpen(false);
                    sheetRef.current?.open("full");
                    document.getElementById("sec-add")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                    latRef.current?.focus({
                      preventScroll: true,
                    });
                  }}
                >
                  <MapPinPlusIcon size={22} aria-hidden="true" />
                  <span>
                    <strong>Koordinate eintippen</strong>
                    <small>Breite und Länge von Hand</small>
                  </span>
                </button>
              </Popover>
            </div>
          </div>
        </header>
        <BottomSheet
          ref={sheetRef}
          onLayout={setSheetLayout}
          summary={
            <div className="sum">
              <div className="sum-figs">
                <div className="sum-fig sum-fig--main">
                  <span className="sum-val">
                    <Odometer
                      className="sum-num num"
                      value={distanceFormat.format(totalDistance / 1e3)}
                    />
                    <span className="sum-unit">km</span>
                  </span>
                  <span className="sum-label">Strecke</span>
                </div>
                <div
                  className="sum-fig"
                  role="group"
                  aria-label={`Flugzeit ${U} Minuten ${Ut} Sekunden`}
                >
                  <span className="sum-val" aria-hidden="true">
                    <Odometer
                      className="sum-num num"
                      value={`${U}:${String(Ut).padStart(2, "0")}`}
                    />
                    <span className="sum-unit">min</span>
                  </span>
                  <span className="sum-label" aria-hidden="true">
                    Flugzeit
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClick}
                disabled={waypoints.length < 2}
                className="btn btn-primary btn-export"
              >
                <span className="btn-export-label">CSV exportieren</span>
                <span
                  className="circle-ico circle-ico--dark"
                  aria-hidden="true"
                >
                  <ArrowRightIcon size={16} weight="bold" />
                </span>
              </button>
            </div>
          }
        >
          <section className="head" aria-label="Mission">
            <h1>
              <span className="title-wrap">
                <input
                  value={missionName}
                  onChange={(e) => setMissionName(e.target.value)}
                  aria-label="Missionsname"
                  spellCheck={false}
                  className="plan-title title-input"
                />
                <NotePencilIcon
                  size={20}
                  aria-hidden="true"
                  className="title-pencil"
                />
              </span>
            </h1>
            <div className="meta-line">
              <span>{Qt}</span>
              {isDirty && (
                <Tag tone="warn">
                  <WarningIcon size={14} aria-hidden="true" />
                  {" Nicht gespeichert"}
                </Tag>
              )}
            </div>
            <AccentPicker value={accent} onChange={setAccent} />
          </section>
          <section className="figs" aria-label="Einstellungen">
            <MissionStats
              altitude={defaultAltitude}
              onAltitude={setDefaultAltitude}
              speed={defaultSpeed}
              onSpeed={setDefaultSpeed}
              gimbal={gimbalPitch}
              onGimbal={setGimbalPitch}
              curve={curveSize}
              onCurve={setCurveSize}
            />
            <div className="actions">
              <button
                type="button"
                onClick={toggleSettings}
                aria-expanded={settingsOpen}
                aria-controls="more-settings"
                className="btn btn-glass"
              >
                Weitere Einstellungen
                <CaretDownIcon
                  size={16}
                  className="caret-toggle"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveBusy}
                className="btn btn-glass"
              >
                <FloppyDiskIcon size={17} aria-hidden="true" />{" "}
                {it ? "Aktualisieren" : "Speichern"}
              </button>
            </div>
            {saveMsg && !missionsOpen && (
              <p
                role="status"
                className={`mt-3 text-[14px] ${saveMsg.type === "ok" ? "font-medium" : "note"}`}
                data-tone={saveMsg.type === "ok" ? undefined : "error"}
              >
                {saveMsg.type === "ok" ? (
                  <CheckIcon
                    size={16}
                    aria-hidden="true"
                    className="mr-1.5 inline align-[-3px]"
                  />
                ) : (
                  <WarningIcon size={17} aria-hidden="true" />
                )}
                <span>{saveMsg.text}</span>
              </p>
            )}
            <AdvancedSettings
              open={settingsOpen}
              altitudeMode={altitudeMode}
              onAltitudeMode={setAltitudeMode}
              rotationDir={rotationDir}
              onRotationDir={setRotationDir}
              headingMode={headingMode}
              onHeadingMode={setHeadingMode}
              fixedHeading={fixedHeading}
              onFixedHeading={setFixedHeading}
              gimbalMode={gimbalMode}
              onGimbalMode={setGimbalMode}
              finishAction={finishAction}
              onFinishAction={setFinishAction}
            />
            <p className="hint actions-hint">
              {
                "Export ab 2 Wegpunkten für den Litchi Mission Hub (flylitchi.com/hub). Kurs "
              }
              {Yt}. Die Abschlussaktion steht nicht in der CSV: nach dem Import
              „Finish Action“ auf{" "}
              <strong className="font-semibold">{Jt}</strong>
              {" stellen."}
            </p>
          </section>
          <section id="sec-add" className="addsec" aria-labelledby="h-add">
            <h2 id="h-add" className="sec-title">
              Hinzufügen
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              aria-label="Bilder oder Videos auswählen"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <AddCard
              onPick={() => fileInputRef.current?.click()}
              onFiles={handleFiles}
              form={form}
              onForm={setForm}
              onAdd={handleAdd}
              error={formError}
              latRef={latRef}
            />
            {uploadNotice && (
              <p role="status" className="note mt-4" data-tone="warn">
                <InfoIcon size={17} aria-hidden="true" />
                <span>{uploadNotice}</span>
              </p>
            )}
            {(images.length > 0 || videoStore.videos.length > 0) && (
              <div className="found">
                <div className="found-head">
                  <h3 className="sub-title">Erkannt, bitte prüfen</h3>
                  {images.some(
                    (e) => e.status === "idle" || e.status === "error",
                  ) && (
                    <button onClick={z} className="btn btn-primary btn-sm">
                      Alle Bilder erkennen
                    </button>
                  )}
                </div>
                <p className="hint mb-2">
                  Bitte jedes Ergebnis mit dem Bild vergleichen, bevor du es
                  übernimmst. Aus einem Video werden Standbilder geschnitten und
                  gelesen.
                </p>
                <ul className="ledger">
                  {videoStore.videos.map((e) => (
                    <VideoCard
                      key={e.id}
                      video={e}
                      waypoints={waypoints}
                      onInterval={(t) => videoStore.setInterval(e.id, t)}
                      onStart={() => videoStore.start(e.id)}
                      onCancel={() => videoStore.cancel(e.id)}
                      onRemove={() => videoStore.remove(e.id)}
                      addedWp={Tt}
                      onAdd={Et}
                      onAddAll={handleAddAll}
                    />
                  ))}
                  {images.map((e) => (
                    <ImageCard
                      key={e.id}
                      img={e}
                      waypoints={waypoints}
                      onRecognize={() => St(e.id)}
                      onRemove={() => Dt(e.id)}
                      addedWp={Tt}
                      onAdd={Et}
                      onAddAll={handleAddAll}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>
          <section
            id="sec-points"
            className="pointsec"
            aria-labelledby="h-points"
          >
            <h2 id="h-points" className="sec-title">
              {"Wegpunkte "}
              <Odometer className="sec-count num" value={waypoints.length} />
            </h2>
            <Reveal show={!!lastRemoved} className="mb-3">
              {lastRemoved && (
                <div
                  role="status"
                  className="note row-enter items-center justify-between"
                >
                  <span>
                    {"Wegpunkt "}
                    {lastRemoved.index + 1}
                    {" entfernt."}
                  </span>
                  <button onClick={vt} className="btn btn-secondary btn-sm">
                    Rückgängig
                  </button>
                </div>
              )}
            </Reveal>
            <WaypointList
              waypoints={waypoints}
              segments={legs}
              defaultAltitude={defaultAltitude}
              defaultGimbalPitch={gimbalPitch}
              customHeading={G}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={handleUpdate}
              onMove={handleMove}
              onRemove={handleRemove}
            />
          </section>
          <details className="guide">
            <summary>
              <span className="sec-title">
                So kommt die Mission ins Litchi-Gerät
              </span>
              <CaretDownIcon size={18} className="caret" aria-hidden="true" />
            </summary>
            <div className="guide-grid">
              <div>
                <h3 className="letter">Empfohlen: gemeinsames Litchi-Konto</h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-ink-2 marker:text-ink-3">
                  <li>
                    Einmalig ein Litchi-Konto für die Firma anlegen, alle
                    Piloten loggen sich in der Litchi-App damit ein
                  </li>
                  <li>
                    Diese CSV auf flylitchi.com/hub importieren und dort
                    speichern
                  </li>
                  <li>
                    Mission erscheint automatisch auf jedem eingeloggten Gerät.
                    Kein manuelles Kopieren mehr nötig
                  </li>
                </ol>
              </div>
              <div>
                <h3 className="letter">Alternativ: CSV manuell übertragen</h3>
                <p className="text-ink-2">
                  CSV wie gewohnt herunterladen und im Litchi Mission Hub oder
                  direkt in der App importieren. Das funktioniert ohne
                  gemeinsames Konto, muss aber pro Person wiederholt werden.
                </p>
              </div>
              <div>
                <h3 className="letter">Ohne Internet vor Ort</h3>
                <p className="text-ink-2">
                  Datei direkt in den Missionsordner des Geräts legen: Android
                  „LitchiApp/missions“, iOS über ein Dateiübertragungs-Tool (z.
                  B. iFunBox).
                </p>
              </div>
            </div>
          </details>
          <footer className="foot">
            <span translate="no">Litchi Mission Builder</span>
            <span>
              Bilder werden lokal auf diesem Gerät gelesen und nicht
              hochgeladen. Die Karte lädt Kacheln von OpenStreetMap oder Esri,
              die Ansicht „Skizze“ braucht keinen Server.
            </span>
          </footer>
        </BottomSheet>
      </div>
    </IconContext.Provider>
  );
}
