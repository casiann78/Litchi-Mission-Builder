// Geometrie auf der Erdkugel: Entfernung, Kurs und Streckenabschnitte.
export const toRad = (e) => (e * Math.PI) / 180;

const toDeg = (e) => (e * 180) / Math.PI;

export function haversineDistance(e, t, n, r) {
  let i = toRad(n - e),
    a = toRad(r - t),
    o =
      Math.sin(i / 2) ** 2 +
      Math.cos(toRad(e)) * Math.cos(toRad(n)) * Math.sin(a / 2) ** 2;
  return 12742e3 * Math.atan2(Math.sqrt(o), Math.sqrt(1 - o));
}

function bearing(e, t, n, r) {
  let i = Math.sin(toRad(r - t)) * Math.cos(toRad(n)),
    a =
      Math.cos(toRad(e)) * Math.sin(toRad(n)) -
      Math.sin(toRad(e)) * Math.cos(toRad(n)) * Math.cos(toRad(r - t));
  return (toDeg(Math.atan2(i, a)) + 360) % 360;
}

export function computeLegs(e) {
  return e.map((t, n) => {
    if (n === e.length - 1)
      return {
        dist: 0,
        brg: null,
      };
    let r = e[n + 1];
    return {
      dist: haversineDistance(t.lat, t.lon, r.lat, r.lon),
      brg: bearing(t.lat, t.lon, r.lat, r.lon),
    };
  });
}

export function missionStats(e) {
  return {
    totalDistance: computeLegs(e.waypoints || []).reduce(
      (e, t) => e + t.dist,
      0,
    ),
    count: (e.waypoints || []).length,
  };
}
