// Solmar Bay — the wanted system and the Solmar Bay PD.
// Stars rise with crime, cruisers spawn to match them (four at most), chase
// the player, ram the car, and cuff Rico if they corner him on foot.
// Lay low and the heat fades.

import { makeCopCar } from './carMesh.js';
import { CFG } from './config.js';
import { pick } from './random.js';

export function createPolice(scene, rng) {
  const police = {
    wanted: 0,
    cars: [],
    lastCrimeAt: -1000,
    decayTimer: 0,
    bustTimer: 0,
  };

  function spawnCruiser(nearX, nearZ) {
    const mesh = makeCopCar();
    scene.add(mesh);
    const line = pick(rng, CFG.roadLines);
    const axis = pick(rng, ['x', 'z']);
    const along = axis === 'x'
      ? Math.max(-160, Math.min(160, nearX + pick(rng, [-55, 55])))
      : Math.max(-160, Math.min(160, nearZ + pick(rng, [-55, 55])));
    const car = {
      mesh,
      x: axis === 'x' ? along : line,
      z: axis === 'x' ? line : along,
      heading: 0,
      speed: 0,
      ramCooldown: 0,
    };
    car.mesh.position.set(car.x, 0, car.z);
    police.cars.push(car);
    return car;
  }

  function addWanted(n, now) {
    police.wanted = Math.max(0, Math.min(5, police.wanted + n));
    police.lastCrimeAt = now;
    police.decayTimer = 0;
  }

  function setWanted(n, now) {
    police.wanted = Math.max(0, Math.min(5, n));
    police.lastCrimeAt = now;
    police.decayTimer = 0;
  }

  function update(dt, world) {
    const { player } = world;
    const now = world.time;

    // Cruisers on the street match the wanted level, four at most.
    const want = Math.min(police.wanted, CFG.policeCap);
    while (police.cars.length < want) spawnCruiser(player.x, player.z);
    while (police.cars.length > want) {
      const car = police.cars.pop();
      scene.remove(car.mesh);
    }

    // Heat fades when the player stays clean and out of sight.
    if (police.wanted > 0 && now - police.lastCrimeAt > CFG.wantedDecaySeconds) {
      police.decayTimer += dt;
      if (police.decayTimer > 6) {
        let nearest = Infinity;
        for (const car of police.cars) nearest = Math.min(nearest, Math.hypot(car.x - player.x, car.z - player.z));
        if (nearest > 45 || police.cars.length === 0) {
          police.wanted -= 1;
          police.decayTimer = 0;
          police.lastCrimeAt = now;
        }
      }
    }

    // Chase, ram, and (on foot) corner the player.
    let busting = false;
    for (const car of police.cars) {
      car.ramCooldown = Math.max(0, car.ramCooldown - dt);
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let turn = targetHeading - car.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const onFoot = !player.inCar;
      const close = onFoot ? 2.2 : 3.4;
      if (dist > close) {
        car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, turn));
        const top = onFoot && dist < 8 ? 2.5 : CFG.policeTopSpeed;
        car.speed = Math.min(top, car.speed + 16 * dt);
      } else {
        car.speed = Math.max(0, car.speed - 20 * dt);
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const blink = Math.floor(now * 4) % 2 === 0;
      car.mesh.userData.lightRed.material.emissiveIntensity = blink ? 1.8 : 0.25;
      car.mesh.userData.lightBlue.material.emissiveIntensity = blink ? 0.25 : 1.8;

      if (dist < 3.2 && car.ramCooldown <= 0) {
        car.ramCooldown = 2;
        if (player.inCar && player.car) {
          player.car.speed *= 0.6;
          player.car.x += (dx / (dist || 1)) * 1.5;
          player.car.z += (dz / (dist || 1)) * 1.5;
          world.onRam?.();
        } else if (dist < 2.2) {
          busting = true;
        }
      }
      if (onFoot && dist < 1.9) busting = true;
    }
    police.bustTimer = busting ? police.bustTimer + dt : 0;
    if (police.bustTimer > 1.5) {
      police.bustTimer = 0;
      world.onBusted?.();
    }
  }

  return { police, addWanted, setWanted, update };
}
