// Drivable parked cars, driving physics, stealing and collisions.
// Cars are built with buildCarMesh from carMesh.js; a car object is
// { group, kind, color, heading, speed, maxSpeed, accel, isPlayer,
//   isPolice, isTraffic, health } and group.position is the truth.
import { buildCarMesh } from './carMesh.js';

const SPECS = {
  sedan: { maxSpeed: 26, accel: 14 },
  taxi: { maxSpeed: 26, accel: 14 },
  truck: { maxSpeed: 20, accel: 10 },
  sport: { maxSpeed: 38, accel: 20 },
  police: { maxSpeed: 34, accel: 17 },
};

const CAR_RADIUS = 1.2;
const ENTER_DIST = 3.5;
const PED_HIT_DIST = 1.8;
const TRAFFIC_HIT_DIST = 2.6;

function makeCar(kind, color, x, z, heading) {
  const group = buildCarMesh(color, kind);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  const spec = SPECS[kind] || SPECS.sedan;
  return {
    group,
    kind,
    color,
    heading,
    speed: 0,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    isPlayer: false,
    isPolice: kind === 'police',
    isTraffic: false,
    health: 100,
  };
}

export function createVehicles(scene, city, rng, traffic) {
  const spawn = (city.spawn && city.spawn.onFoot) || city.spawn || { x: 0, z: 0 };

  // Find a roadside spot near a wanted offset, falling back to the raw point.
  function parkSpot(dx, dz) {
    let x = spawn.x + dx;
    let z = spawn.z + dz;
    if (city.roadPointNear) {
      try {
        const p = city.roadPointNear({ x, z });
        if (p) { x = p.x; z = p.z; }
      } catch { /* keep the raw point */ }
    }
    if (city.isBlocked) {
      for (let tries = 0; tries < 6 && city.isBlocked(x, z, CAR_RADIUS + 0.5); tries += 1) {
        x += 3;
        z += 2;
      }
    }
    return { x, z };
  }

  function park(kind, color, dx, dz, heading) {
    const spot = parkSpot(dx, dz);
    const car = makeCar(kind, color, spot.x, spot.z, heading);
    scene.add(car.group);
    return car;
  }

  const parked = [
    park('sedan', 0x2f6fd0, 14, 6, Math.PI / 2),
    park('taxi', 0xf2c200, 22, -8, -Math.PI / 2),
    park('truck', 0xe8e8e8, -18, 10, 0),
    park('sedan', 0xc0392b, -26, -6, Math.PI),
    park('sedan', 0x27ae60, 8, -22, Math.PI / 2),
  ];

  // The red Solmar GT sport car for mission 2.
  const sportSpot = city.sportCarSpot || { x: spawn.x + 30, z: spawn.z + 30 };
  const sportCar = makeCar('sport', 0xd21f2b, sportSpot.x, sportSpot.z, 0);
  sportCar.isMissionSport = true;
  scene.add(sportCar.group);
  parked.push(sportCar);

  const drivable = parked;
  const home = drivable.map((car) => ({
    car,
    x: car.group.position.x,
    z: car.group.position.z,
    heading: car.heading,
  }));

  function addWanted(G, n) {
    if (G && G.police && typeof G.police.addWanted === 'function') {
      G.police.addWanted(n, G);
    }
  }

  function audioEngine(G, car) {
    if (!G || !G.audio || typeof G.audio.engine !== 'function') return;
    try {
      G.audio.engine(Math.min(1, Math.abs(car.speed) / car.maxSpeed));
    } catch { /* audio is best-effort */ }
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestDist = maxDist;
    const consider = (car) => {
      if (!car || car.isPlayer) return;
      const dx = car.group.position.x - pos.x;
      const dz = car.group.position.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) { bestDist = d; best = car; }
    };
    drivable.forEach(consider);
    const trafficCars = (traffic && traffic.cars) || [];
    trafficCars.forEach(consider);
    return best;
  }

  function enterCar(player, car, G) {
    player.onFoot = false;
    player.inCar = car;
    car.isPlayer = true;
    car.speed = 0;
    player.group.visible = false;
    player.group.position.copy(car.group.position);
    if (G) G.message = '';
  }

  function stealCar(player, car, G) {
    enterCar(player, car, G);
    addWanted(G, 1);
    if (G) {
      G.message = 'Car stolen! Wanted level up';
      G.messageTimer = 3;
    }
  }

  function exitCar(player, G) {
    const car = player.inCar;
    if (!car) return;
    // Step out on the car's left side.
    const sideX = Math.cos(car.heading);
    const sideZ = -Math.sin(car.heading);
    let x = car.group.position.x + sideX * 2;
    let z = car.group.position.z + sideZ * 2;
    if (city.isBlocked && city.isBlocked(x, z, 0.6)) {
      x = car.group.position.x - sideX * 2;
      z = car.group.position.z - sideZ * 2;
    }
    car.isPlayer = false;
    car.speed = 0;
    player.inCar = null;
    player.onFoot = true;
    player.group.visible = true;
    player.group.position.set(x, 0, z);
    player.heading = car.heading;
    player.group.rotation.y = car.heading;
    if (G && G.audio && typeof G.audio.engine === 'function') {
      try { G.audio.engine(0); } catch { /* ignore */ }
    }
  }

  function drive(dt, G, player, car) {
    const keys = G.input.keys;
    const fwd = keys.has('KeyW') ? 1 : 0;
    const back = keys.has('KeyS') ? 1 : 0;
    const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);

    if (fwd) car.speed += car.accel * dt;
    if (back) {
      // Brake hard while rolling forward, reverse once stopped.
      car.speed -= (car.speed > 0.5 ? car.accel * 1.6 : car.accel * 0.6) * dt;
    }
    if (!fwd && !back) {
      // Rolling drag plus a little engine braking.
      car.speed -= car.speed * 0.7 * dt;
    }
    const reverseMax = 9;
    car.speed = Math.max(-reverseMax, Math.min(car.maxSpeed, car.speed));
    if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;

    // Steering bites harder with speed and flips when reversing.
    const grip = Math.min(1, Math.abs(car.speed) / 10);
    car.heading += steer * 2.0 * grip * Math.sign(car.speed || 1) * dt;
    car.group.rotation.y = car.heading;

    const stepX = Math.sin(car.heading) * car.speed * dt;
    const stepZ = Math.cos(car.heading) * car.speed * dt;
    const px = car.group.position.x;
    const pz = car.group.position.z;
    let hitWall = false;
    if (!city.isBlocked || !city.isBlocked(px + stepX, pz, CAR_RADIUS)) {
      car.group.position.x = px + stepX;
    } else {
      hitWall = true;
    }
    if (!city.isBlocked || !city.isBlocked(car.group.position.x, pz + stepZ, CAR_RADIUS)) {
      car.group.position.z = pz + stepZ;
    } else {
      hitWall = true;
    }
    if (typeof city.bounds === 'number' && Number.isFinite(city.bounds)) {
      const b = city.bounds;
      car.group.position.x = Math.max(-b, Math.min(b, car.group.position.x));
      car.group.position.z = Math.max(-b, Math.min(b, car.group.position.z));
    }
    if (hitWall && Math.abs(car.speed) > 3) {
      car.speed *= -0.3;
      car.health = Math.max(0, car.health - 4);
      if (G) G.shake = Math.max(G.shake || 0, 0.4);
    } else if (hitWall) {
      car.speed *= -0.3;
    }

    player.group.position.copy(car.group.position);
    player.heading = car.heading;
    audioEngine(G, car);
  }

  function hitPedestrians(dt, G, car) {
    const peds = (G.peds && G.peds.peds) || [];
    for (const ped of peds) {
      if (!ped || !ped.group || ped.fallen) continue;
      const dx = ped.group.position.x - car.group.position.x;
      const dz = ped.group.position.z - car.group.position.z;
      if (Math.hypot(dx, dz) > PED_HIT_DIST) continue;
      const len = Math.hypot(dx, dz) || 1;
      ped.group.position.x += (dx / len) * 2.5;
      ped.group.position.z += (dz / len) * 2.5;
      ped.fallen = true;
      ped.fallTimer = 1.5;
      addWanted(G, 1);
      if (G) {
        G.message = 'You hit a pedestrian!';
        G.messageTimer = 3;
        G.shake = Math.max(G.shake || 0, 0.5);
      }
      car.speed *= 0.85;
    }
  }

  function hitTraffic(dt, G, car) {
    const trafficCars = (traffic && traffic.cars) || [];
    for (const other of trafficCars) {
      if (!other || !other.group || other.isPlayer || other === car) continue;
      const dx = car.group.position.x - other.group.position.x;
      const dz = car.group.position.z - other.group.position.z;
      const d = Math.hypot(dx, dz);
      if (!Number.isFinite(d) || d > TRAFFIC_HIT_DIST || d === 0) continue;
      const push = (TRAFFIC_HIT_DIST - d) * 0.7;
      other.group.position.x -= (dx / d) * push;
      other.group.position.z -= (dz / d) * push;
      other.speed = (other.speed || 0) * 0.5 + car.speed * 0.2;
      car.speed *= 0.7;
      if (G) G.shake = Math.max(G.shake || 0, 0.35);
    }
  }

  function update(dt, G) {
    const player = G.player;
    if (!player) return;

    // E: get in / steal a nearby car, or get out while slow (play screen only).
    const pressed = G.input && G.input.pressed;
    if (pressed && pressed.has('KeyE') && G.screen === 'play') {
      pressed.delete('KeyE');
      if (player.onFoot) {
        const car = nearestCar(player.pos, ENTER_DIST);
        if (car) {
          if (car.isTraffic) stealCar(player, car, G);
          else enterCar(player, car, G);
        }
      } else if (player.inCar) {
        if (Math.abs(player.inCar.speed) < 1) exitCar(player, G);
        else if (G) {
          G.message = 'Slow down to get out!';
          G.messageTimer = 1.5;
        }
      }
    }

    if (!player.onFoot && player.inCar) {
      if (G.screen === 'play') {
        drive(dt, G, player, player.inCar);
        hitPedestrians(dt, G, player.inCar);
        hitTraffic(dt, G, player.inCar);
      } else {
        audioEngine(G, player.inCar);
      }
    }
  }

  function reset() {
    for (const entry of home) {
      const car = entry.car;
      car.group.position.set(entry.x, 0, entry.z);
      car.heading = entry.heading;
      car.group.rotation.y = entry.heading;
      car.speed = 0;
      car.health = 100;
      car.isPlayer = false;
    }
  }

  return { drivable, update, nearestCar, enterCar, exitCar, stealCar, reset };
}
