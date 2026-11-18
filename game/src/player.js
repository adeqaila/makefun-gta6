// Solmar Bay — Rico Vale on foot.
// WASD relative to the camera, Shift to run, building collision, walk bob.

import { makeRico } from './carMesh.js';
import { CFG } from './config.js';
import { collideBuildings, clampToWorld } from './city.js';

export function createPlayer(scene) {
  const mesh = makeRico();
  scene.add(mesh);
  const player = {
    mesh,
    x: 0,
    z: 8,
    heading: Math.PI,
    health: CFG.startHealth,
    money: CFG.startMoney,
    ammo: CFG.startAmmo,
    inCar: false,
    car: null,
    walkPhase: 0,
    moving: false,
    hurtTimer: 0,
    regenTimer: 0,
  };
  mesh.position.set(player.x, 0, player.z);
  mesh.rotation.y = player.heading;

  function updateOnFoot(dt, input, camYaw, colliders) {
    let mx = 0;
    let mz = 0;
    if (input.has('KeyW')) { mx += -Math.sin(camYaw); mz += -Math.cos(camYaw); }
    if (input.has('KeyS')) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.has('KeyA')) { mx += -Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.has('KeyD')) { mx += Math.cos(camYaw); mz += -Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    player.moving = len > 0;
    if (player.moving) {
      mx /= len;
      mz /= len;
      const speed = input.has('ShiftLeft') || input.has('ShiftRight') ? CFG.runSpeed : CFG.walkSpeed;
      player.x += mx * speed * dt;
      player.z += mz * speed * dt;
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * speed * 1.6;
    }
    const pushed = collideBuildings(player.x, player.z, 0.6, colliders);
    player.x = pushed.x;
    player.z = pushed.z;
    const clamped = clampToWorld(player.x, player.z);
    player.x = clamped.x;
    player.z = clamped.z;
    mesh.position.set(player.x, player.moving ? Math.abs(Math.sin(player.walkPhase)) * 0.07 : 0, player.z);
    mesh.rotation.y = player.heading;
  }

  function hurt(amount) {
    player.health = Math.max(0, player.health - amount);
    player.hurtTimer = 0;
    player.regenTimer = 0;
  }

  function regen(dt) {
    player.regenTimer += dt;
    if (player.regenTimer > 8 && player.health > 0 && player.health < CFG.startHealth) {
      player.health = Math.min(CFG.startHealth, player.health + 2 * dt);
    }
  }

  return { player, updateOnFoot, hurt, regen };
}
