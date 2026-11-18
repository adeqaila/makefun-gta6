// Hand-to-hand and gun combat against Kane's crew.
// Punch with F, shoot with a mouse click. Tracer lines and a muzzle flash
// show every shot; dead enemies fall and are cleared after a few seconds.

const PUNCH_COOLDOWN = 0.4;
const PUNCH_RANGE = 2.2;
const PUNCH_DAMAGE = 25;
const SHOOT_COOLDOWN = 0.25;
const SHOOT_RANGE = 60;
const SHOOT_CONE_COS = 0.978; // ~12 degrees
const SHOOT_DAMAGE = 34;
const ENEMY_HEALTH = 60;
const ENEMY_SPEED = 3.5;
const ENEMY_SHOOT_RANGE = 30;
const ENEMY_DAMAGE = 6;
const DEAD_CLEAR_SECONDS = 3;
const TRACER_SECONDS = 0.12;
const FLASH_SECONDS = 0.05;

function makeBox(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function createCombat(scene, rng) {
  const enemies = [];
  const bullets = [];
  const tracers = [];

  function random() {
    return typeof rng === 'function' ? rng() : Math.random();
  }

  function addTracer(from, to) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    tracers.push({ line, life: TRACER_SECONDS });
  }

  function spawnEnemy(pos, G) {
    const group = new THREE.Group();
    group.name = 'KaneCrew';
    const body = makeBox(0.55, 0.75, 0.32, 0x2b2b33, 0, 1.05, 0);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9977a, roughness: 0.7 }),
    );
    head.position.set(0, 1.58, 0);
    head.castShadow = true;
    const band = makeBox(0.44, 0.07, 0.44, 0x8c1f28, 0, 1.74, 0);
    const legL = makeBox(0.19, 0.6, 0.2, 0x1c1c22, -0.14, 0.3, 0);
    const legR = makeBox(0.19, 0.6, 0.2, 0x1c1c22, 0.14, 0.3, 0);
    group.add(body, head, band, legL, legR);
    group.position.set(pos.x || 0, 0, pos.z || 0);
    scene.add(group);
    const enemy = {
      group,
      health: ENEMY_HEALTH,
      shootTimer: 1.2 + random() * 0.8,
      dead: false,
      deadTimer: 0,
      walkPhase: random() * Math.PI * 2,
      legs: [legL, legR],
    };
    enemies.push(enemy);
    return enemy;
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    enemy.deadTimer = DEAD_CLEAR_SECONDS;
    enemy.group.rotation.x = -Math.PI / 2;
    enemy.group.position.y = 0.25;
  }

  function damageEnemy(enemy, amount) {
    if (enemy.dead) return;
    enemy.health -= amount;
    if (enemy.health <= 0) killEnemy(enemy);
  }

  function punch(G) {
    const player = G.player;
    if (!player || !player.onFoot || player.health <= 0) return;
    if (player.punchCooldown > 0) return;
    player.punchCooldown = PUNCH_COOLDOWN;
    const fwdX = Math.sin(player.heading);
    const fwdZ = Math.cos(player.heading);

    const hitInFront = (targetPos) => {
      const dx = targetPos.x - player.pos.x;
      const dz = targetPos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > PUNCH_RANGE || d === 0) return false;
      return (dx / d) * fwdX + (dz / d) * fwdZ > 0.4;
    };

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (hitInFront(enemy.group.position)) {
        damageEnemy(enemy, PUNCH_DAMAGE);
        if (G.audio && typeof G.audio.punch === 'function') {
          try { G.audio.punch(); } catch { /* ignore */ }
        }
        G.shake = Math.max(G.shake || 0, 0.2);
        return;
      }
    }

    // No crew in reach: a pedestrian in front takes the hit instead.
    const peds = (G.peds && G.peds.peds) || [];
    for (const ped of peds) {
      if (!ped || !ped.group || ped.fallen) continue;
      if (!hitInFront(ped.group.position)) continue;
      ped.fallen = true;
      ped.fallTimer = 1.5;
      if (G.audio && typeof G.audio.punch === 'function') {
        try { G.audio.punch(); } catch { /* ignore */ }
      }
      if (G.police && typeof G.police.addWanted === 'function') {
        G.police.addWanted(1, G);
      }
      G.message = 'You punched a pedestrian!';
      G.messageTimer = 3;
      return;
    }
  }

  function shoot(G) {
    const player = G.player;
    if (!player || player.health <= 0) return;
    if (player.shootCooldown > 0) return;
    if (player.ammo <= 0) {
      G.message = 'Out of ammo!';
      G.messageTimer = 2;
      return;
    }
    player.shootCooldown = SHOOT_COOLDOWN;
    player.ammo -= 1;

    // Aim from the camera through the centre of the screen.
    const dir = new THREE.Vector3();
    if (G.camera && typeof G.camera.getWorldDirection === 'function') {
      G.camera.getWorldDirection(dir);
    } else {
      dir.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    }
    const origin = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z);
    if (player.inCar && player.inCar.group) {
      origin.copy(player.inCar.group.position);
      origin.y += 1.4;
    }

    let hitPoint = null;
    let hitEnemy = null;
    let bestDist = SHOOT_RANGE;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const to = new THREE.Vector3(
        enemy.group.position.x - origin.x,
        enemy.group.position.y + 1.2 - origin.y,
        enemy.group.position.z - origin.z,
      );
      const d = to.length();
      if (d > SHOOT_RANGE || d === 0) continue;
      if (to.normalize().dot(dir) < SHOOT_CONE_COS) continue;
      if (d < bestDist) { bestDist = d; hitEnemy = enemy; }
    }
    if (hitEnemy) {
      hitPoint = new THREE.Vector3(
        hitEnemy.group.position.x,
        hitEnemy.group.position.y + 1.2,
        hitEnemy.group.position.z,
      );
      damageEnemy(hitEnemy, SHOOT_DAMAGE);
    } else {
      hitPoint = origin.clone().addScaledVector(dir, SHOOT_RANGE);
    }

    addTracer(origin, hitPoint);

    // Muzzle flash: a small glowing sphere at the barrel, gone in a blink.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }),
    );
    flash.position.copy(origin).addScaledVector(dir, 0.9);
    scene.add(flash);
    tracers.push({ line: flash, life: FLASH_SECONDS, isFlash: true });

    if (G.audio && typeof G.audio.gunshot === 'function') {
      try { G.audio.gunshot(); } catch { /* ignore */ }
    }
    G.shake = Math.max(G.shake || 0, 0.15);
  }

  function update(dt, G) {
    const player = G.player;

    // F punches, mouse click shoots (click flag is consumed once per frame).
    const pressed = G.input && G.input.pressed;
    if (G.screen === 'play' && player && player.health > 0) {
      if (pressed && pressed.has('KeyF')) {
        pressed.delete('KeyF');
        punch(G);
      }
      if (G.input && G.input.mouseClicked) {
        G.input.mouseClicked = false;
        shoot(G);
      }
    }

    // Fade tracers and flashes, then drop them.
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      if (t.line.material && t.line.material.transparent) {
        t.line.material.opacity = Math.max(0, t.life / TRACER_SECONDS);
      }
      if (t.life <= 0) {
        scene.remove(t.line);
        if (t.line.geometry) t.line.geometry.dispose();
        if (t.line.material) t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }

    if (!player || G.screen !== 'play') return;
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const enemy = enemies[i];
      if (enemy.dead) {
        enemy.deadTimer -= dt;
        if (enemy.deadTimer <= 0) {
          scene.remove(enemy.group);
          enemies.splice(i, 1);
        }
        continue;
      }
      const dx = player.pos.x - enemy.group.position.x;
      const dz = player.pos.z - enemy.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.01) {
        enemy.group.rotation.y = Math.atan2(dx, dz);
      }
      // Hold a fighting distance: close in past 25 m, back off inside 5 m.
      let move = 0;
      if (dist > 8) move = ENEMY_SPEED;
      else if (dist < 5) move = -ENEMY_SPEED * 0.5;
      if (move !== 0 && dist > 0.01) {
        enemy.group.position.x += (dx / dist) * move * dt;
        enemy.group.position.z += (dz / dist) * move * dt;
        enemy.walkPhase += Math.abs(move) * dt * 2.2;
        const swing = Math.sin(enemy.walkPhase) * 0.45;
        enemy.legs[0].rotation.x = swing;
        enemy.legs[1].rotation.x = -swing;
      }

      // Return fire inside 30 m every 1.2-2 seconds.
      enemy.shootTimer -= dt;
      if (dist < ENEMY_SHOOT_RANGE && enemy.shootTimer <= 0) {
        enemy.shootTimer = 1.2 + random() * 0.8;
        const from = new THREE.Vector3(
          enemy.group.position.x,
          enemy.group.position.y + 1.3,
          enemy.group.position.z,
        );
        const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z);
        addTracer(from, to);
        player.takeDamage(ENEMY_DAMAGE, G);
      }
    }
  }

  function clearEnemies() {
    for (const enemy of enemies) scene.remove(enemy.group);
    enemies.length = 0;
    for (const t of tracers) {
      scene.remove(t.line);
      if (t.line.geometry) t.line.geometry.dispose();
      if (t.line.material) t.line.material.dispose();
    }
    tracers.length = 0;
  }

  return { enemies, bullets, tracers, update, punch, shoot, spawnEnemy, clearEnemies };
}
