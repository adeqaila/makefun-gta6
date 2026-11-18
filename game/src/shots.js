// The four screenshot scenes behind ?shot=chase|street|onfoot|start.
// Each one resets the world, then plays the real rules forward for a fixed
// number of fixed steps, steered by a small driving autopilot, so the frame
// is what a short stretch of real play looks like — and the same seed
// always gives the same frame.

const STEP = 1 / 60;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function resetWorld(G) {
  try {
    G.traffic?.reset?.();
  } catch {
    // A reset that throws must not stop the shot.
  }
  try {
    G.peds?.reset?.();
  } catch {
    // Ignore.
  }
  try {
    G.police?.clear?.();
  } catch {
    // Ignore.
  }
  try {
    G.combat?.clearEnemies?.();
  } catch {
    // Ignore.
  }
  try {
    G.player?.reset?.();
  } catch {
    // Ignore.
  }
  try {
    G.missions?.reset?.();
  } catch {
    // Ignore.
  }
  G.wanted = 0;
  G.wantedHeat = 0;
  G.cameraOverride = null;
  G.banner = '';
  G.bannerTimer = 0;
  G.message = '';
  G.messageTimer = 0;
}

/** Fill G.input.keys with synthetic driving input toward a world point. */
function driveToward(G, tx, tz) {
  const car = G.player?.inCar;
  if (!car || !car.group) {
    G.input.keys = new Set();
    return;
  }
  const pos = car.group.position;
  const heading = car.heading || 0;
  const desired = Math.atan2(tx - pos.x, tz - pos.z);
  const diff = wrapAngle(desired - heading);
  const keys = new Set();
  if (Math.abs(diff) > 2.1) {
    keys.add('KeyS');
  } else {
    keys.add('KeyW');
  }
  // Steering: heading grows toward +X, which is screen-left when the camera
  // sits behind the car, so a target to the left (diff > 0) needs KeyA.
  if (diff > 0.18) keys.add('KeyA');
  else if (diff < -0.18) keys.add('KeyD');
  G.input.keys = keys;
}

/** Run the live update order for `seconds`, optionally steering each step. */
function simulate(G, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    G.time += STEP;
    // Same clock/timer bookkeeping as the live loop's step(): banners and
    // toasts must expire during a staged shot, not hang over the frame.
    // One in-game minute passes every two real seconds (0.5 min per second).
    G.gameMinutes += STEP * 0.5;
    if (G.bannerTimer > 0) G.bannerTimer -= STEP;
    if (G.messageTimer > 0) G.messageTimer -= STEP;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - STEP * 1.5);
    if (steer) steer();
    try {
      G.missions?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.player?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.vehicles?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.police?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.traffic?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.peds?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.combat?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
  }
}

function findCar(G, wantSport) {
  const list = G.vehicles?.drivable;
  if (!Array.isArray(list)) return null;
  if (wantSport) return list.find((car) => car?.isMissionSport) || null;
  return list.find((car) => car && !car.isMissionSport) || list[0] || null;
}

function enterCar(G, car) {
  if (!car) return;
  try {
    if (typeof G.vehicles?.enterCar === 'function') {
      G.vehicles.enterCar(G.player, car, G);
      return;
    }
  } catch {
    // Fall through to the manual fallback below.
  }
  // Last resort when the vehicles module has no enterCar yet.
  if (G.player) {
    G.player.inCar = car;
    G.player.onFoot = false;
  }
}

/** The distinct avenue coordinates of the grid (both axes share them). */
function avenueAts(G) {
  const ats = (G.city?.avenues || []).map((a) => a.at);
  const unique = [...new Set(ats)].sort((a, b) => a - b);
  return unique.length ? unique : [-222, -148, -74, 0, 74, 148, 222];
}

function nearestAvenue(G, value) {
  const ats = avenueAts(G);
  let best = ats[0];
  for (const at of ats) {
    if (Math.abs(value - at) < Math.abs(value - best)) best = at;
  }
  return best;
}

/**
 * A target 70 units ahead on the avenue the car is already on, in its lane.
 * At an intersection the driver sometimes turns onto the crossing avenue
 * instead of going straight — chosen once per target, so the car commits.
 */
function roadTarget(G, car) {
  const clampRoad = (v) => Math.max(-245, Math.min(245, v));
  const pos = car.group.position;
  const heading = car.heading || 0;
  const alongX = Math.abs(Math.sin(heading)) >= Math.abs(Math.cos(heading));
  if (alongX) {
    const dir = Math.sin(heading) >= 0 ? 1 : -1;
    // About to leave the city along this avenue: turn onto the nearest
    // crossing avenue instead of driving out onto the sand.
    if (Math.abs(pos.x) > 205 && dir === Math.sign(pos.x)) {
      const crossAt = nearestAvenue(G, pos.x);
      const zDir = G.rng() < 0.5 ? 1 : -1;
      return {
        x: clampRoad(crossAt + G.city.laneFor('z', zDir > 0 ? 0 : Math.PI)),
        z: clampRoad(pos.z + zDir * 55),
      };
    }
    const avZ = nearestAvenue(G, pos.z);
    const crossAt = nearestAvenue(G, pos.x);
    if (Math.abs(pos.x - crossAt) < 12 && G.rng() < 0.35) {
      const zDir = G.rng() < 0.5 ? 1 : -1;
      return {
        x: clampRoad(crossAt + G.city.laneFor('z', zDir > 0 ? 0 : Math.PI)),
        z: clampRoad(pos.z + zDir * 55),
      };
    }
    return { x: clampRoad(pos.x + dir * 70), z: clampRoad(avZ + G.city.laneFor('x', heading)) };
  }
  const dir = Math.cos(heading) >= 0 ? 1 : -1;
  if (Math.abs(pos.z) > 205 && dir === Math.sign(pos.z)) {
    const crossAt = nearestAvenue(G, pos.z);
    const xDir = G.rng() < 0.5 ? 1 : -1;
    return {
      x: clampRoad(pos.x + xDir * 55),
      z: clampRoad(crossAt + G.city.laneFor('x', xDir > 0 ? Math.PI / 2 : -Math.PI / 2)),
    };
  }
  const avX = nearestAvenue(G, pos.x);
  const crossAt = nearestAvenue(G, pos.z);
  if (Math.abs(pos.z - crossAt) < 12 && G.rng() < 0.35) {
    const xDir = G.rng() < 0.5 ? 1 : -1;
    return {
      x: clampRoad(pos.x + xDir * 55),
      z: clampRoad(crossAt + G.city.laneFor('x', xDir > 0 ? Math.PI / 2 : -Math.PI / 2)),
    };
  }
  return { x: clampRoad(avX + G.city.laneFor('z', heading)), z: clampRoad(pos.z + dir * 70) };
}

/** A steer closure that keeps the player's car driving on the roads. */
function makeRoadDriver(G) {
  let target = null;
  return () => {
    const car = G.player?.inCar;
    if (!car?.group) return;
    const pos = car.group.position;
    if (!target || Math.hypot(pos.x - target.x, pos.z - target.z) < 12) {
      target = roadTarget(G, car);
    }
    driveToward(G, target.x, target.z);
  };
}

/**
 * Put one extra traffic car on the player's avenue, `ahead` units in front
 * of the player car, driving `heading`. Used so the street/chase frames show
 * dense traffic instead of an empty road.
 */
function spawnTrafficOnAvenue(G, ahead, heading) {
  const car = G.player?.inCar;
  if (!car?.group || typeof G.traffic?.spawnTrafficCar !== 'function') return;
  // Keep the heading in (-PI, PI] so laneFor picks the right-hand lane.
  heading = wrapAngle(heading);
  const pos = car.group.position;
  const alongX = Math.abs(Math.sin(car.heading || 0)) >= Math.abs(Math.cos(car.heading || 0));
  let spot;
  if (alongX) {
    const avZ = nearestAvenue(G, pos.z);
    const lane = G.city.laneFor('x', heading);
    const x = pos.x + Math.sin(car.heading || 0) * ahead;
    spot = { axis: 'x', avenue: avZ, lane, x, z: avZ + lane, heading };
  } else {
    const avX = nearestAvenue(G, pos.x);
    const lane = G.city.laneFor('z', heading);
    const z = pos.z + Math.cos(car.heading || 0) * ahead;
    spot = { axis: 'z', avenue: avX, lane, x: avX + lane, z, heading };
  }
  try {
    G.traffic.spawnTrafficCar(spot);
  } catch {
    // Extra traffic is garnish; a failed spawn must not stop the shot.
  }
}

/**
 * Frame the chase like a movie still: camera high over the road ahead of
 * the player car, looking back down the street so the car and the police
 * behind it are both in frame.
 */
function frameChaseCamera(G) {
  const car = G.player?.inCar;
  if (!car?.group) return;
  const h = car.heading || 0;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const p = car.group.position;
  G.cameraOverride = {
    pos: { x: p.x + fx * 16, y: 9, z: p.z + fz * 16 },
    look: { x: p.x - fx * 8, y: 1.5, z: p.z - fz * 8 },
  };
  G.cameraYaw = h;
}

/** A staged frame shows a healthy Rico at the briefed wanted level. */
function restoreForShot(G, wanted) {
  if (G.player) G.player.health = 100;
  if (typeof wanted === 'number') {
    G.wanted = wanted;
    G.wantedHeat = 0;
  }
}

function chaseShot(G) {
  resetWorld(G);
  // Play screen first: player, vehicles, police and combat all gate on it.
  G.screen = 'play';
  G.missions?.startMission?.(2);
  const sport = findCar(G, true);
  enterCar(G, sport);
  try {
    G.police?.addWanted?.(3, G);
  } catch {
    // Ignore.
  }
  const p = G.player?.pos;
  for (const [dx, dz] of [[14, 8], [-12, 14]]) {
    try {
      G.police?.spawnPoliceCar?.({ x: (p?.x || 0) + dx, y: 0, z: (p?.z || 0) + dz }, G);
    } catch {
      // One missing cruiser must not stop the shot.
    }
  }
  // A couple of cars ahead on the same avenue for the chase to weave past.
  spawnTrafficOnAvenue(G, 45, Math.PI / 2);
  spawnTrafficOnAvenue(G, 80, Math.PI / 2);
  simulate(G, 12, makeRoadDriver(G));
  // The pursuit must read on camera: if the closest unit fell too far
  // behind during the drive, pull it back to 14 units behind the player.
  try {
    const car = G.player?.inCar;
    if (car?.group && Array.isArray(G.police?.cars) && G.police.cars.length) {
      let nearest = null;
      let nearestD = Infinity;
      for (const unit of G.police.cars) {
        const d = Math.hypot(
          unit.group.position.x - car.group.position.x,
          unit.group.position.z - car.group.position.z,
        );
        if (d < nearestD) { nearestD = d; nearest = unit; }
      }
      if (nearest && nearestD > 30) {
        const h = car.heading || 0;
        nearest.group.position.set(
          car.group.position.x - Math.sin(h) * 14,
          0,
          car.group.position.z - Math.cos(h) * 14,
        );
        nearest.heading = h;
        nearest.group.rotation.y = h;
        nearest.speed = car.speed || 20;
      }
    }
  } catch {
    // Staging the pursuit is optional; the frame stands without it.
  }
  restoreForShot(G, 3);
  // Traffic behind the player reads in the backward-looking chase frame.
  const h = G.player?.inCar?.heading || 0;
  spawnTrafficOnAvenue(G, -25, h);
  spawnTrafficOnAvenue(G, -45, h);
  frameChaseCamera(G);
  G.screen = 'play';
  return { screen: 'play' };
}

function streetShot(G) {
  resetWorld(G);
  // Play screen first: player, vehicles, police and combat all gate on it.
  G.screen = 'play';
  G.missions?.startMission?.(0);
  const sedan = findCar(G, false);
  enterCar(G, sedan);
  // Fill the player's avenue with traffic ahead so the street reads busy.
  // The sedan starts facing +X, so its avenue runs east-west here.
  spawnTrafficOnAvenue(G, 30, Math.PI / 2);
  spawnTrafficOnAvenue(G, 55, Math.PI / 2);
  spawnTrafficOnAvenue(G, 85, Math.PI / 2);
  spawnTrafficOnAvenue(G, 65, -Math.PI / 2);
  simulate(G, 8, makeRoadDriver(G));
  restoreForShot(G, 0);
  // Guarantee traffic in the frozen frame: cars ahead on the same avenue.
  const h = G.player?.inCar?.heading || 0;
  spawnTrafficOnAvenue(G, 25, h);
  spawnTrafficOnAvenue(G, 48, h);
  spawnTrafficOnAvenue(G, 72, h);
  spawnTrafficOnAvenue(G, 55, h + Math.PI);
  G.cameraOverride = null;
  G.cameraYaw = G.player?.inCar?.heading ?? G.player?.heading ?? 0;
  G.screen = 'play';
  return { screen: 'play' };
}

function onFootShot(G) {
  resetWorld(G);
  // Play screen first: player, vehicles, police and combat all gate on it.
  G.screen = 'play';
  G.missions?.startMission?.(0);
  // Stage 1, so the club beacon stands down this same avenue, in frame.
  if (G.missions) G.missions.stage = 1;
  // Rico on avenue z=74 facing east, a gunman 12 units ahead on the road,
  // camera over his shoulder: street, enemy and beacon all in one frame.
  const p = G.player?.pos;
  if (p) p.set(66, 0, 74);
  if (G.player) {
    G.player.heading = Math.PI / 2;
    G.player.group.rotation.y = Math.PI / 2;
  }
  try {
    G.combat?.spawnEnemy?.({ x: 78, y: 0, z: 76.5 }, G);
  } catch {
    // Ignore.
  }
  try {
    G.police?.addWanted?.(1, G);
  } catch {
    // Ignore.
  }
  // Camera a touch to the side so Rico and the gunman do not line up.
  G.cameraOverride = {
    pos: { x: 60, y: 3.2, z: 71.5 },
    look: { x: 78, y: 1.5, z: 76.5 },
  };
  simulate(G, 4, null);
  restoreForShot(G, 1);
  G.screen = 'play';
  return { screen: 'play' };
}

function startShot(G) {
  resetWorld(G);
  // Ambient city only: traffic and pedestrians drift past a standing Rico.
  const steps = Math.round(5 / STEP);
  for (let i = 0; i < steps; i += 1) {
    G.time += STEP;
    try {
      G.traffic?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
    try {
      G.peds?.update?.(STEP, G);
    } catch {
      // Ignore.
    }
  }
  G.cameraOverride = {
    pos: { x: 120, y: 70, z: 160 },
    look: { x: 0, y: 10, z: 0 },
  };
  G.screen = 'title';
  return { screen: 'title' };
}

/**
 * Stage the named scene on G and say which screen to draw over it.
 * Any unknown name stages the title vista, like the starter does.
 */
export function stageShot(name, G) {
  if (name === 'chase') return chaseShot(G);
  if (name === 'street') return streetShot(G);
  if (name === 'onfoot') return onFootShot(G);
  return startShot(G);
}
