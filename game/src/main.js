// Solmar Bay — boot and the one loop. The world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one) and the renderer
// paints what is there. Four screens: title, play, paused, game over.
//
// ?seed=N fixes the city and traffic. ?shot=chase|street|onfoot|start
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

/** Fixed simulation step, in seconds: 60 updates a second at any display rate. */
const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** One in-game minute passes every two real seconds. */
const MINUTES_PER_SECOND = 0.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// --- Renderer, scene, lights -------------------------------------------------

const app = document.getElementById('app');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffcf99);
scene.fog = new THREE.Fog(0xf7c98b, 120, 700);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);

const sun = new THREE.DirectionalLight(0xffd9a0, 1.1);
sun.position.set(80, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -160;
sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160;
sun.shadow.camera.bottom = -160;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
scene.add(sun);
scene.add(sun.target);

const sky = new THREE.HemisphereLight(0xffe0b3, 0x7a6a55, 0.7);
scene.add(sky);

// --- The shared game state ---------------------------------------------------

const G = {
  seed,
  rng: createRandom(seed),
  scene,
  camera,
  renderer,
  time: 0,
  gameMinutes: 16 * 60 + 20,
  city: null,
  traffic: null,
  peds: null,
  player: null,
  vehicles: null,
  police: null,
  combat: null,
  missions: null,
  hud: null,
  audio: null,
  input: { keys: new Set(), pressed: new Set(), cameraYaw: 0, mouseDX: 0, mouseDY: 0, mouseClicked: false },
  cameraYaw: 0,
  cameraPitch: 0,
  cameraDist: 7,
  cameraOverride: null,
  wanted: 0,
  wantedHeat: 0,
  screen: 'title',
  message: '',
  messageTimer: 0,
  banner: '',
  bannerTimer: 0,
  shake: 0,
  muted: false,
  shotMode: false,
  shotName: '',
  hasSave: hasSave(),
};

G.city = buildCity(scene, G.rng);
G.traffic = createTraffic(scene, G.city, G.rng);
G.peds = createPedestrians(scene, G.city, G.rng);
G.vehicles = createVehicles(scene, G.city, G.rng, G.traffic);
G.player = createPlayer(scene, G.city, G.rng);
G.police = createPolice(scene, G.city, G.rng);
G.combat = createCombat(scene, G.rng);
G.missions = createMissions(G);
G.hud = createHUD();
G.audio = createAudio();

window.__game = G;

// --- Small helpers -----------------------------------------------------------

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Accept a THREE.Vector3 or a plain {x, y, z} and return a Vector3. */
function toVec3(v, fallback) {
  if (!v) return fallback.clone();
  if (v.isVector3) return v;
  return new THREE.Vector3(v.x || 0, v.y || 0, v.z || 0);
}

function announce(message) {
  if (status) status.textContent = message;
}

function resetWorld() {
  try {
    G.traffic?.reset?.();
  } catch {
    // Ignore: a reset failure must not stop a new run.
  }
  try {
    G.peds?.reset?.();
  } catch {
    // Ignore.
  }
  try {
    G.police?.clear?.();
  } catch {
    // Ignore.
  }
  try {
    G.combat?.clearEnemies?.();
  } catch {
    // Ignore.
  }
  try {
    G.player?.reset?.();
  } catch {
    // Ignore.
  }
  try {
    G.missions?.reset?.();
  } catch {
    // Ignore.
  }
  G.wanted = 0;
  G.wantedHeat = 0;
  G.cameraOverride = null;
  G.gameMinutes = 16 * 60 + 20;
  G.banner = '';
  G.bannerTimer = 0;
  G.message = '';
  G.messageTimer = 0;
  G.shake = 0;
  G.cameraYaw = G.player?.heading || 0;
  G.cameraPitch = 0;
}

function startGame() {
  resetWorld();
  // A saved run picks up where it left off: cash, mission, health, ammo, clock.
  const saved = loadGame();
  if (saved) {
    if (G.player) {
      G.player.money = saved.money;
      G.player.health = saved.health;
      G.player.ammo = saved.ammo;
    }
    G.gameMinutes = saved.gameMinutes;
    if (saved.missionCurrent >= 3) {
      G.missions?.startMission?.(3);
    } else {
      G.missions?.startMission?.(Math.min(saved.missionCurrent, 2));
      if (G.missions) G.missions.stage = saved.missionStage || 0;
    }
  } else {
    G.missions?.startMission?.(0);
  }
  G.screen = 'play';
  announce('Playing. Follow the mission objective at the top of the screen.');
}

function endGame() {
  G.screen = 'over';
  announce('Wasted. Rico is down. Press Enter to restart.');
}

// --- Camera ------------------------------------------------------------------

const cameraTarget = new THREE.Vector3();
const cameraGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();

function updateCamera(dt) {
  const playerPos = G.player?.pos || cameraTarget;
  if (G.cameraOverride) {
    const pos = toVec3(G.cameraOverride.pos, camera.position);
    const look = toVec3(G.cameraOverride.look, new THREE.Vector3(0, 10, 0));
    if (dt <= 0) {
      camera.position.copy(pos);
    } else {
      camera.position.lerp(pos, 1 - Math.exp(-dt * 4));
    }
    camera.lookAt(look);
    return;
  }
  const inCar = !!G.player?.inCar;
  const dist = inCar ? 10 : 7;
  const baseHeight = inCar ? 4 : 3.2;
  if (inCar && performance.now() - lastDragAt > 2500) {
    const carHeading = G.player.inCar.heading || 0;
    G.cameraYaw += wrapAngle(carHeading - G.cameraYaw) * Math.min(1, dt * 1.5);
  }
  const forward = { x: Math.sin(G.cameraYaw), z: Math.cos(G.cameraYaw) };
  const height = baseHeight + G.cameraPitch * 3;
  cameraGoal.set(
    playerPos.x - forward.x * dist,
    playerPos.y + height,
    playerPos.z - forward.z * dist,
  );
  if (dt <= 0) {
    camera.position.copy(cameraGoal);
  } else {
    camera.position.lerp(cameraGoal, 1 - Math.exp(-dt * 8));
  }
  lookGoal.set(
    playerPos.x + forward.x * 4,
    playerPos.y + 1.6,
    playerPos.z + forward.z * 4,
  );
  camera.lookAt(lookGoal);
  if (G.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake;
    camera.position.z += (Math.random() - 0.5) * G.shake;
  }
}

function updateSun() {
  const p = G.player?.pos;
  if (!p) return;
  sun.position.set(p.x + 80, 120, p.z + 40);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
}

// --- Input -------------------------------------------------------------------

let dragging = false;
let lastDragAt = 0;

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  G.audio?.ensure?.();
  G.input.keys.add(e.code);
  if (!e.repeat) G.input.pressed.add(e.code);
});

window.addEventListener('keyup', (e) => {
  G.input.keys.delete(e.code);
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  G.audio?.ensure?.();
  if (e.button === 0) {
    dragging = true;
    G.input.mouseClicked = true;
  }
});

window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  G.cameraYaw -= (e.movementX || 0) * 0.005;
  G.cameraPitch = clamp(G.cameraPitch + (e.movementY || 0) * 0.003, -0.25, 0.55);
  lastDragAt = performance.now();
});

window.addEventListener('pointerup', () => {
  dragging = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play') {
    G.screen = 'paused';
    announce('Paused.');
  }
});

// --- One simulation step -----------------------------------------------------

function step(dt) {
  G.time += dt;
  G.gameMinutes += dt * MINUTES_PER_SECOND;
  if (G.bannerTimer > 0) G.bannerTimer -= dt;
  if (G.messageTimer > 0) G.messageTimer -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.5);

  // On-foot movement is camera-relative, so the player reads the orbit yaw here.
  G.input.cameraYaw = G.cameraYaw;

  G.missions?.update?.(dt, G);
  G.player?.update?.(dt, G);
  G.vehicles?.update?.(dt, G);
  G.police?.update?.(dt, G);
  G.traffic?.update?.(dt, G);
  G.peds?.update?.(dt, G);
  G.combat?.update?.(dt, G);

  updateCamera(dt);
  updateSun();

  const car = G.player?.inCar;
  const level = car && car.maxSpeed ? clamp(Math.abs(car.speed || 0) / car.maxSpeed, 0, 1) : 0;
  G.audio?.engine?.(level);
  // The siren is owned by police.update (it knows when a unit is active).

  if (G.player && G.player.health <= 0 && G.screen === 'play') endGame();
}

function handlePressed() {
  const pressed = G.input.pressed;
  if (pressed.has('Enter') || pressed.has('Space')) {
    if (G.screen === 'title' || G.screen === 'over') startGame();
  }
  if (pressed.has('Escape')) {
    if (G.screen === 'play') {
      G.screen = 'paused';
      announce('Paused.');
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      announce('Playing.');
    }
  }
  if (pressed.has('KeyM')) {
    G.muted = !G.muted;
    G.audio?.setMuted?.(G.muted);
    G.message = G.muted ? 'Sound muted' : 'Sound on';
    G.messageTimer = 2;
  }
  // KeyE (enter/steal car) is consumed by vehicles.update; KeyF (punch) and
  // the mouse click (shoot) are consumed by combat.update — not handled here.
}

function handleClick() {
  if (!G.input.mouseClicked) return;
  // On title / game-over a click starts the game. In play the click is a
  // shot, and combat.update consumes the flag itself; while paused the
  // click is dropped so it does not fire on resume.
  if (G.screen === 'title' || G.screen === 'over') {
    G.input.mouseClicked = false;
    startGame();
    return;
  }
  if (G.screen === 'paused') G.input.mouseClicked = false;
}

function paint() {
  renderer.render(scene, camera);
  G.hud?.draw?.(G);
  if (G.screen !== 'play') G.hud?.drawScreen?.(G.screen, G);
}

// --- Screenshot mode ---------------------------------------------------------

function runShot(name) {
  G.shotMode = true;
  G.shotName = name;
  const staged = stageShot(name, G);
  G.screen = staged.screen;
  updateCamera(0);
  updateSun();
  let painted = 0;
  function paintShot() {
    paint();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
}

// --- Normal play -------------------------------------------------------------

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  let orbitAngle = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dtRaw = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handlePressed();
    handleClick();
    if (G.screen === 'play') {
      accumulator += dtRaw;
      while (accumulator >= STEP && G.screen === 'play') {
        step(STEP);
        accumulator -= STEP;
      }
    } else if (G.screen === 'title') {
      // The city lives behind the title: traffic drifts, camera orbits slowly.
      G.time += dtRaw;
      accumulator += dtRaw;
      while (accumulator >= STEP) {
        G.traffic?.update?.(STEP, G);
        G.peds?.update?.(STEP, G);
        accumulator -= STEP;
      }
      orbitAngle += dtRaw * 0.05;
      camera.position.set(Math.sin(orbitAngle) * 190, 55, Math.cos(orbitAngle) * 190);
      camera.lookAt(0, 8, 0);
      updateSun();
    } else {
      accumulator = 0;
    }
    paint();
    G.input.pressed.clear();
  }

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
