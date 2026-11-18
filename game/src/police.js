// Wanted level and police pursuit. Police cars chase the player, ram the
// player's car, bust the player on foot, and fade away when the heat dies.
// Cars are built with buildCarMesh from carMesh.js.
import { buildCarMesh } from './carMesh.js';

const MAX_ACTIVE = 4;
const POLICE_MAX_SPEED = 34;
const POLICE_ACCEL = 17;
const RAM_DIST = 4;
const BUST_DIST = 2;
const DESPAWN_DIST = 120;
const HEAT_COOL_SECONDS = 25;
const DECAY_EVERY_SECONDS = 8;
const STROBE_SECONDS = 0.25;

const WANTED_MESSAGES = [
  '',
  'Wanted level 1 — the police are watching',
  'Wanted level 2 — patrol cars are on you',
  'Wanted level 3 — the whole precinct is after you',
  'Wanted level 4 — roadblocks ahead, stay sharp',
  'Wanted level 5 — maximum heat! Lose them!',
];

function angleLerp(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

export function createPolice(scene, city, rng) {
  const cars = [];
  let strobeTimer = 0;
  let strobeOn = false;
  let decayTimer = 0;

  function random() {
    return typeof rng === 'function' ? rng() : Math.random();
  }

  function spawnPoliceCar(nearPos, G) {
    let x = nearPos.x;
    let z = nearPos.z;
    if (city.roadPointNear) {
      try {
        const p = city.roadPointNear(nearPos);
        if (p) { x = p.x; z = p.z; }
      } catch { /* keep the offset point */ }
    }
    const group = buildCarMesh(0x1a1d24, 'police');
    group.position.set(x, 0, z);
    const heading = random() * Math.PI * 2;
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      group,
      kind: 'police',
      color: 0x1a1d24,
      heading,
      speed: 0,
      maxSpeed: POLICE_MAX_SPEED,
      accel: POLICE_ACCEL,
      isPlayer: false,
      isPolice: true,
      isTraffic: false,
      health: 100,
      ramCooldown: 0,
    };
    cars.push(car);
    return car;
  }

  function addWanted(n, G) {
    if (!G) return;
    G.wanted = Math.min(5, (G.wanted || 0) + n);
    G.wantedHeat = 0;
    decayTimer = 0;
    const text = WANTED_MESSAGES[G.wanted] || '';
    if (text) {
      G.message = text;
      G.messageTimer = 3;
    }
  }

  function nearestPoliceDist(playerPos) {
    let best = Infinity;
    for (const car of cars) {
      const d = Math.hypot(
        car.group.position.x - playerPos.x,
        car.group.position.z - playerPos.z,
      );
      if (d < best) best = d;
    }
    return best;
  }

  function chase(dt, G, car, targetPos) {
    const dx = targetPos.x - car.group.position.x;
    const dz = targetPos.z - car.group.position.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const turnRate = 2.4;
    car.heading = angleLerp(car.heading, desired, Math.min(1, turnRate * dt));
    car.group.rotation.y = car.heading;
    car.speed = Math.min(car.maxSpeed, car.speed + car.accel * dt);

    const stepX = Math.sin(car.heading) * car.speed * dt;
    const stepZ = Math.cos(car.heading) * car.speed * dt;
    const px = car.group.position.x;
    const pz = car.group.position.z;
    if (!city.isBlocked || !city.isBlocked(px + stepX, pz, 1.2)) {
      car.group.position.x = px + stepX;
    }
    if (!city.isBlocked || !city.isBlocked(car.group.position.x, pz + stepZ, 1.2)) {
      car.group.position.z = pz + stepZ;
    }
    return dist;
  }

  function update(dt, G) {
    if (!G) return;
    G.wantedHeat = (G.wantedHeat || 0) + dt;
    const player = G.player;
    if (!player) return;

    // Keep the active squad at the wanted level (capped).
    const wantedCount = Math.min(G.wanted || 0, MAX_ACTIVE);
    while (cars.length < wantedCount) {
      const angle = random() * Math.PI * 2;
      const dist = 60 + random() * 30;
      spawnPoliceCar(
        { x: player.pos.x + Math.sin(angle) * dist, z: player.pos.z + Math.cos(angle) * dist },
        G,
      );
    }

    // Strobe light bar: flip red/blue a few times a second.
    strobeTimer += dt;
    if (strobeTimer >= STROBE_SECONDS) {
      strobeTimer = 0;
      strobeOn = !strobeOn;
      for (const car of cars) {
        const mats = car.group.userData && car.group.userData.strobeMats;
        if (!mats) continue;
        if (mats.red && mats.red.emissive) {
          mats.red.emissiveIntensity = strobeOn ? 3 : 0.15;
        }
        if (mats.blue && mats.blue.emissive) {
          mats.blue.emissiveIntensity = strobeOn ? 0.15 : 3;
        }
      }
    }

    // Siren while any unit is active.
    if (G.audio && typeof G.audio.siren === 'function') {
      try { G.audio.siren(cars.length > 0); } catch { /* audio is best-effort */ }
    }

    if (G.screen !== 'play') return;

    const targetPos = player.inCar ? player.inCar.group.position : player.pos;
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      if (car.ramCooldown > 0) car.ramCooldown -= dt;

      const distToPlayer = Math.hypot(
        car.group.position.x - player.pos.x,
        car.group.position.z - player.pos.z,
      );

      if ((G.wanted || 0) === 0) {
        // Heat is off: cruise away and despawn once far enough.
        car.speed = Math.min(18, car.speed + car.accel * dt);
        car.group.position.x += Math.sin(car.heading) * car.speed * dt;
        car.group.position.z += Math.cos(car.heading) * car.speed * dt;
        if (distToPlayer > DESPAWN_DIST) {
          scene.remove(car.group);
          cars.splice(i, 1);
        }
        continue;
      }

      const dist = chase(dt, G, car, targetPos);

      if (player.inCar && dist < RAM_DIST && car.ramCooldown <= 0) {
        // Ram the player's car: shove it, chip its health, shake the camera.
        car.ramCooldown = 1;
        const px = player.inCar.group.position.x;
        const pz = player.inCar.group.position.z;
        const dx = px - car.group.position.x;
        const dz = pz - car.group.position.z;
        const len = Math.hypot(dx, dz) || 1;
        player.inCar.group.position.x += (dx / len) * 1.5;
        player.inCar.group.position.z += (dz / len) * 1.5;
        player.inCar.speed *= 0.7;
        player.inCar.health = Math.max(0, (player.inCar.health || 100) - 3);
        G.shake = 0.7;
      } else if (player.onFoot && distToPlayer < BUST_DIST) {
        // Busted on foot: steady damage while a unit is touching the player.
        player.takeDamage(10 * dt, G);
      }
    }

    // Wanted decay: quiet for a while with no unit close, then cool off.
    if ((G.wanted || 0) > 0 && G.wantedHeat > HEAT_COOL_SECONDS) {
      if (nearestPoliceDist(player.pos) > 45) {
        decayTimer += dt;
        if (decayTimer >= DECAY_EVERY_SECONDS) {
          decayTimer = 0;
          G.wanted = Math.max(0, G.wanted - 1);
          if (G.wanted === 0) {
            G.message = 'You lost the cops. Stay clean.';
            G.messageTimer = 3;
          }
        }
      } else {
        decayTimer = 0;
      }
    }
  }

  function clear() {
    for (const car of cars) scene.remove(car.group);
    cars.length = 0;
  }

  function reset() {
    clear();
    strobeTimer = 0;
    strobeOn = false;
    decayTimer = 0;
  }

  return { cars, update, addWanted, spawnPoliceCar, clear, reset };
}
