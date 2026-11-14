// Kartenebenen (OpenStreetMap, Esri-Satellit) und die Ansicht „Skizze“.
export const TILE_LAYERS = {
  street: {
    label: "Karte",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende',
    maxZoom: 19,
    referrerPolicy: "origin",
  },
  satellite: {
    label: "Satellit",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
    referrerPolicy: "origin",
  },
};

export const MAP_MODES = [
  {
    id: "street",
    label: TILE_LAYERS.street.label,
  },
  {
    id: "satellite",
    label: TILE_LAYERS.satellite.label,
  },
  {
    id: "sketch",
    label: "Skizze",
  },
];

export const DEFAULT_MAP_MODE = "street";

export const isMapMode = (e) => MAP_MODES.some((t) => t.id === e);
