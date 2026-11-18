// The Solmar HUD: wanted stars, speed, the current job, Mara's phone
// feed, a top-down minimap, and the start screen. All plain DOM over the
// WebGL canvas, no framework.
import { CONFIG } from './config.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.starsEl = document.getElementById('stars');
    this.speedEl = document.getElementById('speed');
    this.jobEl = document.getElementById('job');
    this.feedEl = document.getElementById('feed');
    this.mapEl = document.getElementById('minimap');
    this.mapCtx = this.mapEl.getContext('2d');
    this.startEl = document.getElementById('start');
    this.wanted = 0;
    this.feedCount = 0;
  }

  setWanted(n) {
    const stars = Math.max(0, Math.min(CONFIG.wantedMax, Math.ceil(n)));
    if (stars === this.wanted) return;
    this.wanted = stars;
    let text = '';
    for (let i = 0; i < CONFIG.wantedMax; i += 1) {
      text += i < stars ? '★' : '☆';
    }
    this.starsEl.textContent = text;
    this.starsEl.classList.toggle('hot', stars > 0);
  }

  setSpeed(kmh) {
    this.speedEl.textContent = `${Math.round(kmh)} km/h`;
  }

  setJob(text) {
    if (this.jobEl.textContent !== text) {
      this.jobEl.textContent = text;
    }
  }

  // A line from Mara (or the game) appears at the top of the phone feed.
  pushMessage(text) {
    const line = document.createElement('div');
    line.className = 'feed-line';
    line.textContent = text;
    this.feedEl.prepend(line);
    this.feedCount += 1;
    while (this.feedEl.children.length > 4) {
      this.feedEl.removeChild(this.feedEl.lastChild);
    }
  }

  showStart() {
    this.startEl.classList.remove('hidden');
  }

  hideStart() {
    this.startEl.classList.add('hidden');
  }

  // Top-down map: grey blocks, green objective, yellow traffic, red/blue
  // police, white player arrow.
  drawMinimap(world, player, trafficCars, policeCars, target) {
    const ctx = this.mapCtx;
    const size = CONFIG.minimapSize;
    const half = CONFIG.cityHalf;
    const toMap = (x, z) => [
      ((x + half) / (half * 2)) * size,
      ((z + half) / (half * 2)) * size,
    ];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(10, 18, 26, 0.72)';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(140, 150, 160, 0.55)';
    for (const f of world.footprints) {
      const [mx, mz] = toMap(f.x - f.hw, f.z - f.hd);
      const w = (f.hw * 2 / (half * 2)) * size;
      const h = (f.hd * 2 / (half * 2)) * size;
      ctx.fillRect(mx, mz, Math.max(1, w), Math.max(1, h));
    }
    if (target) {
      const [tx, ty] = toMap(target.x, target.z);
      ctx.fillStyle = '#37e08a';
      ctx.beginPath();
      ctx.arc(tx, ty, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#37e08a';
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23f';
    for (const car of trafficCars) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ff4d4d';
    for (const car of policeCars) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const [px, py] = toMap(player.x, player.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
