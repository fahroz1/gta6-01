// SOLMAR — Open Streets: the entry point. Builds the renderer, the city,
// Rook, the traffic, the police and Mara's jobs, then runs the loop.
// Reads ?shot=<name>&seed=<n> for the staged screenshot views.
import { CONFIG, DEFAULT_SEED } from './config.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '', 10) || DEFAULT_SEED;
const shotName = params.get('shot');
const shotMode = Boolean(shotName);

// --- Renderer and scene -------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  900,
);
camera.position.set(0, 30, 60);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- World and actors ---------------------------------------------------
const world = buildWorld(scene, seed);
const player = new Player(scene, 0, 24);
const traffic = new Traffic(scene, seed, world);
const police = new Police(scene, seed);
const missions = new Missions(scene, world);
const hud = new Hud();
const audio = new AudioEngine();

const game = {
  player,
  traffic,
  police,
  missions,
  camera,
  world,
  hud,
  shotCamera: false,
};

// Mara talks through the HUD feed, with a blip.
missions.onMessage = (text) => {
  hud.pushMessage(text);
  audio.blip();
};
missions.onJobComplete = () => {
  audio.blip();
};

// --- Input ---------------------------------------------------------------
const keys = new Set();
window.addEventListener('keydown', (event) => {
  audio.ensure();
  keys.add(event.key.toLowerCase());
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(event.key.toLowerCase())) {
    event.preventDefault();
  }
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});
window.addEventListener('pointerdown', () => audio.ensure());

// Start screen: click to play, unless a shot is being staged.
if (shotMode) {
  hud.hideStart();
} else {
  hud.showStart();
  const startBtn = document.getElementById('play');
  startBtn.addEventListener('click', () => {
    audio.ensure();
    hud.hideStart();
    missions.say('Mara: Rook. You are live. First job is on the board — check the beacon.');
  });
}

// --- Staged shots --------------------------------------------------------
if (shotMode) {
  applyShot(game, shotName, seed);
  hud.setJob(missions.jobText());
  hud.setWanted(police.stars);
}

// --- Heat rules ----------------------------------------------------------
let hitCooldown = 0;
let speedCooldown = 0;

function stealableCars() {
  const cars = [...traffic.allCars];
  if (missions.markedCar) cars.push(missions.markedCar);
  return cars;
}

// --- Camera ---------------------------------------------------------------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (game.shotCamera) return;
  const heading = player.driving ? player.driving.heading : player.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const px = player.x;
  const pz = player.z;
  const wantX = px - fx * CONFIG.camFollowDistance;
  const wantZ = pz - fz * CONFIG.camFollowDistance;
  const wantY = CONFIG.camFollowHeight;
  const k = Math.min(1, dt * 5);
  camera.position.x += (wantX - camera.position.x) * k;
  camera.position.y += (wantY - camera.position.y) * k;
  camera.position.z += (wantZ - camera.position.z) * k;
  camTarget.set(
    px + fx * CONFIG.camLookAhead,
    1.5,
    pz + fz * CONFIG.camLookAhead,
  );
  camera.lookAt(camTarget);
}

// --- Main loop ------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  hitCooldown = Math.max(0, hitCooldown - dt);
  speedCooldown = Math.max(0, speedCooldown - dt);

  const event = player.update(dt, keys, world, stealableCars(), (car) => {
    police.addWanted(1);
    missions.onSteal(car);
    hud.pushMessage('You stole a car — the heat is on.');
  });
  if (event === 'exit') {
    hud.pushMessage('You left the car on the street.');
  }

  traffic.update(dt, player.driving);

  // Bumping into traffic or a building while driving draws attention.
  if (player.driving && hitCooldown <= 0) {
    for (const other of traffic.allCars) {
      if (other === player.driving) continue;
      const d = Math.hypot(other.x - player.x, other.z - player.z);
      if (d < 3.8 && Math.abs(player.driving.speed) > 6) {
        player.driving.speed *= 0.5;
        police.addWanted(1);
        hitCooldown = 4;
        hud.pushMessage('You clipped another car — a witness called it in.');
        break;
      }
    }
  }

  // Speeding past a patrol car is asking for another star.
  if (player.driving && speedCooldown <= 0 && Math.abs(player.driving.speed) > 24) {
    for (const cop of police.cars) {
      const d = Math.hypot(cop.x - player.x, cop.z - player.z);
      if (d < 22) {
        police.addWanted(1);
        speedCooldown = 6;
        hud.pushMessage('You blew past a patrol car at full speed.');
        break;
      }
    }
  }

  const busted = police.update(dt, player, world);
  if (busted === 'busted') {
    hud.pushMessage('The cops rammed you — the heat just went up.');
  }

  // Job 2 starts hot: the getaway forces wanted level 2.
  if (missions.pendingWanted) {
    police.setWanted(missions.pendingWanted);
    missions.pendingWanted = 0;
    hud.pushMessage('Mara: They are coming. Drive.');
  }

  missions.update(dt, player);

  // HUD and sound follow the game state.
  hud.setWanted(police.stars);
  hud.setSpeed(player.currentSpeed * 4);
  hud.setJob(missions.jobText());
  hud.drawMinimap(
    world,
    player,
    traffic.cars.map((c) => c.rig),
    police.cars,
    missions.target,
  );
  audio.setEngine(
    Math.abs(player.currentSpeed) / CONFIG.carTopSpeed,
    Boolean(player.driving),
  );
  audio.setSiren(police.sirenOn);

  updateCamera(dt);
  renderer.render(scene, camera);

  frames += 1;
  if (shotMode && frames === 3) {
    window.__shotReady = true;
  }
}

tick();
