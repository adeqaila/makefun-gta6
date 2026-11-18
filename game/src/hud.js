// SOLMAR BAY — HUD: money, health, wanted stars, clock, objective, minimap.
// One job: every pixel of the 2D interface, DOM + canvas.

import { CITY } from './config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: $('hud'),
    money: $('hud-money'),
    healthBar: $('hud-health-fill'),
    ammo: $('hud-ammo'),
    stars: $('hud-stars'),
    clock: $('hud-clock'),
    objective: $('hud-objective'),
    bannerEl: $('hud-banner'),
    messageEl: $('hud-message'),
    speed: $('hud-speed'),
    toastEl: $('hud-toast'),
    minimap: $('minimap'),
    bannerTimer: 0,
    messageTimer: 0,
    toastTimer: 0,
  };
  hud.mapCtx = hud.minimap.getContext('2d');
  return hud;
}

export function banner(hud, text) {
  hud.bannerEl.textContent = text;
  hud.bannerEl.style.opacity = '1';
  hud.bannerTimer = 3;
}

export function message(hud, text) {
  hud.messageEl.textContent = text;
  hud.messageEl.style.opacity = '1';
  hud.messageTimer = 5;
}

export function toast(hud, text) {
  hud.toastEl.textContent = text;
  hud.toastEl.style.opacity = '1';
  hud.toastTimer = 3;
}

export function updateHud(hud, world, dt) {
  const { player, police, missions } = world;
  hud.money.textContent = `$${player.money.toLocaleString('en-US')}`;
  hud.healthBar.style.width = `${Math.max(0, player.health)}%`;
  hud.healthBar.style.background = player.health > 50 ? '#58c96b' : player.health > 25 ? '#e8c33a' : '#d94f3d';
  hud.ammo.textContent = `Ammo ${player.ammo}`;
  hud.stars.textContent = '★'.repeat(police.wanted) + '☆'.repeat(5 - police.wanted);
  hud.stars.style.color = police.wanted > 0 ? '#ffd23a' : 'rgba(255,255,255,0.55)';
  const mins = Math.floor(world.gameMinutes) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  hud.clock.textContent = `${hh}:${mm}`;
  hud.objective.textContent = missions.done
    ? 'Free roam — Solmar Bay is yours'
    : `${MISSIONS_LABEL(missions)} — ${world.missionObjective()}`;
  if (player.inCar) {
    hud.speed.style.display = 'block';
    hud.speed.textContent = `${Math.round(world.speedMph())} mph`;
  } else {
    hud.speed.style.display = 'none';
  }
  if (hud.bannerTimer > 0) {
    hud.bannerTimer -= dt;
    if (hud.bannerTimer <= 0) hud.bannerEl.style.opacity = '0';
  }
  if (hud.messageTimer > 0) {
    hud.messageTimer -= dt;
    if (hud.messageTimer <= 0) hud.messageEl.style.opacity = '0';
  }
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.toastEl.style.opacity = '0';
  }
  drawMinimap(hud, world);
}

function MISSIONS_LABEL(missions) {
  if (missions.current >= 3) return 'Done';
  return `M${missions.current + 1}/3`;
}

export function drawMinimap(hud, world) {
  const ctx = hud.mapCtx;
  const S = hud.minimap.width;
  const toMap = (v) => ((v + CITY.half + 24) / (2 * (CITY.half + 24))) * S;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(20,28,36,0.85)';
  ctx.fillRect(0, 0, S, S);
  // ocean + beach
  ctx.fillStyle = '#2f7f9e';
  ctx.fillRect(toMap(CITY.oceanX), 0, S - toMap(CITY.oceanX), S);
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(toMap(CITY.beachX), 0, toMap(CITY.oceanX) - toMap(CITY.beachX), S);
  // roads
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 3;
  for (let v = -240; v <= 240; v += 60) {
    ctx.beginPath();
    ctx.moveTo(toMap(v), 0);
    ctx.lineTo(toMap(v), S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toMap(v));
    ctx.lineTo(S, toMap(v));
    ctx.stroke();
  }
  // buildings
  ctx.fillStyle = '#8a94a3';
  for (const b of world.city.buildings) {
    ctx.fillRect(toMap(b.minX), toMap(b.minZ), Math.max(1, toMap(b.maxX) - toMap(b.minX)), Math.max(1, toMap(b.maxZ) - toMap(b.minZ)));
  }
  // tower
  ctx.fillStyle = '#ffc93a';
  ctx.fillRect(toMap(17), toMap(17), toMap(43) - toMap(17), toMap(43) - toMap(17));
  // mission target
  const target = world.missionTargetPos();
  if (target) {
    ctx.fillStyle = '#ffc93a';
    ctx.beginPath();
    ctx.arc(toMap(target.x), toMap(target.z), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // traffic cars
  ctx.fillStyle = '#c9d2dc';
  for (const car of world.traffic.cars) {
    ctx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
  }
  // police cars
  ctx.fillStyle = '#4f8ff7';
  for (const car of world.police.cars) {
    ctx.beginPath();
    ctx.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // player arrow
  const px = world.player.inCar ? world.player.inCar.x : world.player.x;
  const pz = world.player.inCar ? world.player.inCar.z : world.player.z;
  const heading = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  ctx.save();
  ctx.translate(toMap(px), toMap(pz));
  ctx.rotate(-heading + Math.PI);
  ctx.fillStyle = '#ff5f4d';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', 4, 12);
}
