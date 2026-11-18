// SOLMAR BAY — combat: punching, shooting, tracers and armed rivals.
// One job: hurt things at range or up close, and let rivals shoot back.

import THREE from './three.js';
import { PLAYER } from './config.js';
import { buildPersonMesh } from './carMesh.js';
import { range, pick } from './random.js';

export function createCombat(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  const flash = new THREE.PointLight(0xffd27a, 0, 18);
  scene.add(flash);
  return {
    enemies: [],
    tracer,
    tracerTimer: 0,
    flash,
    flashTimer: 0,
    shootCooldown: 0,
  };
}

// Spawn an armed rival at (x,z): a mission enemy who shoots at Rico.
export function spawnEnemy(combat, scene, rng, x, z) {
  const mesh = buildPersonMesh(pick(rng, [0x22242a, 0x3a2a3a, 0x1d2f4a]));
  const enemy = {
    mesh: mesh.group,
    legs: mesh.legs,
    x, z,
    heading: range(rng, 0, Math.PI * 2),
    health: 60,
    shootTimer: range(rng, 1, 2),
    walkPhase: 0,
  };
  mesh.group.position.set(x, 0, z);
  scene.add(mesh.group);
  combat.enemies.push(enemy);
  return enemy;
}

export function removeEnemy(combat, scene, enemy) {
  scene.remove(enemy.mesh);
  combat.enemies.splice(combat.enemies.indexOf(enemy), 1);
}

// Fire one shot from the player toward a world point. Returns what was hit.
export function playerShoot(world, targetPoint) {
  const { player, combat, scene, rng } = world;
  if (player.ammo <= 0 || combat.shootCooldown > 0) return null;
  combat.shootCooldown = 0.25;
  player.ammo -= 1;
  const from = new THREE.Vector3(
    player.inCar ? player.inCar.x : player.x,
    1.5,
    player.inCar ? player.inCar.z : player.z,
  );
  const dir = new THREE.Vector3().subVectors(targetPoint, from).normalize();
  const ray = new THREE.Raycaster(from, dir, 0.1, 120);
  // muzzle flash + tracer from the player to the hit (or the far point)
  const hitEnemies = combat.enemies.map((e) => e.mesh);
  const hits = ray.intersectObjects(hitEnemies, true);
  let end = from.clone().addScaledVector(dir, 60);
  let hit = null;
  if (hits.length > 0) {
    end = hits[0].point;
    let obj = hits[0].object;
    while (obj && !combat.enemies.some((e) => e.mesh === obj)) obj = obj.parent;
    const enemy = combat.enemies.find((e) => e.mesh === obj);
    if (enemy) {
      enemy.health -= 34;
      hit = { type: 'enemy', enemy };
      if (enemy.health <= 0) {
        removeEnemy(combat, scene, enemy);
        player.money += 50;
        if (world.hud) world.hud.toast('Rival down — +$50');
      }
    }
  }
  combat.tracer.geometry.setFromPoints([from, end]);
  combat.tracer.visible = true;
  combat.tracerTimer = 0.08;
  combat.flash.position.copy(from).addScaledVector(dir, 2);
  combat.flash.intensity = 6;
  combat.flashTimer = 0.06;
  if (world.audio) world.audio.gunshot();
  if (world.police) world.police.wanted = Math.min(5, Math.max(world.police.wanted, 1));
  return hit;
}

// A punch: hurts the nearest enemy or ped within reach.
export function playerPunch(world) {
  const { player, combat, peds, rng } = world;
  if (player.punchCooldown > 0) return;
  player.punchCooldown = 0.5;
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  for (const enemy of [...combat.enemies]) {
    if (Math.hypot(enemy.x - px, enemy.z - pz) < PLAYER.punchRange) {
      enemy.health -= PLAYER.punchDamage;
      if (enemy.health <= 0) {
        removeEnemy(combat, world.scene, enemy);
        player.money += 50;
      }
      if (world.audio) world.audio.thud();
      return;
    }
  }
  if (peds) {
    for (const ped of peds.peds) {
      if (Math.hypot(ped.x - px, ped.z - pz) < PLAYER.punchRange) {
        if (world.police) world.police.wanted = Math.min(5, world.police.wanted + 1);
        if (world.audio) world.audio.thud();
        return;
      }
    }
  }
}

export function updateCombat(combat, world, dt) {
  const { player, rng } = world;
  if (combat.shootCooldown > 0) combat.shootCooldown -= dt;
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    if (combat.tracerTimer <= 0) combat.tracer.visible = false;
  }
  if (combat.flashTimer > 0) {
    combat.flashTimer -= dt;
    if (combat.flashTimer <= 0) combat.flash.intensity = 0;
  }
  // rivals: walk toward Rico and shoot at him
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  for (const enemy of combat.enemies) {
    const d = Math.hypot(px - enemy.x, pz - enemy.z);
    if (d > 3) {
      enemy.heading = Math.atan2(px - enemy.x, pz - enemy.z);
      enemy.x += Math.sin(enemy.heading) * 3.5 * dt;
      enemy.z += Math.cos(enemy.heading) * 3.5 * dt;
      enemy.walkPhase += dt * 5;
    }
    enemy.mesh.position.set(enemy.x, 0, enemy.z);
    enemy.mesh.rotation.y = enemy.heading;
    enemy.legs[0].rotation.x = Math.sin(enemy.walkPhase) * 0.5;
    enemy.legs[1].rotation.x = -Math.sin(enemy.walkPhase) * 0.5;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && d < 45) {
      enemy.shootTimer = range(rng, 1.2, 2.2);
      if (rng() < 0.45 && world.onPlayerHit) world.onPlayerHit(range(rng, 4, 9));
      const from = new THREE.Vector3(enemy.x, 1.5, enemy.z);
      const to = new THREE.Vector3(px, 1.3, pz);
      combat.tracer.geometry.setFromPoints([from, to]);
      combat.tracer.visible = true;
      combat.tracerTimer = 0.08;
      if (world.audio) world.audio.gunshot(true);
    }
  }
}
