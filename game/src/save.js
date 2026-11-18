// SOLMAR BAY — save: progress in localStorage, nothing else.
// One job: write and read the player's money, mission and position.

const KEY = 'solmarbay-save-v1';

export function createSave() {
  return { key: KEY };
}

export function saveGame(save, world) {
  try {
    const { player, missions } = world;
    const data = {
      money: player.money,
      health: player.health,
      ammo: player.ammo,
      mission: missions.current,
      x: player.inCar ? player.inCar.x : player.x,
      z: player.inCar ? player.inCar.z : player.z,
      heading: player.inCar ? player.inCar.heading : player.heading,
      gameMinutes: world.gameMinutes,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(save.key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(save) {
  try {
    const raw = localStorage.getItem(save.key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave(save) {
  return loadGame(save) !== null;
}

export function applySave(world, data) {
  const { player, missions } = world;
  player.money = data.money;
  player.health = data.health ?? 100;
  player.ammo = data.ammo ?? 24;
  player.x = data.x ?? -60;
  player.z = data.z ?? 120;
  player.heading = data.heading ?? Math.PI;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  world.gameMinutes = data.gameMinutes ?? 16 * 60 + 20;
  missions.current = Math.min(data.mission, 2);
  missions.stage = 0;
  missions.done = false;
}
