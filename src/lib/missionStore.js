// Speichert Missionen lokal im Browser oder, mit Team-Code, über /api/missions.
const TEAM_CODE_KEY = "lmb.teamCode";

const MISSIONS_KEY = "lmb.missions";

function storageGet(e) {
  try {
    return window.localStorage.getItem(e);
  } catch {
    return null;
  }
}

function storageSet(e, t) {
  try {
    window.localStorage.setItem(e, t);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(e) {
  try {
    window.localStorage.removeItem(e);
  } catch {}
}

export const getTeamCode = () => storageGet(TEAM_CODE_KEY) || "";

export const setTeamCode = (e) => storageSet(TEAM_CODE_KEY, e);

export const clearTeamCode = () => storageRemove(TEAM_CODE_KEY);

function teamHeaders() {
  let e = getTeamCode();
  return e
    ? {
        "x-team-code": e,
      }
    : {};
}

function readLocalMissions() {
  try {
    let e = JSON.parse(storageGet(MISSIONS_KEY) || "[]");
    return Array.isArray(e) ? e : [];
  } catch {
    return [];
  }
}

function writeLocalMissions(e) {
  if (!storageSet(MISSIONS_KEY, JSON.stringify(e)))
    throw Error("local_write_failed");
}

async function apiFetch(e, t = {}) {
  let n = await fetch(e, {
      ...t,
      headers: {
        "Content-Type": "application/json",
        ...teamHeaders(),
        ...(t.headers || {}),
      },
    }),
    r = null;
  try {
    r = await n.json();
  } catch {}
  if (!n.ok) {
    let e = Error(r?.error?.message || `Fehler ${n.status}`);
    throw ((e.status = n.status), (e.code = r?.error?.code), e);
  }
  return r;
}

export async function loadMissions() {
  if (!getTeamCode())
    return {
      mode: "local",
      missions: readLocalMissions(),
      notice: null,
    };
  try {
    return {
      mode: "remote",
      missions: (await apiFetch("/api/missions")).missions || [],
      notice: null,
    };
  } catch (e) {
    return e.status === 401
      ? (clearTeamCode(),
        {
          mode: "local",
          missions: readLocalMissions(),
          notice: "Zugangscode ungültig. Bitte erneut eingeben.",
        })
      : e.status === 429
        ? {
            mode: "local",
            missions: readLocalMissions(),
            notice: "Zu viele Versuche. Bitte später erneut probieren.",
          }
        : e.status === 503
          ? {
              mode: "local",
              missions: readLocalMissions(),
              notice:
                "Geteilter Speicher ist auf dem Server noch nicht eingerichtet. Missionen bleiben lokal.",
            }
          : {
              mode: "local",
              missions: readLocalMissions(),
              notice: "Server nicht erreichbar. Missionen bleiben lokal.",
            };
  }
}

export async function saveMission(e, t) {
  if (e === "remote")
    return (
      await apiFetch("/api/missions", {
        method: "POST",
        body: JSON.stringify(t),
      })
    ).mission;
  let n = {
      ...t,
      savedAt: new Date().toISOString(),
    },
    r = readLocalMissions(),
    i = r.findIndex((e) => e.id === n.id);
  i >= 0 ? (r[i] = n) : r.push(n);
  writeLocalMissions(r);
  return n;
}

export async function deleteMission(e, t) {
  if (e === "remote") {
    await apiFetch(`/api/missions?id=${encodeURIComponent(t)}`, {
      method: "DELETE",
    });
    return;
  }
  writeLocalMissions(readLocalMissions().filter((e) => e.id !== t));
}
