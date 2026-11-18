// The whole 2D interface of Solmar Bay, drawn on canvas (never DOM text)
// so it is baked into headless screenshots exactly as the player sees it:
// money, health, ammo, wanted stars, clock, objective, banner, minimap,
// plus the title / paused / game-over screens in big high-contrast type.

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const WORLD_HALF = 280;
const MAP_SIZE = 220;

export function createHUD() {
  const hudCanvas = document.createElement('canvas');
  hudCanvas.id = 'hud';
  hudCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
  document.body.appendChild(hudCanvas);

  const mapCanvas = document.createElement('canvas');
  mapCanvas.id = 'minimap';
  mapCanvas.style.cssText = 'position:fixed;left:14px;bottom:14px;width:220px;height:220px;pointer-events:none;z-index:6;border:2px solid rgba(255,255,255,0.35);border-radius:6px;';
  document.body.appendChild(mapCanvas);

  const ctx = hudCanvas.getContext('2d');
  const mapCtx = mapCanvas.getContext('2d');

  const hud = { draw, drawScreen };

  function fitCanvas(canvas, context) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Big text with a black halo so it reads even on a bright sunset sky. */
  function outlinedText(c, text, x, y, font, fill, align = 'left') {
    c.font = font;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.lineJoin = 'round';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(text, x, y);
    c.fillStyle = fill;
    c.fillText(text, x, y);
  }

  function panel(c, x, y, w, h) {
    c.fillStyle = 'rgba(8,14,26,0.72)';
    c.beginPath();
    c.roundRect(x, y, w, h, 8);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 1;
    c.stroke();
  }

  function moneyText(value) {
    return '$' + Math.floor(value || 0).toLocaleString('en-US');
  }

  function clockText(minutes) {
    const total = Math.floor(minutes || 0) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function draw(G) {
    fitCanvas(hudCanvas, ctx);
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (G.screen !== 'play' && G.screen !== 'paused') {
      drawMinimap(G);
      return;
    }
    drawMoney(G, w);
    drawObjective(G, w);
    drawBanner(G, w, h);
    drawToast(G, w, h);
    drawSpeedHints(G, w, h);
    drawMinimap(G);
  }

  function drawMoney(G, w) {
    const x = w - 18;
    outlinedText(ctx, moneyText(G.player?.money), x, 44, `bold 34px ${FONT}`, '#ffd76a', 'right');
    outlinedText(ctx, clockText(G.gameMinutes), x, 74, `bold 18px ${FONT}`, '#ffffff', 'right');
    outlinedText(ctx, 'SOLMAR BAY', x, 96, `bold 13px ${FONT}`, 'rgba(255,255,255,0.75)', 'right');

    // Wanted stars, filled gold up to the current level.
    ctx.font = `26px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    let sx = x;
    for (let i = 4; i >= 0; i -= 1) {
      const filled = i < (G.wanted || 0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText('★', sx, 132);
      ctx.fillStyle = filled ? '#ffb300' : 'rgba(160,160,160,0.55)';
      ctx.fillText('★', sx, 132);
      sx -= ctx.measureText('★').width + 2;
    }

    // Health bar + ammo under the money.
    const barW = 210;
    const barX = x - barW;
    const barY = 146;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, 14);
    const health = Math.max(0, Math.min(100, G.player?.health ?? 100)) / 100;
    ctx.fillStyle = health > 0.5 ? '#37d67a' : health > 0.25 ? '#ffb300' : '#e5534b';
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * health, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, 14);
    outlinedText(ctx, `AMMO ${G.player?.ammo ?? 0}`, x, barY + 36, `bold 16px ${FONT}`, '#ffffff', 'right');
  }

  function drawObjective(G, w) {
    const text = G.missions?.objectiveText?.() || '';
    if (!text) return;
    ctx.font = `bold 19px ${FONT}`;
    const textW = Math.min(ctx.measureText(text).width + 32, w - 40);
    const x = (w - textW) / 2;
    panel(ctx, x, 12, textW, 36);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 31);
  }

  function drawBanner(G, w, h) {
    if (!G.banner || (G.bannerTimer || 0) <= 0) return;
    const alpha = Math.min(1, G.bannerTimer);
    ctx.save();
    ctx.globalAlpha = alpha;
    outlinedText(ctx, G.banner, w / 2, h * 0.32, `bold 44px ${FONT}`, '#ffd23f', 'center');
    ctx.restore();
  }

  function drawToast(G, w, h) {
    if (!G.message || (G.messageTimer || 0) <= 0) return;
    ctx.font = `19px ${FONT}`;
    const textW = Math.min(ctx.measureText(G.message).width + 28, w - 40);
    panel(ctx, (w - textW) / 2, h - 118, textW, 32);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(G.message, w / 2, h - 101);
  }

  function drawSpeedHints(G, w, h) {
    const car = G.player?.inCar;
    if (car) {
      const mph = Math.round(Math.abs(car.speed || 0) * 2.237);
      outlinedText(ctx, `${mph} mph`, w - 18, h - 66, `bold 30px ${FONT}`, '#ffffff', 'right');
    }
    outlinedText(
      ctx,
      'WASD drive • E enter/exit • F punch • Click shoot • M mute • Esc pause',
      w - 18,
      h - 34,
      `14px ${FONT}`,
      'rgba(255,255,255,0.8)',
      'right',
    );
  }

  /** World ±280 maps onto the 220 px square; north (-Z) is up. */
  function toMap(x, z) {
    const scale = MAP_SIZE / (WORLD_HALF * 2);
    return [(x + WORLD_HALF) * scale, (z + WORLD_HALF) * scale];
  }

  function drawMinimap(G) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (mapCanvas.width !== MAP_SIZE * dpr) {
      mapCanvas.width = MAP_SIZE * dpr;
      mapCanvas.height = MAP_SIZE * dpr;
    }
    mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapCtx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    mapCtx.fillStyle = 'rgba(12,20,32,0.85)';
    mapCtx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Roads from the city's avenue list, in whatever shape it stores them.
    const avenues = G.city?.avenues;
    if (Array.isArray(avenues)) {
      mapCtx.strokeStyle = '#8a97a8';
      mapCtx.lineWidth = 3;
      for (const road of avenues) {
        try {
          if (typeof road.axis === 'string' && typeof road.at === 'number') {
            // The city stores avenues as { axis: 'x'|'z', at, from, to }.
            if (road.axis === 'x') {
              const [ax, ay] = toMap(road.from, road.at);
              const [bx, by] = toMap(road.to, road.at);
              mapCtx.beginPath();
              mapCtx.moveTo(ax, ay);
              mapCtx.lineTo(bx, by);
              mapCtx.stroke();
            } else {
              const [ax, ay] = toMap(road.at, road.from);
              const [bx, by] = toMap(road.at, road.to);
              mapCtx.beginPath();
              mapCtx.moveTo(ax, ay);
              mapCtx.lineTo(bx, by);
              mapCtx.stroke();
            }
          } else if (typeof road.x1 === 'number') {
            const [ax, ay] = toMap(road.x1, road.z1);
            const [bx, by] = toMap(road.x2, road.z2);
            mapCtx.beginPath();
            mapCtx.moveTo(ax, ay);
            mapCtx.lineTo(bx, by);
            mapCtx.stroke();
          } else if (typeof road.x === 'number' && typeof road.from === 'number') {
            const [ax, ay] = toMap(road.x, road.from);
            const [bx, by] = toMap(road.x, road.to);
            mapCtx.beginPath();
            mapCtx.moveTo(ax, ay);
            mapCtx.lineTo(bx, by);
            mapCtx.stroke();
          } else if (typeof road.z === 'number' && typeof road.from === 'number') {
            const [ax, ay] = toMap(road.from, road.z);
            const [bx, by] = toMap(road.to, road.z);
            mapCtx.beginPath();
            mapCtx.moveTo(ax, ay);
            mapCtx.lineTo(bx, by);
            mapCtx.stroke();
          }
        } catch {
          // One odd road entry must not kill the minimap.
        }
      }
    }

    // Places: safehouse green, garage orange, club pink, package pickup white.
    drawMapPlace(G.city?.safehouse, '#37d67a', 'H');
    drawMapPlace(G.city?.garage, '#ff9f2e', 'G');
    drawMapPlace(G.city?.club, '#ff5fa2', 'C');
    drawMapPlace(G.city?.packagePickup, '#ffffff', 'P');

    // Traffic as grey dots.
    const trafficCars = G.traffic?.cars;
    if (Array.isArray(trafficCars)) {
      mapCtx.fillStyle = '#9aa7b5';
      for (const car of trafficCars) {
        const pos = car?.group?.position || car?.position;
        if (!pos) continue;
        const [mx, my] = toMap(pos.x, pos.z);
        mapCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    }

    // Police as blinking blue/red dots.
    const policeCars = G.police?.cars || G.police?.units;
    if (Array.isArray(policeCars)) {
      const blink = Math.floor((G.time || 0) * 2) % 2 === 0;
      mapCtx.fillStyle = blink ? '#3f8cff' : '#ff3b30';
      for (const car of policeCars) {
        const pos = car?.group?.position || car?.position;
        if (!pos) continue;
        const [mx, my] = toMap(pos.x, pos.z);
        mapCtx.beginPath();
        mapCtx.arc(mx, my, 3, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }

    // Mission marker: a pulsing yellow diamond.
    const marker = G.missions?.markerPos?.();
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      const r = 5 + Math.sin((G.time || 0) * 4) * 1.5;
      mapCtx.fillStyle = '#ffd23f';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, my - r);
      mapCtx.lineTo(mx + r, my);
      mapCtx.lineTo(mx, my + r);
      mapCtx.lineTo(mx - r, my);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.strokeStyle = 'rgba(0,0,0,0.7)';
      mapCtx.lineWidth = 1;
      mapCtx.stroke();
    }

    // The player: a white arrow turned to the heading.
    const playerPos = G.player?.pos;
    if (playerPos) {
      const [mx, my] = toMap(playerPos.x, playerPos.z);
      mapCtx.save();
      mapCtx.translate(mx, my);
      mapCtx.rotate(Math.PI - (G.player.heading || 0));
      mapCtx.fillStyle = '#ffffff';
      mapCtx.strokeStyle = 'rgba(0,0,0,0.8)';
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.moveTo(0, -7);
      mapCtx.lineTo(5, 6);
      mapCtx.lineTo(0, 3);
      mapCtx.lineTo(-5, 6);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();
      mapCtx.restore();
    }
  }

  function drawMapPlace(place, color, label) {
    const p = place?.position ? place.position : place;
    if (!p || typeof p.x !== 'number') return;
    const [mx, my] = toMap(p.x, p.z);
    mapCtx.fillStyle = color;
    mapCtx.fillRect(mx - 4, my - 4, 8, 8);
    mapCtx.fillStyle = '#0c1420';
    mapCtx.font = `bold 7px ${FONT}`;
    mapCtx.textAlign = 'center';
    mapCtx.textBaseline = 'middle';
    mapCtx.fillText(label, mx, my + 0.5);
  }

  function drawScreen(screen, G) {
    fitCanvas(hudCanvas, ctx);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (screen === 'title') {
      ctx.fillStyle = 'rgba(10,10,24,0.45)';
      ctx.fillRect(0, 0, w, h);
      outlinedText(ctx, 'SOLMAR BAY', w / 2, h * 0.34, `bold 84px ${FONT}`, '#ffd76a', 'center');
      outlinedText(ctx, 'An open-world story — Rico Vale owes Marisol Kane', w / 2, h * 0.34 + 52, `bold 24px ${FONT}`, '#ffffff', 'center');
      outlinedText(ctx, 'Three jobs. One debt. A whole city to cross.', w / 2, h * 0.34 + 88, `20px ${FONT}`, 'rgba(255,255,255,0.85)', 'center');
      const startY = h * 0.34 + 140;
      outlinedText(ctx, G.hasSave ? 'Press ENTER / Click to CONTINUE' : 'Press ENTER / Click to START', w / 2, startY, `bold 28px ${FONT}`, '#ffd23f', 'center');
      outlinedText(ctx, 'WASD move / drive   •   Mouse look   •   E enter or steal a car', w / 2, startY + 52, `19px ${FONT}`, '#ffffff', 'center');
      outlinedText(ctx, 'F punch   •   Click shoot   •   M mute   •   Esc pause', w / 2, startY + 82, `19px ${FONT}`, '#ffffff', 'center');
      outlinedText(ctx, 'Complete missions, earn cash, stay ahead of the Solmar Bay PD.', w / 2, startY + 122, `17px ${FONT}`, 'rgba(255,255,255,0.75)', 'center');
      return;
    }
    if (screen === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, w, h);
      outlinedText(ctx, 'PAUSED', w / 2, h * 0.42, `bold 72px ${FONT}`, '#ffffff', 'center');
      outlinedText(ctx, 'Press Esc to keep playing', w / 2, h * 0.42 + 56, `22px ${FONT}`, 'rgba(255,255,255,0.85)', 'center');
      return;
    }
    if (screen === 'over') {
      ctx.fillStyle = 'rgba(20,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      outlinedText(ctx, 'WASTED', w / 2, h * 0.36, `bold 88px ${FONT}`, '#ff4d4d', 'center');
      outlinedText(ctx, 'Rico is down — Marisol Kane still wants her money', w / 2, h * 0.36 + 56, `bold 22px ${FONT}`, '#ffffff', 'center');
      const done = G.missions?.current ?? 0;
      outlinedText(ctx, `Cash ${moneyText(G.player?.money)}   •   Missions finished ${Math.min(done, 3)} / 3`, w / 2, h * 0.36 + 100, `20px ${FONT}`, '#ffffff', 'center');
      outlinedText(ctx, 'Press ENTER to restart', w / 2, h * 0.36 + 152, `bold 26px ${FONT}`, '#ffd23f', 'center');
    }
  }

  return hud;
}
