// Rico Vale on foot: build, walk/run, collisions, health and money.
// The player group is the single source of truth for position; heading 0 faces +Z
// and forward is always (sin(heading), 0, cos(heading)).

const WALK_SPEED = 6;
const RUN_SPEED = 10;
const PLAYER_RADIUS = 0.6;
const REGEN_PER_SECOND = 1;

function makeBox(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function angleLerp(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

export function createPlayer(scene, city, rng) {
  const group = new THREE.Group();
  group.name = 'RicoVale';

  // Teal jacket torso, dark jeans legs, skin head, flat cap.
  const body = makeBox(0.52, 0.68, 0.3, 0x1f8a8a, 0, 1.08, 0);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 }),
  );
  head.position.set(0, 1.58, 0);
  head.castShadow = true;
  const cap = makeBox(0.46, 0.09, 0.46, 0x22303a, 0, 1.76, 0);
  const capBrim = makeBox(0.4, 0.04, 0.18, 0x22303a, 0, 1.73, 0.28);
  const armL = makeBox(0.14, 0.6, 0.16, 0x1f8a8a, -0.34, 1.06, 0);
  const armR = makeBox(0.14, 0.6, 0.16, 0x1f8a8a, 0.34, 1.06, 0);
  const legL = makeBox(0.19, 0.62, 0.2, 0x2a3440, -0.14, 0.31, 0);
  const legR = makeBox(0.19, 0.62, 0.2, 0x2a3440, 0.14, 0.31, 0);
  group.add(body, head, cap, capBrim, armL, armR, legL, legR);
  scene.add(group);

  const spawnPoint = (city.spawn && city.spawn.onFoot) || city.spawn || { x: 0, z: 0 };
  group.position.set(spawnPoint.x || 0, 0, spawnPoint.z || 0);

  const player = {
    group,
    body,
    head,
    legs: [legL, legR],
    arms: [armL, armR],
    pos: group.position,
    heading: 0,
    speed: 0,
    onFoot: true,
    health: 100,
    money: 250,
    ammo: 24,
    inCar: null,
    punchCooldown: 0,
    shootCooldown: 0,
    walkPhase: 0,
  };
  group.rotation.y = 0;

  function clampToBounds() {
    // city.bounds is a single number: the half-extent of the square city.
    const b = city.bounds;
    if (typeof b !== 'number' || !Number.isFinite(b)) return;
    group.position.x = Math.max(-b, Math.min(b, group.position.x));
    group.position.z = Math.max(-b, Math.min(b, group.position.z));
  }

  player.update = function update(dt, G) {
    if (!G || G.screen !== 'play') return;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.shootCooldown > 0) player.shootCooldown -= dt;

    // Slow regen while the heat is off.
    if (G.wanted === 0 && player.health > 0 && player.health < 100) {
      player.health = Math.min(100, player.health + REGEN_PER_SECOND * dt);
    }
    if (!player.onFoot || player.health <= 0) return;

    const keys = G.input ? G.input.keys : null;
    if (!keys) return;
    const yaw = G.input.cameraYaw || 0;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let mx = 0;
    let mz = 0;
    if (keys.has('KeyW')) { mx += fwdX; mz += fwdZ; }
    if (keys.has('KeyS')) { mx -= fwdX; mz -= fwdZ; }
    if (keys.has('KeyD')) { mx += rightX; mz += rightZ; }
    if (keys.has('KeyA')) { mx -= rightX; mz -= rightZ; }

    const moving = mx !== 0 || mz !== 0;
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const targetSpeed = moving ? (running ? RUN_SPEED : WALK_SPEED) : 0;
    player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);

    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      player.heading = angleLerp(player.heading, targetHeading, Math.min(1, dt * 12));
      group.rotation.y = player.heading;

      // Slide along walls: try x and z separately against buildings.
      const step = player.speed * dt;
      const nx = group.position.x + mx * step;
      if (!city.isBlocked || !city.isBlocked(nx, group.position.z, PLAYER_RADIUS)) {
        group.position.x = nx;
      }
      const nz = group.position.z + mz * step;
      if (!city.isBlocked || !city.isBlocked(group.position.x, nz, PLAYER_RADIUS)) {
        group.position.z = nz;
      }
      clampToBounds();

      player.walkPhase += player.speed * dt * 1.7;
      const swing = Math.sin(player.walkPhase) * 0.55;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.7;
      armR.rotation.x = swing * 0.7;
      body.position.y = 1.08 + Math.abs(Math.sin(player.walkPhase)) * 0.045;
    } else {
      legL.rotation.x *= 0.8;
      legR.rotation.x *= 0.8;
      armL.rotation.x *= 0.8;
      armR.rotation.x *= 0.8;
      body.position.y += (1.08 - body.position.y) * Math.min(1, dt * 8);
    }
  };

  player.takeDamage = function takeDamage(amount, G) {
    if (player.health <= 0) return;
    player.health -= amount;
    if (G) G.shake = 0.5;
    if (player.health <= 0) {
      player.health = 0;
      if (G) G.screen = 'over';
    }
  };

  player.addMoney = function addMoney(n) {
    player.money += n;
  };

  player.heal = function heal(n) {
    player.health = Math.min(100, player.health + n);
  };

  player.reset = function reset(spawn) {
    const point = spawn || (city.spawn && city.spawn.onFoot) || city.spawn || { x: 0, z: 0 };
    group.position.set(point.x || 0, 0, point.z || 0);
    group.rotation.set(0, 0, 0);
    group.visible = true;
    player.heading = 0;
    player.speed = 0;
    player.health = 100;
    player.onFoot = true;
    player.inCar = null;
    player.punchCooldown = 0;
    player.shootCooldown = 0;
  };

  return player;
}
