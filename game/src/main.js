// Solmar Bay — bootstrap: renderer, sky, camera, input, fixed-step loop.
// Wires every system together and exposes the debug handle the play-test
// harness reads (window.__solmar).

import { THREE } from './three.js';
import { CFG, MISSIONS, STORY } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { nearestStealableCar, stealCar, exitCar, updateDriving, speedMph } from './vehicles.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotParam = parseInt(params.get('shot') || '0', 10);
const seed = parseInt(params.get('seed') || String(CFG.seed), 10);

const canvasHost = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasHost });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 150, 170);

const rng = makeRng(seed);
const city = buildCity(scene, rng);
const trafficSys = createTraffic(scene, rng);
const pedsSys = createPedestrians(scene, rng);
const playerSys = createPlayer(scene);
const policeSys = createPolice(scene, rng);
const combatSys = createCombat(scene);
const missionsSys = createMissions(scene);
const hudApi = createHud(document);
const audioSys = createAudio();

const world = {
  scene,
  camera,
  renderer,
  rng,
  city,
  traffic: trafficSys,
  peds: pedsSys,
  player: playerSys.player,
  police: policeSys.police,
  policeApi: policeSys,
  combat: combatSys.combat,
  combatApi: combatSys,
  missions: missionsSys.missions,
  missionsApi: missionsSys,
  hudApi,
  audioApi: audioSys,
  input: new Set(),
  camYaw: 0,
  camPitch: 0.35,
  time: 0,
  clockMinutes: CFG.clockStartMinutes,
  state: 'title',
  overReason: '',
  shotFrozen: false,
  snapCamera: true,
  missionsTarget: MISSIONS[0].target,
  autosaveTimer: 0,
  titleAngle: 0,
};

function setMissionBeacon(index) {
  missionsSys.setBeacon(index);
  world.missionsTarget = MISSIONS[index] ? MISSIONS[index].target : { x: 0, z: 0 };
  hudApi.setObjective(index);
}
world.setMissionBeacon = setMissionBeacon;

function syncHud() {
  hudApi.setMoney(world.player.money);
  hudApi.setHealth(world.player.health);
  hudApi.setAmmo(world.player.ammo);
  hudApi.setStars(world.police.wanted);
  hudApi.setClock(world.clockMinutes);
  hudApi.setObjective(world.missions.current);
  hudApi.setSpeed(speedMph(world.player));
  hudApi.drawMinimap(world);
}
world.syncHud = syncHud;

// -- screens ---------------------------------------------------------------
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const overScreen = document.getElementById('gameover-screen');
const overTitle = document.getElementById('gameover-title');
const overText = document.getElementById('gameover-text');
const btnContinue = document.getElementById('btn-continue');

function showOnly(screen) {
  startScreen.style.display = screen === 'start' ? 'flex' : 'none';
  pauseScreen.style.display = screen === 'pause' ? 'flex' : 'none';
  overScreen.style.display = screen === 'over' ? 'flex' : 'none';
  document.getElementById('hud').style.display = screen === null ? 'block' : 'none';
}

function toTitle() {
  world.state = 'title';
  btnContinue.style.display = hasSave() ? 'block' : 'none';
  showOnly('start');
}
world.toTitle = toTitle;

function resetRun() {
  const p = world.player;
  if (p.inCar && p.car) {
    p.car.speed = 0;
    trafficSys.parkCar(p.car);
  }
  p.x = 0;
  p.z = 8;
  p.heading = Math.PI;
  p.health = CFG.startHealth;
  p.money = CFG.startMoney;
  p.ammo = CFG.startAmmo;
  p.inCar = false;
  p.car = null;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  missionsSys.reset();
  combatSys.clearRivals();
  policeSys.police.wanted = 0;
  policeSys.police.bustTimer = 0;
  while (policeSys.police.cars.length > 0) {
    scene.remove(policeSys.police.cars.pop().mesh);
  }
  world.time = 0;
  world.clockMinutes = CFG.clockStartMinutes;
  world.camYaw = 0;
  world.camPitch = 0.35;
  setMissionBeacon(0);
  syncHud();
}
world.resetRun = resetRun;

function beginPlay(fromSave) {
  if (fromSave) {
    const data = loadGame();
    resetRun();
    if (data) {
      world.player.money = data.money ?? CFG.startMoney;
      world.player.health = data.health ?? CFG.startHealth;
      world.player.ammo = data.ammo ?? CFG.startAmmo;
      world.player.x = data.x ?? 0;
      world.player.z = data.z ?? 8;
      world.clockMinutes = data.clockMinutes ?? CFG.clockStartMinutes;
      const target = Math.max(0, Math.min(2, data.mission ?? 0));
      world.missions.current = target;
      setMissionBeacon(target);
      if (target === 2) {
        combatSys.spawnRivals([
          { x: 56, z: 56 },
          { x: 64, z: 58 },
          { x: 58, z: 66 },
        ]);
      }
    }
  } else {
    resetRun();
  }
  world.state = 'playing';
  showOnly(null);
  hudApi.showBanner(`${STORY.city} — ${STORY.tagline}`, 4);
  syncHud();
}
world.beginPlay = beginPlay;

function gameOver(reason) {
  if (world.state !== 'playing') return;
  world.state = 'over';
  world.overReason = reason;
  if (reason === 'busted') {
    overTitle.textContent = 'BUSTED';
    overText.textContent = 'The Solmar Bay PD hauled Rico in. Marisol Kane does not wait.';
  } else {
    overTitle.textContent = 'WASTED';
    overText.textContent = 'Rico went down in the streets of Solmar Bay.';
  }
  showOnly('over');
}
world.gameOver = gameOver;

// -- world event hooks ------------------------------------------------------
world.onRam = () => {
  playerSys.hurt(5);
  hudApi.showToast('Cruiser rammed you! −5 HP');
  if (world.player.health <= 0) gameOver('wasted');
};
world.onShotAt = (dmg) => {
  playerSys.hurt(dmg);
  if (world.player.health <= 0) gameOver('wasted');
};
world.onBusted = () => gameOver('busted');
world.onPedestrianHit = () => {
  policeSys.addWanted(1, world.time);
  hudApi.showToast('You hit a pedestrian! Wanted +1');
};
world.onCarCrash = () => {
  playerSys.hurt(2);
  if (world.player.health <= 0) gameOver('wasted');
};

// -- input ------------------------------------------------------------------
function aimDir() {
  return { x: -Math.sin(world.camYaw), z: -Math.cos(world.camYaw) };
}

function tryShoot() {
  if (world.state !== 'playing') return;
  const dir = aimDir();
  const result = combatSys.shoot(world, { x: world.player.x, z: world.player.z }, dir);
  if (result === 'empty') {
    hudApi.showToast('Out of ammo!');
    return;
  }
  audioSys.shot();
  policeSys.addWanted(1, world.time);
  if (result === 'kill') hudApi.showToast('Rival down.');
  else if (result === 'hit') hudApi.showToast('Hit!');
}

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  world.input.add(e.code);
  if (e.repeat) return;
  audioSys.ensure();
  if (e.code === 'Escape') {
    if (world.state === 'playing') {
      world.state = 'paused';
      showOnly('pause');
      saveGame(world);
    } else if (world.state === 'paused') {
      world.state = 'playing';
      showOnly(null);
    }
    return;
  }
  if (world.state !== 'playing') return;
  if (e.code === 'KeyE') {
    if (world.player.inCar) {
      exitCar(world);
    } else {
      const car = nearestStealableCar(world.player, trafficSys, 5);
      if (car) {
        stealCar(world, car);
        policeSys.addWanted(1, world.time);
        hudApi.showToast('You stole the car! Wanted +1');
      }
    }
  } else if (e.code === 'KeyF') {
    const result = combatSys.punch(world);
    if (result === 'hit' || result === 'kill') {
      audioSys.punch();
      hudApi.showToast(result === 'kill' ? 'Rival down.' : 'Punch landed!');
    }
  } else if (e.code === 'KeyM') {
    const muted = audioSys.toggleMute();
    hudApi.showToast(muted ? 'Sound muted (M)' : 'Sound on (M)');
  }
});
window.addEventListener('keyup', (e) => world.input.delete(e.code));

let dragging = false;
let dragX = 0;
let dragY = 0;
let downAt = 0;
let moved = 0;
canvasHost.addEventListener('pointerdown', (e) => {
  audioSys.ensure();
  dragging = true;
  dragX = e.clientX;
  dragY = e.clientY;
  downAt = performance.now();
  moved = 0;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragX;
  const dy = e.clientY - dragY;
  dragX = e.clientX;
  dragY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  world.camYaw -= dx * 0.005;
  world.camPitch = Math.max(0.05, Math.min(0.9, world.camPitch + dy * 0.003));
});
window.addEventListener('pointerup', () => {
  if (!dragging) return;
  dragging = false;
  if (moved < 6 && performance.now() - downAt < 350) tryShoot();
});

document.getElementById('btn-new').addEventListener('click', () => {
  clearSave();
  beginPlay(false);
});
btnContinue.addEventListener('click', () => beginPlay(true));
document.getElementById('btn-resume').addEventListener('click', () => {
  world.state = 'playing';
  showOnly(null);
});
document.getElementById('btn-restart').addEventListener('click', () => {
  clearSave();
  beginPlay(false);
});
document.getElementById('btn-again').addEventListener('click', () => {
  clearSave();
  beginPlay(false);
});
document.getElementById('btn-title').addEventListener('click', () => toTitle());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -- fixed-step simulation --------------------------------------------------
function step(dt) {
  world.time += dt;
  world.clockMinutes = CFG.clockStartMinutes + world.time;
  const p = world.player;
  playerSys.regen(dt);
  if (p.inCar) updateDriving(world, dt, world.input);
  else playerSys.updateOnFoot(dt, world.input, world.camYaw, city.colliders);
  trafficSys.update(dt);
  pedsSys.update(dt);
  policeSys.update(dt, world);
  combatSys.update(dt, world);
  const done = missionsSys.update(dt, p);
  if (done) {
    p.money += done.reward;
    hudApi.showBanner(`Job done: ${done.title} — +$${done.reward}`, 4);
    hudApi.showToast(`+$${done.reward} — Marisol's debt shrinks.`);
    audioSys.fanfare();
    setMissionBeacon(world.missions.current);
    if (world.missions.current === 2) {
      combatSys.spawnRivals([
        { x: 56, z: 56 },
        { x: 64, z: 58 },
        { x: 58, z: 66 },
      ]);
      hudApi.showToast('Marisol’s crew guards the club. Expect a fight.');
    }
    if (world.missions.done) {
      hudApi.showBanner('DEBT PAID — Solmar Bay is yours, Rico.', 6);
    }
    saveGame(world);
  }
  audioSys.setEngine(p.inCar, p.inCar && p.car ? Math.abs(p.car.speed) / CFG.carMaxSpeed : 0);
  audioSys.update(dt, world.police.wanted);
  world.autosaveTimer += dt;
  if (world.autosaveTimer > 10) {
    world.autosaveTimer = 0;
    saveGame(world);
  }
  syncHud();
}

function updateCamera(dt) {
  if (world.state === 'title' || shotParam === 4) {
    world.titleAngle += dt * 0.02;
    const a = world.titleAngle;
    camera.position.set(Math.sin(a) * 150, 150, 170 + Math.cos(a) * 20);
    camera.lookAt(0, 0, 30);
    return;
  }
  const p = world.player;
  const dist = p.inCar ? 12.5 : 9;
  const height = 2.6 + world.camPitch * 6.5;
  const tx = p.x + Math.sin(world.camYaw) * dist;
  const tz = p.z + Math.cos(world.camYaw) * dist;
  if (world.snapCamera) {
    camera.position.set(tx, height, tz);
    world.snapCamera = false;
  } else {
    const k = 1 - Math.exp(-9 * dt);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (height - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
  }
  camera.lookAt(
    p.x - Math.sin(world.camYaw) * 3,
    1.6,
    p.z - Math.cos(world.camYaw) * 3
  );
}

let last = performance.now();
let acc = 0;
let minimapTick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dtRaw = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (world.state === 'playing' && !world.shotFrozen) {
    acc += dtRaw;
    let steps = 0;
    while (acc >= CFG.step && steps < 5) {
      step(CFG.step);
      acc -= CFG.step;
      steps++;
    }
    if (steps === 5) acc = 0;
  }
  hudApi.tick(dtRaw);
  if (world.state === 'playing') {
    minimapTick += 1;
    if (minimapTick % 4 === 0) hudApi.drawMinimap(world);
  }
  // Frozen (staged-shot) frames render the exact same camera every time.
  updateCamera(world.shotFrozen ? 0 : dtRaw);
  renderer.render(scene, camera);
}

// -- debug handle for the play-test harness ---------------------------------
const solmar = {
  player: world.player,
  traffic: trafficSys,
  police: world.police,
  missions: world.missions,
  speedMph: () => speedMph(world.player),
};
Object.defineProperty(solmar, 'state', { get: () => world.state });
Object.defineProperty(solmar, 'time', { get: () => world.time });
window.__solmar = solmar;

toTitle();
if (shotParam >= 1 && shotParam <= 4) {
  stageShot(world, shotParam);
}
requestAnimationFrame(frame);
