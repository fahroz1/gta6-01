// The HUD: DOM overlays for the screens and the readouts, plus a 2D canvas
// minimap that draws the city, the player, the police and the mission target.
import { CITY } from './config.js';
import { distanceToTarget } from './missions.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    hud: el('hud'),
    title: el('title'),
    pause: el('pause'),
    end: el('end'),
    endTitle: el('end-title'),
    endText: el('end-text'),
    objective: el('objective'),
    objectiveText: el('objective-text'),
    objectiveDist: el('objective-dist'),
    stars: el('stars'),
    cash: el('cash'),
    health: el('health'),
    healthBar: el('health-bar'),
    speed: el('speed'),
    hint: el('hint'),
    toast: el('toast'),
    crosshair: el('crosshair'),
    map: el('minimap'),
    mapCtx: el('minimap').getContext('2d'),
    titleStats: el('title-stats'),
  };
}

let toastTimer = 0;
export function showToast(hud, message, seconds = 3) {
  hud.toast.textContent = message;
  hud.toast.style.opacity = '1';
  toastTimer = seconds;
}

export function updateToast(hud, dt) {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) hud.toast.style.opacity = '0';
  }
}

export function setScreen(hud, screen, info = {}) {
  hud.title.style.display = screen === 'title' ? 'flex' : 'none';
  hud.pause.style.display = screen === 'paused' ? 'flex' : 'none';
  hud.end.style.display = screen === 'busted' || screen === 'wasted' || screen === 'complete' ? 'flex' : 'none';
  hud.hud.style.display = screen === 'play' ? 'block' : 'none';
  if (screen === 'busted') {
    hud.endTitle.textContent = 'BUSTED';
    hud.endText.textContent = info.text || 'The Solmar Bay police caught you. You lost your cut.';
  } else if (screen === 'wasted') {
    hud.endTitle.textContent = 'WASTED';
    hud.endText.textContent = info.text || 'You went down in Solmar Bay. The medics patched you up — for a fee.';
  } else if (screen === 'complete') {
    hud.endTitle.textContent = 'SOLMAR IS YOURS';
    hud.endText.textContent = info.text || 'Every job done. Rook runs this city now.';
  }
  if (screen === 'title' && info.stats) hud.titleStats.textContent = info.stats;
}

export function updateReadouts(hud, game) {
  const { player, wanted, missions } = game;
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < wanted.stars ? '★' : '☆';
  hud.stars.textContent = stars;
  hud.stars.style.color = wanted.stars > 0 ? '#ffcf3f' : '#ffffff';
  hud.cash.textContent = `$${Math.floor(player.cash)}`;
  hud.health.textContent = `HP ${Math.max(0, Math.ceil(player.health))}`;
  hud.healthBar.style.width = `${Math.max(0, player.health)}%`;
  hud.healthBar.style.background = player.health > 50 ? '#2ecc71' : player.health > 25 ? '#f39c12' : '#e74c3c';
  const speed = player.onFoot ? 0 : Math.abs(Math.round((player.car ? player.car.speed : 0) * 3.6));
  hud.speed.textContent = player.onFoot ? '' : `${speed} km/h`;
  hud.objectiveText.textContent = missions.text;
  const dist = distanceToTarget(missions, player.onFoot ? player.pos : player.car.pos);
  hud.objectiveDist.textContent = dist === null ? '' : `${dist}m`;
  hud.crosshair.style.display = player.weapon === 'pistol' && player.onFoot ? 'block' : 'none';
}

export function setHint(hud, text) {
  hud.hint.textContent = text || '';
}

// Minimap: roads, blocks, beach, water, player arrow, police, traffic dots,
// mission beacon. Redrawn a few times a second.
export function drawMinimap(hud, game) {
  const ctx = hud.mapCtx;
  const S = 180;
  const span = CITY.span + 50;
  const toMap = (x, z) => [((x + span / 2) / span) * S, ((z + span / 2) / span) * S];
  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, S, S);
  // Water + sand at the south edge.
  ctx.fillStyle = '#2e8fa8';
  ctx.fillRect(0, S - 14, S, 14);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, S - 22, S, 8);
  // Roads.
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 4;
  for (const line of game.world.lines) {
    const [x1, y1] = toMap(line, -CITY.span / 2);
    const [x2, y2] = toMap(line, CITY.span / 2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const [x3, y3] = toMap(-CITY.span / 2, line);
    const [x4, y4] = toMap(CITY.span / 2, line);
    ctx.beginPath();
    ctx.moveTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.stroke();
  }
  // Blocks.
  ctx.fillStyle = '#2c313a';
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const [x, y] = toMap((i - 3) * CITY.block - 16, (j - 3) * CITY.block - 16);
      ctx.fillRect(x, y, 32 * (S / span), 32 * (S / span));
    }
  }
  const dot = (x, z, color, r = 2.5) => {
    const [mx, my] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of game.traffic) dot(car.pos.x, car.pos.z, '#8a8f96', 1.8);
  for (const cop of game.police) dot(cop.pos.x, cop.pos.z, '#3f8cff', 3);
  const target = game.missions.active ? game.missions.target : null;
  if (target) {
    const [mx, my] = toMap(target.x, target.z);
    ctx.fillStyle = '#ffd21a';
    ctx.beginPath();
    ctx.arc(mx, my, 5 + Math.sin(game.time * 4) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow, rotated by heading.
  const px = game.player.onFoot ? game.player.pos : game.player.car.pos;
  const heading = game.player.onFoot ? game.player.heading : game.player.car.heading;
  const [mx, my] = toMap(px.x, px.z);
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
