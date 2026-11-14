// Akzentfarben der Missionen.
export const ACCENTS = [
  {
    id: "lime",
    label: "Limette",
    swatch: "#c8f84a",
  },
  {
    id: "yellow",
    label: "Gelb",
    swatch: "#f5dd2e",
  },
  {
    id: "orange",
    label: "Orange",
    swatch: "#ff9a3d",
  },
  {
    id: "teal",
    label: "Türkis",
    swatch: "#3fe0c8",
  },
  {
    id: "violet",
    label: "Violett",
    swatch: "#a78bfa",
  },
  {
    id: "pink",
    label: "Rosa",
    swatch: "#ff7ab8",
  },
];

const isAccentIndex = (e) =>
  Number.isInteger(e) && e >= 0 && e < ACCENTS.length;

function accentFromId(e) {
  let t = String(e || ""),
    n = 0;
  for (let e = 0; e < t.length; e++) n = (n * 31 + t.charCodeAt(e)) >>> 0;
  return n % ACCENTS.length;
}

export const missionAccent = (e) =>
  isAccentIndex(e?.accent) ? e.accent : accentFromId(e?.id);
