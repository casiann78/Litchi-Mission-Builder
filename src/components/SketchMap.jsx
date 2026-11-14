// Lageplan der Route als SVG. Braucht kein Internet.
import { toRad } from "../lib/geo";

const PLOT_W = 480;

const PLOT_H = 524;

const PLOT_PAD = 26;

const PLOT_INNER = 428;

function niceStep(e) {
  let t = 10 ** Math.floor(Math.log10(e)),
    n = e / t;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * t;
}

function axisTicks(e, t) {
  let n = Math.min(e, t),
    r = Math.max(e, t),
    i = niceStep((r - n) / 3),
    decimals = Math.min(6, Math.max(0, Math.ceil(-Math.log10(i) - 1e-9))),
    values = [];
  for (let e = Math.ceil(n / i); e * i <= r; e++)
    values.push(Math.round(e * i * 1e7) / 1e7);
  return {
    values: values,
    decimals: decimals,
  };
}

export function SketchMap({ plot, count, segments = [] }) {
  let r = plot
      ? `Lageplan mit ${count} ${count === 1 ? "Wegpunkt" : "Wegpunkten"}`
      : "Lageplan, noch keine Wegpunkte",
    i = null,
    a = null,
    o = null,
    s = null;
  if (plot) {
    let t = Math.cos(toRad(plot.lat0));
    o = (n) => (n - plot.lon0) * 111320 * t * plot.scale + plot.offsetX;
    s = (t) => -(t - plot.lat0) * 110540 * plot.scale + plot.offsetY;
    let n = (n) => plot.lon0 + (n - plot.offsetX) / (111320 * t * plot.scale),
      r = (t) => plot.lat0 - (t - plot.offsetY) / (110540 * plot.scale);
    i = axisTicks(n(PLOT_PAD), n(454));
    a = axisTicks(r(454), r(PLOT_PAD));
  }
  let c = plot ? plot.screenPts : [],
    points = c.map((e) => `${e.x},${e.y}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
      role="img"
      aria-label={r}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
      style={{
        background: "var(--map)",
      }}
    >
      {plot ? (
        <g stroke="var(--rule-strong)" strokeOpacity="0.35" strokeWidth="1">
          {i.values.map((e) => {
            let x1 = o(e);
            return x1 > PLOT_PAD && x1 < 454 ? (
              <line key={`lon-${e}`} x1={x1} y1={PLOT_PAD} x2={x1} y2={454} />
            ) : null;
          })}
          {a.values.map((e) => {
            let y1 = s(e);
            return y1 > PLOT_PAD && y1 < 454 ? (
              <line key={`lat-${e}`} x1={PLOT_PAD} y1={y1} x2={454} y2={y1} />
            ) : null;
          })}
        </g>
      ) : (
        <g stroke="var(--rule-strong)" strokeOpacity="0.35" strokeWidth="1">
          {[1, 2, 3].map((e) => (
            <g key={e}>
              <line
                x1={PLOT_PAD + (PLOT_INNER / 4) * e}
                y1={PLOT_PAD}
                x2={PLOT_PAD + (PLOT_INNER / 4) * e}
                y2={454}
              />
              <line
                x1={PLOT_PAD}
                y1={PLOT_PAD + (PLOT_INNER / 4) * e}
                x2={454}
                y2={PLOT_PAD + (PLOT_INNER / 4) * e}
              />
            </g>
          ))}
        </g>
      )}
      <rect
        x={PLOT_PAD}
        y={PLOT_PAD}
        width={PLOT_INNER}
        height={PLOT_INNER}
        rx="12"
        fill="none"
        stroke="var(--rule-strong)"
        strokeWidth="1"
      />
      {plot && (
        <g
          fill="var(--ink-3)"
          style={{
            fontFamily: "var(--f-sans)",
            fontSize: 19,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {i.values.map((e) => {
            let x1 = o(e);
            return x1 <= 66 || x1 >= 408 ? null : (
              <g key={`lont-${e}`}>
                <line
                  x1={x1}
                  y1={PLOT_PAD}
                  x2={x1}
                  y2={31}
                  stroke="var(--rule-strong)"
                  strokeWidth="1"
                />
                <text x={x1} y={51} textAnchor="middle">
                  {e.toFixed(i.decimals)}
                </text>
              </g>
            );
          })}
          {a.values.map((e) => {
            let y1 = s(e);
            return y1 <= 70 || y1 >= 410 ? null : (
              <g key={`latt-${e}`}>
                <line
                  x1={PLOT_PAD}
                  y1={y1}
                  x2={31}
                  y2={y1}
                  stroke="var(--rule-strong)"
                  strokeWidth="1"
                />
                <text
                  transform={`translate(51 ${y1}) rotate(-90)`}
                  textAnchor="middle"
                >
                  {e.toFixed(a.decimals)}
                </text>
              </g>
            );
          })}
        </g>
      )}
      {plot ? (
        <>
          <polyline
            points={points}
            fill="none"
            stroke="var(--map)"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            key={`route-${count}`}
            points={points}
            fill="none"
            stroke="var(--route)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {c.slice(0, -1).map((e, t) => {
            let r = c[t + 1],
              i = r.x - e.x,
              a = r.y - e.y,
              o = Math.hypot(i, a);
            if (o < 46) return null;
            let s = (Math.atan2(a, i) * 180) / Math.PI,
              l = (e.x + r.x) / 2,
              u = (e.y + r.y) / 2,
              d = s > 90 || s < -90 ? s + 180 : s;
            return (
              <g key={`seg-${t}`}>
                <path
                  d="M -6 -6 L 7 0 L -6 6 Z"
                  transform={`translate(${l} ${u}) rotate(${s})`}
                  fill="var(--route)"
                  stroke="var(--map)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
                {o > 100 && segments[t] && (
                  <text
                    transform={`translate(${l} ${u}) rotate(${d}) translate(0 -11)`}
                    textAnchor="middle"
                    fill="var(--ink)"
                    stroke="var(--map)"
                    strokeWidth="5"
                    paintOrder="stroke"
                    style={{
                      fontFamily: "var(--f-sans)",
                      fontSize: 19,
                      fontWeight: 650,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {Math.round(segments[t].dist)}
                    {" m"}
                  </text>
                )}
              </g>
            );
          })}
          {c.map((e, t) => {
            let n = t === 0,
              r = c.length > 1 && t === c.length - 1,
              i = String(t + 1),
              fill = n ? "var(--start)" : r ? "var(--ink)" : "var(--sheet)",
              stroke = n ? "var(--start)" : r ? "var(--ink)" : "var(--route)",
              s = n ? "var(--start-ink)" : r ? "var(--sheet)" : "var(--route)";
            return (
              <g key={t} className="mark-in">
                <circle cx={e.x} cy={e.y} r="19" fill="var(--map)" />
                <circle
                  cx={e.x}
                  cy={e.y}
                  r="16"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="2.6"
                />
                <text
                  x={e.x}
                  y={e.y}
                  dy="0.35em"
                  textAnchor="middle"
                  fill={s}
                  style={{
                    fontFamily: "var(--f-sans)",
                    fontSize: i.length > 2 ? 13 : i.length > 1 ? 17 : 20,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {i}
                </text>
              </g>
            );
          })}
          <g transform="translate(28 468)">
            <rect
              x="0"
              y="0"
              width={plot.barPx / 2}
              height="5"
              rx="2.5"
              fill="var(--ink-2)"
            />
            <rect
              x={plot.barPx / 2}
              y="0"
              width={plot.barPx / 2}
              height="5"
              rx="2.5"
              fill="var(--rule-strong)"
            />
            <g
              fill="var(--ink-3)"
              style={{
                fontFamily: "var(--f-sans)",
                fontSize: 19,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <text x="0" y="26" textAnchor="middle">
                0
              </text>
              <text x={plot.barPx} y="26" textAnchor="middle">
                {plot.barMeters}
                {" m"}
              </text>
            </g>
          </g>
        </>
      ) : (
        <g textAnchor="middle">
          <g
            transform={`translate(${PLOT_W / 2} ${PLOT_W / 2 - 22})`}
            fill="none"
            stroke="var(--rule-strong)"
            strokeWidth="1.5"
          >
            <circle r="9" />
            <path d="M0 -16v10M0 6v10M-16 0h10M6 0h10" />
          </g>
          <text
            x={PLOT_W / 2}
            y={260}
            fill="var(--ink)"
            style={{
              fontFamily: "var(--f-sans)",
              fontWeight: 600,
              fontSize: 22,
            }}
          >
            Noch keine Wegpunkte
          </text>
          <text
            x={PLOT_W / 2}
            y={288}
            fill="var(--ink-3)"
            style={{
              fontFamily: "var(--f-sans)",
              fontSize: 17,
            }}
          >
            Sobald Punkte vorhanden sind,
          </text>
          <text
            x={PLOT_W / 2}
            y={311}
            fill="var(--ink-3)"
            style={{
              fontFamily: "var(--f-sans)",
              fontSize: 17,
            }}
          >
            entsteht hier der Lageplan.
          </text>
        </g>
      )}
    </svg>
  );
}
