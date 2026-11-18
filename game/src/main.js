// SOLMAR BAY — bootstrap: renderer, sky, camera, input, loop, screens.
// One job: wire every system together and run the game (or one staged shot).

import THREE from './three.js';
import { CITY, PALETTE, STORY, CONTROLS_TEXT, CAR } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayerOnFoot } from './player.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, addWanted } from './police.js';
import { createCombat, updateCombat, playerShoot, playerPunch } from './combat.js';
import { createMissions, updateMissions, startMission, currentObjective, missionTarget } from './missions.js';
import { createHud, updateHud, banner, message, toast } from './hud.js';
import { createAudio, unlockAudio, setEngine, setSiren, gunshot, fanfare, toggleMute, pickup, alarm, thud } from './audio.js';
import { createSave, saveGame, loadGame, hasSave, applySave } from './save.js';
import { updateDriving, tryEnterCar, exitCar, speedMph } from './vehicles.js';
import { stageShot, shotCamera, shotState, FIXED_DT } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') ? parseInt(params.get('shot'), 10) : 0;
const SEED = params.get('seed') ? parseInt(params.get('seed'), 10) : 1;

const rng = makeRng(SEED);

// --- renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 260, 700);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(-40, 30, -40);

// --- sky: gradient dome + low sun ------------------------------------------
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; void main(){ float h = normalize(vPos).y; float t = smoothstep(-0.05, 0.45, h); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
  }),
);
scene.add(sky);

const sun = new THREE.Mesh(
  new THREE.CircleGeometry(34, 32),
  new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
);
sun.position.set(-620, 150, -260);
sun.lookAt(camera.position);
scene.add(sun);

// --- lights -----------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.75);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffdf9e, 1.5);
sunLight.position.set(-160, 190, -90);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -90;
sunLight.shadow.camera.right = 90;
sunLight.shadow.camera.top = 90;
sunLight.shadow.camera.bottom = -90;
sunLight.shadow.camera.far = 600;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);
scene.add(sunLight.target);

// --- world ------------------------------------------------------------------
const city = buildCity(scene, rng);
const player = createPlayer(scene);
const traffic = createTraffic(scene, rng, 14);
const peds = createPedestrians(scene, rng, 36);
const police = createPolice(scene);
const combat = createCombat(scene);
const missions = createMissions(scene);
const hud = createHud();
const audio = createAudio();
const save = createSave();

// HUD / audio / save as methods, so systems can call world.hud.toast(...) etc.
hud.banner = (t) => banner(hud, t);
hud.message = (t) => message(hud, t);
hud.toast = (t) => toast(hud, t);
audio.gunshot = (d) => gunshot(audio, d);
audio.fanfare = () => fanfare(audio);
audio.alarm = () => alarm(audio);
audio.pickup = () => pickup(audio);
audio.thud = () => thud(audio);
save.saveGame = (w) => saveGame(save, w);

const world = {
  scene, camera, renderer, rng,
  time: 0,
  gameMinutes: 16 * 60 + 20,
  input: { keys: {}, dragging: false, lastDragAt: 0 },
  cameraYaw: Math.PI,
  cameraPitch: 0.32,
  cameraDist: 11,
  player, traffic, peds, police, combat, missions, hud, audio, save, city,
  parkedCar: null,
  state: 'title',
  speedMph: () => (player.inCar ? speedMph(player.inCar) : 0),
  missionObjective: () => currentObjective(missions),
  missionTargetPos: () => missionTarget(missions),
  onPlayerHit: (dmg) => {
    player.health -= dmg;
    if (player.health <= 0) {
      player.health = 0;
      gameOver('WASTED', 'Rico didn\u2019t make it. Solmar Bay forgets fast.');
    }
  },
  onBusted: () => gameOver('BUSTED', 'The Solmar Bay police finally caught up with Rico.'),
};

// --- input ------------------------------------------------------------------
const canvasHolder = document.getElementById('game-canvas');
let downPos = null;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && world.state === 'playing') {
    pauseGame(true);
    return;
  }
  if (e.code === 'Escape' && world.state === 'paused') {
    pauseGame(false);
    return;
  }
  world.input.keys[e.code] = true;
  if (e.code === 'KeyE' && world.state === 'playing') {
    if (player.inCar) {
      exitCar(world);
    } else {
      const res = tryEnterCar(world);
      if (res) {
        if (res.stolen) {
          addWanted(police, 1);
          hud.toast('Car stolen — the cops noticed (+1 ★)');
        } else {
          hud.toast('Back behind the wheel');
        }
        unlockAudio(audio);
      }
    }
  }
  if (e.code === 'KeyF' && world.state === 'playing') playerPunch(world);
  if (e.code === 'KeyM') {
    const muted = toggleMute(audio);
    hud.toast(muted ? 'Sound off' : 'Sound on');
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  world.input.keys[e.code] = false;
});
canvasHolder.addEventListener('mousedown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  world.input.dragging = true;
  unlockAudio(audio);
});
window.addEventListener('mousemove', (e) => {
  if (!world.input.dragging || !downPos) return;
  const dx = e.clientX - downPos.x;
  const dy = e.clientY - downPos.y;
  downPos = { x: e.clientX, y: e.clientY };
  world.cameraYaw -= dx * 0.005;
  world.cameraPitch = THREE.MathUtils.clamp(world.cameraPitch + dy * 0.003, 0.08, 1.0);
  world.input.lastDragAt = world.time;
});
window.addEventListener('mouseup', (e) => {
  const wasDrag = downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6;
  world.input.dragging = false;
  downPos = null;
  if (!wasDrag && world.state === 'playing' && e.target === renderer.domElement) {
    shootAtScreen(e.clientX, e.clientY);
  }
});
canvasHolder.addEventListener('wheel', (e) => {
  world.cameraDist = THREE.MathUtils.clamp(world.cameraDist + Math.sign(e.deltaY) * 1.5, 6, 18);
  e.preventDefault();
}, { passive: false });

function shootAtScreen(cx, cy) {
  const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);
  const point = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, point)) playerShoot(world, point);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- screens ----------------------------------------------------------------
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const overScreen = document.getElementById('over-screen');

function showStart() {
  world.state = 'title';
  startScreen.style.display = 'flex';
  pauseScreen.style.display = 'none';
  overScreen.style.display = 'none';
  hud.el.style.display = 'none';
  document.getElementById('start-story').textContent = STORY.intro;
  document.getElementById('start-controls').textContent = CONTROLS_TEXT;
  const cont = document.getElementById('btn-continue');
  cont.disabled = !hasSave(save);
  cont.textContent = hasSave(save) ? 'Continue — pick up where Rico left off' : 'Continue — no save yet';
}

function startGame(fromSave) {
  unlockAudio(audio);
  startScreen.style.display = 'none';
  overScreen.style.display = 'none';
  hud.el.style.display = 'block';
  world.state = 'playing';
  if (fromSave) {
    const data = loadGame(save);
    if (data) {
      applySave(world, data);
      startMission(world, missions.current);
      hud.message('Welcome back to Solmar Bay, Rico.');
      return;
    }
  }
  player.money = 250;
  player.health = 100;
  player.ammo = 24;
  player.x = -60;
  player.z = 120;
  player.heading = Math.PI;
  player.mesh.position.set(-60, 0, 120);
  startMission(world, 0);
}

function pauseGame(on) {
  if (on) {
    world.state = 'paused';
    pauseScreen.style.display = 'flex';
    saveGame(save, world);
  } else {
    world.state = 'playing';
    pauseScreen.style.display = 'none';
  }
}

function gameOver(title, text) {
  world.state = 'over';
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-text').textContent = text;
  document.getElementById('over-stats').textContent = `Money $${player.money}  ·  Missions ${missions.current}/3  ·  Wanted ${'★'.repeat(police.wanted)}`;
  overScreen.style.display = 'flex';
  setSiren(audio, false);
}

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => pauseGame(false));
document.getElementById('btn-restart').addEventListener('click', () => {
  overScreen.style.display = 'none';
  player.health = 100;
  police.wanted = 0;
  startGame(false);
});
document.getElementById('btn-quit-title').addEventListener('click', () => {
  pauseScreen.style.display = 'none';
  showStart();
});

// --- camera follow ----------------------------------------------------------
function updateCamera(dt) {
  const target = player.inCar
    ? new THREE.Vector3(player.inCar.x, 1.6, player.inCar.z)
    : new THREE.Vector3(player.x, 1.7, player.z);
  if (player.inCar && world.time - world.input.lastDragAt > 1.5) {
    let dh = player.inCar.heading - world.cameraYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    world.cameraYaw += dh * Math.min(1, dt * 2.5);
  }
  const cp = Math.cos(world.cameraPitch);
  const sp = Math.sin(world.cameraPitch);
  const dist = player.inCar ? world.cameraDist + 2 : world.cameraDist;
  camera.position.set(
    target.x - Math.sin(world.cameraYaw) * cp * dist,
    target.y + sp * dist,
    target.z - Math.cos(world.cameraYaw) * cp * dist,
  );
  camera.lookAt(target.x, target.y + 0.4, target.z);
  // sun + shadows follow the player so shadows stay crisp
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  sunLight.position.set(px - 160, 190, pz - 90);
  sunLight.target.position.set(px, 0, pz);
  sun.position.set(px - 620, 150, pz - 260);
  sun.lookAt(camera.position);
}

// --- one fixed step of the world --------------------------------------------
function updateWorld(dt) {
  world.time += dt;
  world.gameMinutes += dt * 0.5;
  if (player.inCar) {
    updateDriving(player.inCar, world.input, dt, city.buildings, traffic, (speed) => {
      if (world.hud && world.state === 'playing') world.hud.toast('Careful — that was a hard hit');
    });
  } else {
    updatePlayerOnFoot(player, world.input, world.cameraYaw, dt, city.buildings);
  }
  updateTraffic(traffic, dt, rng);
  updatePedestrians(peds, dt, rng);
  updatePolice(police, world, dt);
  updateCombat(combat, world, dt);
  updateMissions(world, dt);
}

// --- main loop ---------------------------------------------------------------
// Fixed-step world updates, so slow machines stay in sync with wall time
// instead of crawling: up to 5 steps of 1/60 s per rendered frame.
const clock = new THREE.Clock();
let titleAngle = 0;
let timeDebt = 0;
function animate() {
  requestAnimationFrame(animate);
  const frameDt = Math.min(clock.getDelta(), 0.25);
  if (world.state === 'playing') {
    timeDebt += frameDt;
    let steps = 0;
    while (timeDebt >= 1 / 60 && steps < 5) {
      updateWorld(1 / 60);
      timeDebt -= 1 / 60;
      steps++;
    }
    if (steps === 5) timeDebt = 0; // never spiral on a frozen frame
    updateCamera(frameDt);
    updateHud(hud, world, frameDt);
    setEngine(audio, player.inCar ? Math.abs(player.inCar.speed) / CAR.maxSpeed : 0, !!player.inCar);
    setSiren(audio, police.wanted > 0 && police.cars.length > 0);
  } else if (world.state === 'title') {
    titleAngle += frameDt * 0.02;
    camera.position.set(Math.sin(titleAngle) * 190, 95, Math.cos(titleAngle) * 190);
    camera.lookAt(CITY.tower.x, 20, CITY.tower.z);
    updateTraffic(traffic, frameDt, rng);
    updatePedestrians(peds, frameDt, rng);
  }
  renderer.render(scene, camera);
}

// --- shot mode: stage, simulate fixed steps, frame, report ------------------
if (SHOT >= 1 && SHOT <= 4) {
  const plan = stageShot(world, SHOT);
  if (SHOT === 4) showStart(); // fill the title screen's story + controls text
  world.input.keys = { ...plan.input };
  for (let i = 0; i < plan.steps; i++) updateWorld(FIXED_DT);
  world.input.keys = {};
  shotCamera(world, SHOT);
  if (SHOT !== 4) {
    startScreen.style.display = 'none';
    pauseScreen.style.display = 'none';
    overScreen.style.display = 'none';
    updateHud(hud, world, 0);
    // a staged shot keeps the objective bar and the minimap, but the big
    // mission banner / brief / toast would cover the city, so hide them
    hud.bannerEl.style.opacity = '0';
    hud.messageEl.style.opacity = '0';
    hud.toastEl.style.opacity = '0';
    hud.bannerTimer = 0;
    hud.messageTimer = 0;
    hud.toastTimer = 0;
  }
  renderer.render(scene, camera);
  window.__shotReady = true;
  window.__shotState = shotState(world, SHOT);
  window.__shotError = null;
  // Keep re-rendering the frozen frame so the canvas stays live for capture,
  // but never advance the world again: the shot must stay exactly as staged.
  (function stillRender() {
    requestAnimationFrame(stillRender);
    renderer.render(scene, camera);
  })();
} else {
  showStart();
  startMission(world, 0);
  animate();
}

window.__solmar = world;
