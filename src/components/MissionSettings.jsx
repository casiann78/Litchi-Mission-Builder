// Missionseinstellungen: Höhe, Geschwindigkeit, Gimbal, Kurs, Abschlussaktion.
import {
  ArrowBendUpRightIcon,
  ArrowLineUpIcon,
  CameraIcon,
  GaugeIcon,
} from "@phosphor-icons/react";
import { NumberInput, Field } from "./ui";

export const FINISH_ACTIONS = {
  none: "Nichts",
  rth: "RTH (zurück zum Startpunkt & landen)",
  land: "Landen (an letztem Wegpunkt)",
  wp1: "Zurück zu Wegpunkt 1",
  reverse: "Entgegengesetzt (Strecke rückwärts abfliegen)",
};

function StatInput({ icon: Tag2, label, unit, value, onChange }) {
  return (
    <label className="stat">
      <Tag2 size={30} className="stat-ico" aria-hidden="true" />
      <span className="stat-body">
        <NumberInput
          value={value}
          onChange={onChange}
          unit={unit}
          className="stat-input"
          aria-label={`${label} in ${unit}`}
        />
        <span className="stat-label">{label}</span>
      </span>
    </label>
  );
}

export function MissionStats({
  altitude,
  onAltitude,
  speed,
  onSpeed,
  gimbal,
  onGimbal,
  curve,
  onCurve,
}) {
  return (
    <div>
      <div className="stats" role="group" aria-label="Missionseinstellungen">
        <StatInput
          icon={ArrowLineUpIcon}
          label="Standardhöhe"
          unit="m"
          value={altitude}
          onChange={onAltitude}
        />
        <StatInput
          icon={GaugeIcon}
          label="Geschwindigkeit"
          unit="m/s"
          value={speed}
          onChange={onSpeed}
        />
        <StatInput
          icon={CameraIcon}
          label="Gimbalneigung"
          unit="°"
          value={gimbal}
          onChange={onGimbal}
        />
        <StatInput
          icon={ArrowBendUpRightIcon}
          label="Kurvenradius"
          unit="m"
          value={curve}
          onChange={onCurve}
        />
      </div>
      <p className="hint stats-hint">
        Gilt für jeden Wegpunkt ohne eigene Höhe, auch wenn du sie später
        änderst. In der Liste steht dort „Standard“.
      </p>
    </div>
  );
}

export function AdvancedSettings({
  open,
  altitudeMode: t,
  onAltitudeMode,
  rotationDir: r,
  onRotationDir,
  headingMode: a,
  onHeadingMode,
  fixedHeading: s,
  onFixedHeading,
  gimbalMode: l,
  onGimbalMode,
  finishAction: d,
  onFinishAction,
}) {
  return (
    <div
      id="more-settings"
      className="foldout"
      data-open={open ? "true" : "false"}
      inert={!open}
    >
      <div className="foldout-inner">
        <div className="more">
          <fieldset className="group">
            <legend>Flug</legend>
            <div className="more-grid">
              <Field label="Höhenbezug">
                <select
                  value={t}
                  onChange={(e) => onAltitudeMode(parseInt(e.target.value))}
                  className="field"
                >
                  <option value={0}>Relativ zum Startpunkt</option>
                  <option value={1}>Absolut (über Meeresspiegel)</option>
                </select>
              </Field>
              <Field label="Drehrichtung Kurve">
                <select
                  value={r}
                  onChange={(e) => onRotationDir(parseInt(e.target.value))}
                  className="field"
                >
                  <option value={0}>Im Uhrzeigersinn</option>
                  <option value={1}>Gegen den Uhrzeigersinn</option>
                </select>
              </Field>
            </div>
          </fieldset>
          <fieldset className="group">
            <legend>Kurs und Kamera</legend>
            <div className="more-grid">
              <Field label="Kurs-Modus">
                <select
                  value={a}
                  onChange={(e) => onHeadingMode(e.target.value)}
                  className="field"
                >
                  <option value="auto">
                    Automatisch (Kurs zum nächsten Punkt)
                  </option>
                  <option value="fixed">Fest für gesamte Strecke</option>
                  <option value="custom">Pro Wegpunkt einstellen</option>
                </select>
              </Field>
              {a === "fixed" && (
                <Field label="Fester Kurs">
                  <NumberInput
                    value={s}
                    onChange={onFixedHeading}
                    unit="°"
                    className="field-mono"
                  />
                </Field>
              )}
              <Field label="Gimbal-Modus">
                <select
                  value={l}
                  onChange={(e) => onGimbalMode(parseInt(e.target.value))}
                  className="field"
                >
                  <option value={0}>Deaktiviert</option>
                  <option value={1}>Fokus auf POI</option>
                  <option value={2}>Interpolieren</option>
                </select>
              </Field>
            </div>
          </fieldset>
          <fieldset className="group">
            <legend>Abschluss</legend>
            <div className="more-grid">
              <Field
                label="Abschlussaktion (Finish Action)"
                className="more-wide"
              >
                <select
                  value={d}
                  onChange={(e) => onFinishAction(e.target.value)}
                  className="field"
                >
                  {Object.entries(FINISH_ACTIONS).map(([e, t]) => (
                    <option key={e} value={e}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
