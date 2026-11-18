// SOLMAR BAY — driving: arcade car physics, stealing, collisions.
// One job: move the car the player sits in, and get him in and out of it.

import THREE from './three.js';
import { CAR, PALETTE } from './config.js';
import { pick } from './random.js';
import { buildCarMesh } from './carMesh.js';
import { collideBuildings } from './city.js';
import { nearestTrafficCar, removeTrafficCar } from './traffic.js';

// A car the player can drive: wraps a mesh plus arcade state.
export function makeDrivableCar(scene, color, kind, x, z, heading) {
  const mesh = buildCarMesh(color, kind);
  const car = {
    mesh: mesh.group,
    wheels: mesh.wheels,
    strobes: mesh.strobes,
    x, z, heading,
    speed: 0,
    steer: 0,
    kind,
    color,
    trafficRef: null, // the traffic car this body was stolen from, if any
  };
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = heading;
  scene.add(mesh.group);
  return car;
}

export function updateDriving(car, input, dt, buildings, traffic, onBump) {
  const forward = input.keys['KeyW'] || input.keys['ArrowUp'];
  const back = input.keys['KeyS'] || input.keys['ArrowDown'];
  const left = input.keys['KeyA'] || input.keys['ArrowLeft'];
  const right = input.keys['KeyD'] || input.keys['ArrowRight'];
  const targetSteer = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (forward) car.speed += CAR.accel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = THREE.MathUtils.clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += car.steer * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 8) * dir;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collideBuildings(buildings, nx, nz, 2.2);
  if (fixed.x !== nx || fixed.z !== nz) {
    car.speed *= 0.4; // scraped a building
    if (Math.abs(car.speed) > 6 && onBump) onBump(Math.abs(car.speed));
  }
  car.x = THREE.MathUtils.clamp(fixed.x, -292, 296);
  car.z = THREE.MathUtils.clamp(fixed.z, -292, 292);
  // bump into traffic cars: slow down, shove them sideways out of the way
  for (const other of traffic.cars) {
    if (other.bumpCd > 0) other.bumpCd -= dt;
    const d = Math.hypot(other.x - car.x, other.z - car.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) * 0.5;
      const ax = (other.x - car.x) / d;
      const az = (other.z - car.z) / d;
      // mostly sideways, so the shoved car leaves the player's lane
      other.x += ax * push * 0.3 + -az * push * 1.1;
      other.z += az * push * 0.3 + ax * push * 1.1;
      if (other.bumpCd <= 0) {
        other.bumpCd = 0.5;
        car.speed *= 0.9;
        if (Math.abs(car.speed) > 8 && onBump) onBump(Math.abs(car.speed));
      }
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.42;
  return car.speed;
}

// Try to enter the nearest car: the player's own parked car, or steal a traffic car.
export function tryEnterCar(world) {
  const { player, traffic, scene, rng } = world;
  if (player.inCar) return null;
  // own parked car first
  if (world.parkedCar) {
    const d = Math.hypot(world.parkedCar.x - player.x, world.parkedCar.z - player.z);
    if (d < 4) {
      player.inCar = world.parkedCar;
      world.parkedCar = null;
      player.mesh.visible = false;
      return { stolen: false };
    }
  }
  const victim = nearestTrafficCar(traffic, player.x, player.z, 4.5);
  if (!victim) return null;
  removeTrafficCar(scene, traffic, victim);
  const car = makeDrivableCar(scene, pick(rng, PALETTE.car), 'sedan', victim.x, victim.z, victim.heading);
  car.speed = 0;
  player.inCar = car;
  player.mesh.visible = false;
  return { stolen: true };
}

export function exitCar(world) {
  const { player } = world;
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  player.heading = car.heading;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  world.parkedCar = car;
}

export function speedMph(car) {
  return Math.abs(car.speed) * 2.23694;
}
