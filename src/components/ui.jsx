// Kleine Bausteine der Oberfläche: Eingabefelder, Popover, Umschalter, Zähler, Logo.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CircleNotchIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { ACCENTS } from "../lib/accents";
import { collapseOut, foldIn } from "../lib/motion";

export function NumberInput({ value, onChange, className = "", unit, ...i }) {
  let [a, o] = useState(String(value)),
    [s, c] = useState(false);
  useEffect(() => {
    s || o(String(value));
  }, [value, s]);
  let l = (
    <input
      autoComplete="off"
      {...i}
      type="number"
      value={a}
      className={`field ${className}`}
      onFocus={() => c(true)}
      onBlur={() => c(false)}
      onChange={(e) => {
        o(e.target.value);
        onChange(parseFloat(e.target.value) || 0);
      }}
    />
  );
  return unit ? (
    <span className="field-unit">
      {l}
      <span className="unit" data-unit={unit} aria-hidden="true">
        {unit}
      </span>
    </span>
  ) : (
    l
  );
}

export function OverrideCell({
  value,
  fallback,
  onChange,
  resetLabel,
  className = "",
  ...a
}) {
  let o = value != null;
  return (
    <div className="std-cell">
      <NumberInput
        {...a}
        value={o ? value : fallback}
        onChange={onChange}
        className={className}
        data-std={o ? undefined : ""}
      />
      {o ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="std-reset"
          aria-label={resetLabel}
          title={`Auf Standard (${fallback}) zurücksetzen`}
        >
          <ArrowCounterClockwiseIcon size={13} aria-hidden="true" />
          <span className="num">
            <span className="std-word">{"Standard "}</span>
            {fallback}
          </span>
        </button>
      ) : (
        <span className="std-mark">Standard</span>
      )}
    </div>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Tag({ tone, children }) {
  return (
    <span className="tag" data-tone={tone}>
      {children}
    </span>
  );
}

export function Spinner({ size = 16 }) {
  return <CircleNotchIcon size={size} className="spin" aria-hidden="true" />;
}

export function Popover({
  open,
  onClose,
  triggerRef,
  label,
  align = "left",
  className = "",
  children,
}) {
  let s = useRef(null),
    c = useRef(onClose);
  c.current = onClose;
  useEffect(() => {
    if (!open) return;
    let t = triggerRef?.current,
      r = (e) => {
        e.key === "Escape" && (e.stopPropagation(), c.current(), t?.focus());
      },
      i = (e) => {
        s.current?.contains(e.target) ||
          e.target.closest?.("[data-pop-trigger]") ||
          c.current();
      };
    document.addEventListener("keydown", r);
    document.addEventListener("pointerdown", i);
    s.current?.querySelector("input, button, select, [href]")?.focus({
      preventScroll: true,
    });
    return () => {
      document.removeEventListener("keydown", r);
      document.removeEventListener("pointerdown", i);
    };
  }, [open, triggerRef]);
  return open ? (
    <div
      ref={s}
      role="dialog"
      aria-label={label}
      className={`popover popover--${align} ${className}`}
    >
      {children}
    </div>
  ) : null;
}

export function Segmented({ options, value, onChange, label, className = "" }) {
  let a = useRef(null),
    [o, s] = useState(null);
  useLayoutEffect(() => {
    let e = a.current;
    if (!e) return;
    let t = () => {
      let t = e.querySelector('[aria-pressed="true"]');
      s(
        t && t.offsetWidth
          ? {
              x: t.offsetLeft,
              w: t.offsetWidth,
            }
          : null,
      );
    };
    if ((t(), typeof ResizeObserver > "u")) return;
    let n = new ResizeObserver(t);
    n.observe(e);
    return () => n.disconnect();
  }, [value, options.length]);
  return (
    <div
      ref={a}
      className={`seg ${className}`}
      role="group"
      aria-label={label}
      data-thumb={o ? "" : undefined}
      style={
        o
          ? {
              "--seg-x": `${o.x}px`,
              "--seg-w": `${o.w}px`,
            }
          : undefined
      }
    >
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((e) => (
        <button
          key={e.id}
          type="button"
          aria-pressed={value === e.id}
          aria-label={e.ariaLabel}
          onClick={() => onChange(e.id)}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Odometer({ value, className = "" }) {
  let n = String(value),
    r = [...n];
  return (
    <span className={`odo ${className}`} role="img" aria-label={n}>
      {r.map((e, t) => {
        let n = r.length - t;
        return /\d/.test(e) ? (
          <span key={`d${n}`} className="odo-col" aria-hidden="true">
            <span
              className="odo-strip"
              style={{
                "--d": Number(e),
              }}
            >
              {DIGITS.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </span>
            <span className="odo-ghost">{e}</span>
          </span>
        ) : (
          <span key={`s${n}`} className="odo-sep" aria-hidden="true">
            {e}
          </span>
        );
      })}
    </span>
  );
}

export function AccentPicker({ value, onChange }) {
  return (
    <div className="accents" role="group" aria-label="Missionsfarbe">
      {ACCENTS.map((n, r) => (
        <button
          key={n.id}
          type="button"
          className="accent-dot"
          aria-pressed={value === r}
          aria-label={n.label}
          title={n.label}
          style={{
            "--dot": n.swatch,
          }}
          onClick={() => onChange(r)}
        />
      ))}
    </div>
  );
}

export function Logo({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="20" fill="var(--accent)" />
      <path
        d="M15 46 L29 30 L41 38 L51 19"
        stroke="var(--accent-ink)"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="15" cy="46" r="6" fill="var(--accent-ink)" />
      <circle
        cx="29"
        cy="30"
        r="4.5"
        fill="var(--accent)"
        stroke="var(--accent-ink)"
        strokeWidth="3"
      />
      <circle
        cx="41"
        cy="38"
        r="4.5"
        fill="var(--accent)"
        stroke="var(--accent-ink)"
        strokeWidth="3"
      />
      <circle cx="51" cy="19" r="6" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Reveal({ show, className = "", children }) {
  let [r, i] = useState(show),
    a = useRef(children),
    o = useRef(null);
  show && (a.current = children);
  useEffect(() => {
    if (show) {
      i(true);
      return;
    }
    if (!o.current) return;
    let t = collapseOut(o.current, {
        duration: 220,
      }),
      n = true;
    t.done.then(() => n && i(false));
    return () => {
      n = false;
      t.cancel();
    };
  }, [show]);
  return !show && !r ? null : (
    <div ref={o} className={className}>
      {show ? children : a.current}
    </div>
  );
}

export function FoldIn({ as: Tag2 = "div", children, ...n }) {
  let r = useRef(null);
  useLayoutEffect(() => {
    foldIn(r.current);
  }, []);
  return (
    <Tag2 ref={r} {...n}>
      {children}
    </Tag2>
  );
}

export function AddButton({
  onClick,
  done = false,
  label = "Hinzufügen",
  doneLabel = "Hinzugefügt",
  className = "",
  iconSize = 15,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={done}
      className={`btn add-btn ${className}`}
      data-done={done ? "true" : undefined}
    >
      {done ? (
        <CheckIcon
          size={iconSize}
          weight="bold"
          aria-hidden="true"
          className="add-tick"
        />
      ) : (
        <PlusIcon size={iconSize} aria-hidden="true" />
      )}
      <span aria-live="polite">{done ? doneLabel : label}</span>
    </button>
  );
}
