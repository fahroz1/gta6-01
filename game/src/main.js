// SOLMAR — Open Streets: boot, the one loop, input, camera, combat and the
// screens. The game moves between title, play, paused and the end screens;
// ?shot=name stages a screenshot scene instead of running the loop.
import { CITY, PLAYER, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, resolveCircle } from './world.js';
import { createCar, driveCar, randomCar } from './vehicles.js';
import { createPlayer, movePlayer, nearestCar } from './player.js';
import { createTraffic, updateTraffic, createParked, createPeds, updatePeds, knockPed } from './traffic.js';
import { createWanted, addWanted, updateWanted, createPolice, updatePolice } from './police.js';
import { createMissions, startMission, updateMissions, animateBeacon } from './missions.js';
import { createHud, setScreen, updateReadouts, drawMinimap, setHint, showToast, updateToast } from './hud.js';
import { createAudio, ensureAudio, updateAudio, playPickup, playShot, playBusted, toggleMute } from './audio.js';
import { stageShot, autopilotInput } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;

const world = createWorld(scene, rng);
const player = createPlayer(scene, world.locations.spawn.x, world.locations.spawn.z);
const traffic = createTraffic(scene, rng, world);
const parked = createParked(scene, rng, world);
const peds = createPeds(scene, rng, world);
const police = createPolice(scene);
const wanted = createWanted();
const missions = createMissions(scene, world);
const hud = createHud();
const audio = createAudio();

// The mission sports car, parked by the Plaza for job two.
const missionCar = createCar({ x: 2, z: -2, heading: Math.PI / 2, color: 0xe74c3c, sports: true, scene });
missionCar.parked = true;
missionCar.missionCar = true;
parked.push(missionCar);

const G = {
  scene, camera, renderer, world, player,
  traffic, parked, peds, police, wanted, missions, hud, audio,
  rng, time: 0, screen: 'title', camYaw: Math.PI, camPitch: 0.32,
  shotCamera: null, mapTimer: 0,
};

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    player.cash = data.cash || 0;
    missions.done = data.done || 0;
    missions.index = Math.min(missions.done, missions.jobs.length);
    if (missions.done >= missions.jobs.length) missions.storyDone = true;
  } catch {
    // A corrupt save starts fresh.
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: Math.floor(player.cash), done: missions.done }));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}

function announce(message) {
  status.textContent = message;
}

// --- input ---------------------------------------------------------------
const keys = new Set();
let dragging = false;
let lastX = 0;
let lastY = 0;

function readInput() {
  return {
    up: keys.has('KeyW') || keys.has('ArrowUp'),
    down: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

function nearestStealable() {
  const all = [...traffic, ...parked];
  return nearestCar(player, all);
}

function enterCar(car) {
  player.car = car;
  player.onFoot = false;
  player.mesh.visible = false;
  car.stolen = true;
  car.parked = false;
  if (car.missionCar) {
    showToast(hud, 'You stole the sports car!');
  } else {
    addWanted(wanted, 1);
    showToast(hud, 'You stole a car! The police are on to you.');
  }
  ensureAudio(audio);
}

function exitCar() {
  const car = player.car;
  car.speed = 0;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  player.pos.set(car.pos.x + side.x * 3, 0, car.pos.z + side.z * 3);
  resolveCircle(player.pos, PLAYER.radius, world);
  player.car = null;
  player.onFoot = true;
  player.mesh.visible = true;
  player.heading = car.heading;
  player.mesh.rotation.y = player.heading;
}

function punch() {
  if (player.punchCooldown > 0 || !player.onFoot) return;
  player.punchCooldown = 0.5;
  for (const ped of peds) {
    if (ped.state !== 'down') {
      const d = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
      if (d < 2.4) {
        knockPed(ped);
        addWanted(wanted, 1);
        showToast(hud, 'You knocked someone down! Witnesses called the cops.');
        return;
      }
    }
  }
}

const raycaster = new THREE.Raycaster();
function shoot() {
  if (player.shootCooldown > 0 || !player.onFoot || player.weapon !== 'pistol') return;
  player.shootCooldown = 0.28;
  playShot(audio);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 70;
  const pedMeshes = peds.filter((p) => p.state !== 'down').map((p) => p.mesh);
  const carMeshes = [...traffic, ...parked, ...police].filter((c) => !c.dead).map((c) => c.mesh);
  const hits = raycaster.intersectObjects([...pedMeshes, ...carMeshes], true);
  if (hits.length > 0) {
    // Walk up to the top-level group (a direct child of the scene).
    let top = hits[0].object;
    while (top.parent && top.parent !== scene) top = top.parent;
    const ped = peds.find((p) => p.mesh === top);
    if (ped) {
      knockPed(ped);
      addWanted(wanted, 1);
      return;
    }
    const car = [...traffic, ...parked, ...police].find((c) => c.mesh === top);
    if (car) {
      car.hp -= 30;
      addWanted(wanted, 1);
      if (car.hp <= 0) {
        car.dead = true;
        car.mesh.visible = false;
        showToast(hud, 'You wrecked a car!');
      }
    }
  }
}

function endScreen(kind, text) {
  playBusted(audio);
  player.cash = Math.max(0, player.cash * 0.8);
  saveGame();
  wanted.stars = 0;
  wanted.bustTimer = 0;
  for (const cop of police) scene.remove(cop.mesh);
  police.length = 0;
  player.health = PLAYER.health;
  if (player.car) {
    player.car.hp = 100;
    player.car = null;
    player.onFoot = true;
    player.mesh.visible = true;
  }
  player.pos.set(world.locations.spawn.x, 0, world.locations.spawn.z);
  G.screen = kind;
  setScreen(hud, kind, { text });
  announce(kind === 'busted' ? 'Busted.' : kind === 'wasted' ? 'Wasted.' : 'Story complete.');
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyM') {
    const muted = toggleMute(audio);
    showToast(hud, muted ? 'Sound off' : 'Sound on', 1.5);
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.screen === 'play') {
      G.screen = 'paused';
      setScreen(hud, 'paused');
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      setScreen(hud, 'play');
    }
    return;
  }
  if (G.screen !== 'play') return;
  if (e.code === 'KeyE') {
    if (player.onFoot) {
      const car = nearestStealable();
      if (car) enterCar(car);
    } else {
      exitCar();
    }
  } else if (e.code === 'KeyF') {
    punch();
  } else if (e.code === 'Digit1') {
    player.weapon = 'fists';
  } else if (e.code === 'Digit2') {
    player.weapon = 'pistol';
    showToast(hud, 'Pistol ready — click to shoot', 2);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// Clicks land on the window, not the canvas: the title, pause and end
// overlays sit above the canvas and would swallow a canvas-level click.
window.addEventListener('pointerdown', (e) => {
  ensureAudio(audio);
  if (G.screen === 'title') {
    startGame();
    return;
  }
  if (G.screen === 'paused') {
    G.screen = 'play';
    setScreen(hud, 'play');
    return;
  }
  if (G.screen === 'busted' || G.screen === 'wasted' || G.screen === 'complete') {
    startGame();
    return;
  }
  if (e.target !== canvas) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  if (player.weapon === 'pistol' && player.onFoot) shoot();
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  G.camYaw -= (e.clientX - lastX) * 0.005;
  G.camPitch = Math.max(0.08, Math.min(1.1, G.camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
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
    setScreen(hud, 'paused');
  }
});

function startGame() {
  ensureAudio(audio);
  player.health = PLAYER.health;
  G.screen = 'play';
  setScreen(hud, 'play');
  if (!missions.active && !missions.storyDone) startMission(missions);
  announce('Playing. Follow the yellow beacon.');
}

// --- simulation ----------------------------------------------------------
function updateCamera(dt) {
  if (G.shotCamera) {
    camera.position.set(...G.shotCamera.pos);
    camera.lookAt(...G.shotCamera.look);
    return;
  }
  const focus = player.onFoot ? player.pos : player.car.pos;
  const heading = player.onFoot ? player.heading : player.car.heading;
  if (player.onFoot) {
    // Drift the camera behind the direction of travel.
    let target = heading + Math.PI;
    let dh = target - G.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    G.camYaw += dh * Math.min(1, dt * 1.4);
  } else {
    let target = heading + Math.PI;
    let dh = target - G.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    G.camYaw += dh * Math.min(1, dt * 4);
  }
  const dist = player.onFoot ? 7.5 : 11;
  const height = player.onFoot ? 3.2 : 4.6;
  const cx = focus.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cz = focus.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist;
  camera.position.set(cx, height + Math.sin(G.camPitch) * dist * 0.6, cz);
  camera.lookAt(focus.x, focus.y + 1.8, focus.z);
}

function advance(dt, input) {
  G.time += dt;
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);

  if (player.onFoot) {
    movePlayer(player, input, G.camYaw, dt);
    resolveCircle(player.pos, PLAYER.radius, world);
    // Hit by a passing car.
    for (const car of [...traffic, ...police]) {
      if (car.dead) continue;
      const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
      if (d < 2 && Math.abs(car.speed) > 5) {
        player.health -= 20;
        player.pos.x += (player.pos.x - car.pos.x) * 0.5;
        player.pos.z += (player.pos.z - car.pos.z) * 0.5;
        showToast(hud, 'You were hit by a car!');
      }
    }
  } else {
    const car = player.car;
    const before = car.speed;
    driveCar(car, input, dt);
    if (resolveCircle(car.pos, 1.6, world)) {
      if (Math.abs(before) > 14) {
        car.hp -= 6;
        player.health -= 4;
      }
      car.speed *= 0.55;
    }
    if (car.hp <= 0) {
      car.dead = true;
      car.mesh.visible = false;
      showToast(hud, 'Your car is wrecked!');
      exitCar();
      player.health -= 15;
    }
    // Run over a pedestrian.
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
      if (d < 2 && Math.abs(car.speed) > 3) {
        knockPed(ped);
        addWanted(wanted, 1);
        showToast(hud, 'You hit a pedestrian!');
      }
    }
  }

  updateTraffic(traffic, dt, world, player.car, rng);
  updatePeds(peds, dt, world, player, player.car, rng);
  updateWanted(wanted, dt);
  const busted = updatePolice(police, wanted, dt, world, rng, scene, player, player.car);
  if (busted) {
    endScreen('busted', 'The Solmar Bay police caught you on foot. You lost 20% of your cash.');
    return;
  }
  if (player.health <= 0) {
    endScreen('wasted', 'You went down in Solmar Bay. The medics patched you up — for a fee.');
    return;
  }

  const pos = player.onFoot ? player.pos : player.car.pos;
  const result = updateMissions(missions, pos, !player.onFoot);
  if (result.earned > 0) {
    player.cash += result.earned;
    playPickup(audio);
    showToast(hud, result.message, 4);
    saveGame();
    if (missions.storyDone) {
      G.screen = 'complete';
      setScreen(hud, 'complete', { text: `Every job done. You banked $${Math.floor(player.cash)}. Solmar Bay is yours, Rook.` });
      return;
    }
  }
  animateBeacon(missions, G.time);
  world.waterMat.color.setHSL(0.54, 0.55, 0.42 + Math.sin(G.time * 0.5) * 0.03);

  // Hint line: what E does right now.
  if (player.onFoot) {
    const car = nearestStealable();
    setHint(hud, car ? (car.missionCar ? 'E — Steal the sports car' : 'E — Steal car') : '');
  } else {
    setHint(hud, 'E — Exit car');
  }

  updateReadouts(hud, G);
  G.mapTimer -= dt;
  if (G.mapTimer <= 0) {
    G.mapTimer = 0.12;
    drawMinimap(hud, G);
  }
  updateToast(hud, dt);
  updateAudio(audio, G, dt);
  updateCamera(dt);
}

// --- boot ----------------------------------------------------------------
loadSave();

function runShot(name) {
  const staged = stageShot(name, G);
  setScreen(hud, staged.screen, { stats: staged.stats || '' });
  const input = staged.autopilot ? autopilotInput(G, staged.autopilot) : { up: false, down: false, left: false, right: false, run: false };
  for (let i = 0; i < 120; i += 1) {
    const stepInput = staged.autopilot ? autopilotInput(G, staged.autopilot) : input;
    advance(STEP, stepInput);
    if (G.screen !== 'play' && G.screen !== 'title') break;
  }
  updateCamera(0);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  setScreen(hud, 'title', {
    stats: `Cash $${Math.floor(player.cash)} · ${missions.done} of ${missions.jobs.length} jobs done`,
  });
  announce('SOLMAR Open Streets. Click to start.');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (G.screen === 'play') {
      while (accumulator >= STEP) {
        advance(STEP, readInput());
        accumulator -= STEP;
        if (G.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
      if (G.screen === 'title') {
        // The city idles behind the title: traffic rolls, water shimmers.
        advance(STEP, { up: false, down: false, left: false, right: false, run: false });
      }
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
