// Solmar Bay — combat: fists, pistol, tracers, and rivals who shoot back.
// Shooting is a hitscan ray from the player along the camera's aim; every
// shot leaves a short-lived tracer and a muzzle flash.

import { THREE } from './three.js';
import { makeRival } from './carMesh.js';
import { CFG } from './config.js';

export function createCombat(scene) {
  const combat = {
    enemies: [],
    tracers: [],
    flashTimer: 0,
    flash: null,
    shootCooldown: 0,
    punchCooldown: 0,
  };

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe27a })
  );
  flash.visible = false;
  scene.add(flash);
  combat.flash = flash;

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95 })
    );
    scene.add(line);
    combat.tracers.push({ line, life: 0.14 });
  }

  function spawnRivals(positions) {
    for (const pos of positions) {
      const mesh = makeRival();
      mesh.position.set(pos.x, 0, pos.z);
      mesh.rotation.y = Math.atan2(-pos.x, -pos.z);
      scene.add(mesh);
      combat.enemies.push({
        mesh,
        x: pos.x,
        z: pos.z,
        health: 100,
        shootTimer: 1 + Math.random() * 0.8,
        heading: 0,
      });
    }
  }

  function clearRivals() {
    for (const e of combat.enemies) scene.remove(e.mesh);
    combat.enemies = [];
  }

  // Fire one round. Returns 'hit' | 'kill' | 'miss' | 'empty'.
  function shoot(world, origin, dir) {
    const { player } = world;
    if (player.ammo <= 0) return 'empty';
    player.ammo -= 1;
    combat.shootCooldown = 0.22;
    const start = { x: origin.x, y: 1.4, z: origin.z };
    flash.position.set(start.x + dir.x * 1.1, 1.4, start.z + dir.z * 1.1);
    flash.visible = true;
    combat.flashTimer = 0.06;
    let end = { x: start.x + dir.x * CFG.shootRange, y: 1.4, z: start.z + dir.z * CFG.shootRange };
    let result = 'miss';
    let bestD = CFG.shootRange;
    let victim = null;
    for (const e of combat.enemies) {
      const ex = e.x - start.x;
      const ez = e.z - start.z;
      const along = ex * dir.x + ez * dir.z;
      if (along < 0 || along > bestD) continue;
      const perp = Math.abs(ex * dir.z - ez * dir.x);
      if (perp < 1.6) {
        bestD = along;
        victim = e;
      }
    }
    if (victim) {
      victim.health -= CFG.bulletDamage;
      end = { x: victim.x, y: 1.3, z: victim.z };
      if (victim.health <= 0) {
        scene.remove(victim.mesh);
        combat.enemies.splice(combat.enemies.indexOf(victim), 1);
        result = 'kill';
      } else {
        result = 'hit';
      }
    }
    addTracer(start, end);
    return result;
  }

  // A swing at whatever armed rival stands too close.
  function punch(world) {
    if (combat.punchCooldown > 0) return null;
    combat.punchCooldown = 0.45;
    const { player } = world;
    for (const e of combat.enemies) {
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if (d < CFG.punchRange) {
        e.health -= CFG.punchDamage;
        if (e.health <= 0) {
          scene.remove(e.mesh);
          combat.enemies.splice(combat.enemies.indexOf(e), 1);
          return 'kill';
        }
        return 'hit';
      }
    }
    return 'miss';
  }

  function update(dt, world) {
    combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
    combat.punchCooldown = Math.max(0, combat.punchCooldown - dt);
    if (combat.flashTimer > 0) {
      combat.flashTimer -= dt;
      if (combat.flashTimer <= 0) flash.visible = false;
    }
    for (let i = combat.tracers.length - 1; i >= 0; i--) {
      const t = combat.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.14);
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        combat.tracers.splice(i, 1);
      }
    }
    // Rivals hold their ground near the club and return fire.
    const { player } = world;
    for (const e of combat.enemies) {
      e.shootTimer -= dt;
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      e.heading = Math.atan2(player.x - e.x, player.z - e.z);
      e.mesh.rotation.y = e.heading;
      if (e.shootTimer <= 0 && d < 45 && player.health > 0) {
        e.shootTimer = 1.3 + Math.random() * 0.5;
        addTracer({ x: e.x, y: 1.4, z: e.z }, { x: player.x, y: 1.2, z: player.z });
        world.onShotAt?.(5);
      }
    }
  }

  return { combat, spawnRivals, clearRivals, shoot, punch, update };
}
