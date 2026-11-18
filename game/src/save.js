// Save / load for Solmar Bay: one small JSON blob in localStorage.
// Everything here is wrapped in try/catch on purpose — a browser that
// blocks storage (private mode, disabled cookies) must never break the game.

const SAVE_KEY = 'solmar-bay.save.v1';

/** Persist the parts of a run worth keeping between visits. */
export function saveGame(G) {
  try {
    const data = {
      money: G.player?.money ?? 0,
      missionCurrent: G.missions?.current ?? 0,
      missionStage: G.missions?.stage ?? 0,
      health: G.player?.health ?? 100,
      ammo: G.player?.ammo ?? 0,
      gameMinutes: G.gameMinutes ?? 16 * 60 + 20,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Read the saved run back, or null when there is none / it is unreadable. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      money: Number(data.money) || 0,
      missionCurrent: Number(data.missionCurrent) || 0,
      missionStage: Number(data.missionStage) || 0,
      health: Number(data.health) || 100,
      ammo: Number(data.ammo) || 0,
      gameMinutes: Number(data.gameMinutes) || 16 * 60 + 20,
    };
  } catch {
    return null;
  }
}

/** True when a save exists and parses. */
export function hasSave() {
  return loadGame() !== null;
}

/** Wipe the save (used when the player starts a brand-new story). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
