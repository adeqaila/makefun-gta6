// Solmar Bay — the HUD: money, health, ammo, wanted stars, clock,
// objective, speed, banner, toasts, and the 2D minimap.

import { CFG, formatClock, formatMoney, missionLabel } from './config.js';

export function createHud(doc) {
  const el = (id) => doc.getElementById(id);
  const hud = {
    money: el('hud-money'),
    health: el('hud-health'),
    healthBar: el('hud-health-bar'),
    ammo: el('hud-ammo'),
    stars: el('hud-stars'),
    clock: el('hud-clock'),
    objective: el('hud-objective'),
    speed: el('hud-speed'),
    banner: el('hud-banner'),
    toast: el('hud-toast'),
    minimap: el('minimap'),
    bannerTimer: 0,
    toastTimer: 0,
  };
  const ctx = hud.minimap.getContext('2d');

  function setMoney(n) {
    hud.money.textContent = formatMoney(n);
  }

  function setHealth(n) {
    hud.health.textContent = `${Math.ceil(n)}`;
    hud.healthBar.style.width = `${Math.max(0, Math.min(100, n))}%`;
    hud.healthBar.style.background = n > 50 ? '#58d68d' : n > 25 ? '#f5b041' : '#e74c3c';
  }

  function setAmmo(n) {
    hud.ammo.textContent = `${n}`;
  }

  function setStars(n) {
    hud.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    hud.stars.style.color = n > 0 ? '#ffd24d' : '#ffffff88';
  }

  function setClock(minutes) {
    hud.clock.textContent = formatClock(minutes);
  }

  function setObjective(index) {
    hud.objective.textContent = missionLabel(index);
  }

  function setSpeed(mph) {
    hud.speed.textContent = mph > 0.5 ? `${Math.round(mph)} mph` : '';
  }

  function showBanner(text, seconds = 3.5) {
    hud.banner.textContent = text;
    hud.banner.style.display = 'block';
    hud.bannerTimer = seconds;
  }

  function hideBanner() {
    hud.banner.style.display = 'none';
    hud.bannerTimer = 0;
  }

  function showToast(text, seconds = 3) {
    hud.toast.textContent = text;
    hud.toast.style.display = 'block';
    hud.toastTimer = seconds;
  }

  function tick(dt) {
    if (hud.bannerTimer > 0) {
      hud.bannerTimer -= dt;
      if (hud.bannerTimer <= 0) hud.banner.style.display = 'none';
    }
    if (hud.toastTimer > 0) {
      hud.toastTimer -= dt;
      if (hud.toastTimer <= 0) hud.toast.style.display = 'none';
    }
  }

  // The minimap: roads, beach, beacon, player arrow, traffic, police, rivals.
  function drawMinimap(world) {
    const S = 180;
    const scale = S / 400;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20242a';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(0, S / 2 + 120 * scale, S, S / 2 - 120 * scale);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, S / 2 + 155 * scale, S, S - (S / 2 + 155 * scale));
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 5;
    for (const line of CFG.roadLines) {
      const [ax, ay] = toMap(-190, line);
      const [bx, by] = toMap(190, line);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx, cy] = toMap(line, -190);
      const [dx, dy] = toMap(line, 190);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
    }
    ctx.fillStyle = '#8fb4d9';
    const [tx, ty] = toMap(world.city.tower.x, world.city.tower.z);
    ctx.fillRect(tx - 4, ty - 4, 8, 8);
    if (world.missions.current < 3) {
      const m = world.missionsTarget;
      const [mx, my] = toMap(m.x, m.z);
      ctx.fillStyle = '#ffc860';
      ctx.beginPath();
      ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my);
      ctx.closePath(); ctx.fill();
    }
    for (const car of world.traffic.cars) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillStyle = '#cfd6dd';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const car of world.police.cars) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of world.combat.enemies) {
      const [x, y] = toMap(e.x, e.z);
      ctx.fillStyle = '#ff8800';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    const [px, py] = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(world.player.heading), Math.cos(world.player.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {
    hud, setMoney, setHealth, setAmmo, setStars, setClock,
    setObjective, setSpeed, showBanner, hideBanner, showToast, tick, drawMinimap,
  };
}
