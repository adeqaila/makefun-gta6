// Solmar Bay — deterministic staging for the four screenshots.
// Each shot arranges the live game into one readable frame, freezes the
// simulation, and reports the staged state for the capture harness.
// Same seed, same staging, same pixels — every time.

import { stealCar, speedMph } from './vehicles.js';

function placeTrafficCar(world, index, x, z, heading, speed) {
  const car = world.traffic.cars[index];
  if (!car) return null;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.cruise = speed;
  car.parked = false;
  car.placed = true;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  return car;
}

// Move every unplaced traffic car far out of the camera's corridor so a
// random commuter never photobombs the shot.
function sweepTraffic(world, zStart) {
  let k = 0;
  for (const car of world.traffic.cars) {
    if (car.placed) continue;
    car.x = k % 2 === 0 ? 62.6 : -62.6;
    car.z = zStart + k * 8;
    car.heading = 0;
    car.speed = 10;
    car.cruise = 10;
    car.parked = false;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = 0;
    k++;
  }
}

function summary(world, shot) {
  return {
    shot,
    wanted: world.police.wanted,
    money: Math.floor(world.player.money),
    mission: world.missions.current,
    speedMph: Math.round(speedMph(world.player)),
    police: world.police.cars.length,
    traffic: world.traffic.cars.length,
    peds: world.peds.walkers.length,
    health: Math.round(world.player.health),
    ammo: world.player.ammo,
  };
}

function finish(world, shot) {
  world.hudApi.hideBanner();
  world.syncHud();
  world.snapCamera = true;
  world.shotFrozen = true;
  window.__shotState = JSON.stringify(summary(world, shot));
  window.__shotReady = true;
}

export function stageShot(world, shot) {
  const { player } = world;
  if (shot === 1) {
    // Cover: the red Solmar GT at 85 mph down the central avenue, three
    // cruisers on its tail, wanted level 3, M3 on the HUD.
    world.resetRun();
    world.beginPlay();
    const car = placeTrafficCar(world, 0, 0, 30, Math.PI, 38);
    car.mesh.children[0].material.color.set(0xc01818);
    stealCar(world, car);
    car.speed = 38;
    world.policeApi.setWanted(3, world.time);
    world.policeApi.update(0.016, world);
    world.police.cars.forEach((cop, i) => {
      cop.x = (i - 1) * 4.5;
      cop.z = 44 + i * 9;
      cop.heading = Math.PI;
      cop.speed = 34;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = Math.PI;
    });
    placeTrafficCar(world, 0, 2.6, 72, Math.PI, 12);
    placeTrafficCar(world, 1, -2.6, 88, 0, 10);
    sweepTraffic(world, -100);
    player.money = 1250;
    world.missions.current = 2;
    world.setMissionBeacon(2);
    // Camera in front of the GT, looking back at it: the three cruisers
    // on its tail stay in frame behind the car.
    world.camYaw = Math.PI;
    world.camPitch = 0.35;
    finish(world, 1);
    return;
  }
  if (shot === 2) {
    // Street: a blue sedan cruising the avenue, traffic and pedestrians
    // around it, M1 on the HUD.
    world.resetRun();
    world.beginPlay();
    const car = placeTrafficCar(world, 0, 0, -20, Math.PI, 13);
    car.mesh.children[0].material.color.set(0x2456c8);
    stealCar(world, car);
    car.speed = 13;
    placeTrafficCar(world, 0, 2.6, -48, Math.PI, 12);
    placeTrafficCar(world, 1, -2.6, 6, 0, 10);
    placeTrafficCar(world, 2, -2.6, -70, Math.PI, 12);
    const w0 = world.peds.walkers[0];
    w0.x = 7.6; w0.z = -8;
    const w1 = world.peds.walkers[1];
    w1.x = -7.6; w1.z = -34;
    const w2 = world.peds.walkers[2];
    w2.x = 7.6; w2.z = -52;
    sweepTraffic(world, 40);
    world.setMissionBeacon(0);
    world.camYaw = 0;
    world.camPitch = 0.35;
    finish(world, 2);
    return;
  }
  if (shot === 3) {
    // On foot: Rico walking toward an armed rival, the Club Neon Palms
    // beacon glowing ahead, wanted level 1.
    world.resetRun();
    world.beginPlay();
    player.x = 50;
    player.z = 50;
    player.heading = Math.PI / 4;
    player.mesh.position.set(50, 0, 50);
    player.mesh.rotation.y = Math.PI / 4;
    player.money = 650;
    world.combatApi.spawnRivals([{ x: 64, z: 57 }]);
    sweepTraffic(world, -100);
    world.missions.current = 2;
    world.setMissionBeacon(2);
    world.policeApi.setWanted(1, world.time);
    world.policeApi.update(0.016, world);
    if (world.police.cars[0]) {
      const cop = world.police.cars[0];
      cop.x = -30;
      cop.z = 60;
      cop.heading = 0;
      cop.speed = 0;
      cop.mesh.position.set(-30, 0, 60);
      cop.mesh.rotation.y = 0;
    }
    world.camYaw = -Math.PI * 3 / 4;
    world.camPitch = 0.3;
    finish(world, 3);
    return;
  }
  // Shot 4: the title screen over an aerial vista of the whole city.
  world.toTitle();
  world.camYaw = 0;
  finish(world, 4);
}
