// Solmar Bay — NPC traffic: cars cruising the avenue grid.
// Each car owns one road line and one lane; it follows, wraps, and slows
// for the car ahead instead of piling up.

import { makeCar } from './carMesh.js';
import { CFG, PALETTE } from './config.js';
import { pick, pickSign, range } from './random.js';

export function createTraffic(scene, rng) {
  const cars = [];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const axis = pick(rng, ['x', 'z']);
    const line = pick(rng, CFG.roadLines);
    const dir = pickSign(rng);
    const lane = dir > 0 ? 2.6 : -2.6;
    const car = {
      mesh: makeCar(pick(rng, PALETTE.carColors)),
      axis,
      line,
      lane,
      dir,
      speed: range(rng, 9, 15),
      cruise: 0,
      x: 0,
      z: 0,
      heading: 0,
      parked: false,
    };
    car.cruise = car.speed;
    const along = range(rng, -160, 160);
    if (axis === 'x') {
      car.x = along;
      car.z = line + lane;
      car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = line + lane;
      car.z = along;
      car.heading = dir > 0 ? 0 : Math.PI;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    scene.add(car.mesh);
    cars.push(car);
  }

  function carAhead(car) {
    let best = null;
    let bestGap = 9;
    for (const other of cars) {
      if (other === car || other.axis !== car.axis || other.line !== car.line || other.lane !== car.lane) continue;
      const gap = (car.axis === 'x' ? (other.x - car.x) * car.dir : (other.z - car.z) * car.dir);
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    }
    return best;
  }

  function update(dt) {
    for (const car of cars) {
      if (car.parked || car.speed === 0) {
        car.mesh.position.set(car.x, 0, car.z);
        continue;
      }
      const ahead = carAhead(car);
      const target = ahead ? Math.max(0, ahead.speed - 1) : car.cruise;
      car.speed += Math.max(-8 * dt, Math.min(5 * dt, target - car.speed));
      if (car.axis === 'x') {
        car.x += car.dir * car.speed * dt;
        if (car.x > 172) car.x = -172;
        if (car.x < -172) car.x = 172;
      } else {
        car.z += car.dir * car.speed * dt;
        if (car.z > 172) car.z = -172;
        if (car.z < -172) car.z = 172;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  function removeCar(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    scene.remove(car.mesh);
  }

  function parkCar(car) {
    car.parked = true;
    car.speed = 0;
    if (!cars.includes(car)) cars.push(car);
    if (!car.mesh.parent) scene.add(car.mesh);
  }

  return { cars, update, removeCar, parkCar };
}
