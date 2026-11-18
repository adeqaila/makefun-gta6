// Solmar Bay — saving to localStorage.
// One key, one small JSON object: money, health, ammo, mission, position,
// and the clock. Loading resumes the story where it stopped.

export const SAVE_KEY = 'solmarbay-save-v1';

export function saveGame(world) {
  try {
    const data = {
      money: Math.floor(world.player.money),
      health: Math.round(world.player.health),
      ammo: world.player.ammo,
      mission: world.missions.current,
      x: Math.round(world.player.x * 10) / 10,
      z: Math.round(world.player.z * 10) / 10,
      clockMinutes: Math.round(world.clockMinutes),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* storage may be unavailable */ }
}
