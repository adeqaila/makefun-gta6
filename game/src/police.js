// SOLMAR BAY — wanted level and the police who answer it.
// One job: stars, police pursuit cars, and getting busted on foot.

import THREE from './three.js';
import { POLICE } from './config.js';
import { makeDrivableCar } from './vehicles.js';
import { range } from './random.js';
import { roadPointNear } from './city.js';

export function createPolice(scene) {
  return {
    wanted: 0,
    cars: [],
    bustTimer: 0,
    quietTimer: 0,
    sirenPhase: 0,
  };
}

export function addWanted(police, stars) {
  police.wanted = THREE.MathUtils.clamp(police.wanted + stars, 0, 5);
  police.quietTimer = 0;
}

export function updatePolice(police, world, dt) {
  const { scene, player, rng } = world;
  const targetX = player.inCar ? player.inCar.x : player.x;
  const targetZ = player.inCar ? player.inCar.z : player.z;
  const targetSpeed = player.inCar ? Math.abs(player.inCar.speed) : Math.abs(player.speed);

  // spawn pursuit cars up to the wanted level (capped)
  const want = Math.min(police.wanted, POLICE.maxActive);
  while (police.cars.length < want) {
    const spot = roadPointNear(targetX + range(rng, -70, 70), targetZ + range(rng, -70, 70));
    const car = makeDrivableCar(scene, 0x1d2f4a, 'police', spot.x, spot.z, range(rng, 0, Math.PI * 2));
    car.speed = 10;
    police.cars.push(car);
  }
  // despawn extras when the heat drops
  while (police.cars.length > want) {
    const car = police.cars.pop();
    scene.remove(car.mesh);
  }

  // pursuit: steer toward the player, ram on contact
  for (const car of police.cars) {
    const dx = targetX - car.x;
    const dz = targetZ - car.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += THREE.MathUtils.clamp(dh, -2.2 * dt, 2.2 * dt);
    const cruise = Math.min(POLICE.chaseSpeed, targetSpeed + 6 + police.wanted * 2);
    car.speed += (cruise - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = THREE.MathUtils.clamp(car.x, -292, 296);
    car.z = THREE.MathUtils.clamp(car.z, -292, 292);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.42;
    if (car.strobes) {
      car.strobes.phase += dt * 8;
      const on = Math.sin(car.strobes.phase) > 0;
      car.strobes.red.emissive.setHex(on ? 0xff0000 : 0x220000);
      car.strobes.blue.emissive.setHex(on ? 0x000022 : 0x0000ff);
    }
    // ram the player's car (with a cooldown, so one hit is one hit)
    if (player.inCar && dist < 3.6) {
      car.ramCooldown = (car.ramCooldown ?? 0) - dt;
      if (car.ramCooldown <= 0) {
        car.ramCooldown = 0.6;
        player.inCar.speed *= 0.92;
        if (world.onPlayerHit) world.onPlayerHit(POLICE.ramDamage);
      }
    }
  }

  // busted on foot: a cop car close by for long enough ends the run
  if (!player.inCar && police.wanted > 0) {
    const nearest = police.cars.reduce((best, c) => {
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      return best === null || d < best ? d : best;
    }, null);
    if (nearest !== null && nearest < POLICE.bustRange) {
      police.bustTimer += dt;
      if (police.bustTimer > POLICE.bustTime && world.onBusted) world.onBusted();
    } else {
      police.bustTimer = Math.max(0, police.bustTimer - dt);
    }
  } else {
    police.bustTimer = 0;
  }

  // cool down: no crime for a while and the cops lose interest, one star at a time
  if (police.wanted > 0) {
    police.quietTimer += dt;
    if (police.quietTimer > 25) {
      police.wanted -= 1;
      police.quietTimer = 0;
      if (world.hud) world.hud.toast('The heat is cooling off…');
    }
  }
  police.sirenPhase += dt;
}

export function clearWanted(police, world) {
  police.wanted = 0;
  police.quietTimer = 0;
  for (const car of police.cars) world.scene.remove(car.mesh);
  police.cars = [];
}
