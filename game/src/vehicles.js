// Solmar Bay — driving: steal a car, drive it, get out again.
// Steering, acceleration, building and traffic collisions, and the little
// shove that keeps a stolen car from sticking to the car it overtook.

import { CFG } from './config.js';
import { collideBuildings, clampToWorld } from './city.js';

export function nearestStealableCar(player, traffic, maxDist = 5) {
  let best = null;
  let bestD = maxDist;
  for (const car of traffic.cars) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function stealCar(world, car) {
  const { player, traffic } = world;
  traffic.removeCar(car);
  // removeCar takes the mesh out of the scene; the stolen car stays visible
  // under its new driver.
  world.scene.add(car.mesh);
  player.car = car;
  player.car.speed = 0;
  player.inCar = true;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  player.mesh.visible = false;
  return car;
}

export function exitCar(world) {
  const { player, traffic } = world;
  const car = player.car;
  if (!car) return;
  const sideX = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  player.x = car.x + sideX * 2.4;
  player.z = car.z + sideZ * 2.4;
  player.heading = car.heading;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  player.mesh.visible = true;
  player.inCar = false;
  player.car = null;
  traffic.parkCar(car);
}

export function updateDriving(world, dt, input) {
  const { player } = world;
  const car = player.car;
  if (!car) return;
  if (input.has('KeyW')) car.speed += CFG.carAccel * dt;
  else if (input.has('KeyS')) {
    car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  car.speed = Math.max(-CFG.carReverseMax, Math.min(CFG.carMaxSpeed, car.speed));
  const steerInput = (input.has('KeyA') ? 1 : 0) - (input.has('KeyD') ? 1 : 0);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steerInput * CFG.carSteer * steerAuthority * dt * Math.sign(car.speed || 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;

  // Buildings stop the car, they do not swallow it.
  const pushed = collideBuildings(car.x, car.z, 1.7, world.city.colliders);
  if (pushed.pushed) {
    car.x = pushed.x;
    car.z = pushed.z;
    car.speed *= 0.4;
  }
  const clamped = clampToWorld(car.x, car.z);
  if (clamped.x !== car.x || clamped.z !== car.z) {
    car.x = clamped.x;
    car.z = clamped.z;
    car.speed *= 0.4;
  }

  // Bumping NPC traffic: shove sideways, bleed speed, never glue together.
  for (const other of world.traffic.cars) {
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      car.x += nx * push;
      car.z += nz * push;
      other.x -= nx * push;
      other.z -= nz * push;
      if (Math.abs(car.speed) > 6) {
        car.speed *= 0.72;
        world.onCarCrash?.(other);
      }
    }
  }

  // A fast car bowls pedestrians over (and the law notices).
  if (Math.abs(car.speed) > 4) {
    const walker = world.peds.nearest(car.x, car.z, 2.4);
    if (walker) {
      world.peds.knockDown(walker);
      world.onPedestrianHit?.();
      car.speed *= 0.85;
    }
  }

  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
}

export function speedMph(player) {
  if (!player.inCar || !player.car) return 0;
  return Math.abs(player.car.speed) * 2.23694;
}
