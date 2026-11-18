// The city of Solmar Bay: a procedural grid of blocks, roads, towers, a beach
// and the water past it. Everything is built from the seeded RNG, so the same
// seed always builds the same city. Exports the colliders every moving thing
// uses and the road lines traffic drives on.
import { CITY, PALETTE } from './config.js';
import { pick, range, rangeInt } from './random.js';

// Road centre lines, both axes: the gaps between blocks plus the ring road.
// Block centres sit at (i-3)*46; the gap after block i is its centre + 23.
export function roadLines() {
  const half = CITY.span / 2;
  const lines = [-half];
  for (let i = 0; i < CITY.blocks - 1; i += 1) lines.push((i - 3) * CITY.block + CITY.block / 2);
  lines.push(half);
  return lines;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffd98a' : '#2a3542';
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createWorld(scene, rng) {
  const lines = roadLines();
  const half = CITY.span / 2;
  const colliders = [];
  const winTex = windowTexture();

  const lambert = (color) => new THREE.MeshLambertMaterial({ color });
  const box = (w, h, d, color, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || lambert(color));
    m.position.set(x, y, z);
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Ground: asphalt city floor, then sand, then water to the south (+z).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.span + 40, CITY.span + CITY.beach + CITY.water + 40),
    lambert(PALETTE.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (CITY.beach + CITY.water) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.span + 40, CITY.beach),
    lambert(PALETTE.sand),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, half + CITY.beach / 2);
  sand.receiveShadow = true;
  scene.add(sand);

  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.span + 40, CITY.water),
    waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.03, half + CITY.beach + CITY.water / 2);
  scene.add(water);

  // Sidewalk slabs, one per block, and the buildings on them.
  const downtown = (bx, bz) => Math.abs(bx) <= 1 && Math.abs(bz) <= 1;
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const cx = (i - 3) * CITY.block;
      const cz = (j - 3) * CITY.block;
      box(CITY.block - CITY.road, 0.3, CITY.block - CITY.road, PALETTE.sidewalk, cx, 0.15, cz, { shadow: false });
      const count = downtown(i - 3, j - 3) ? rangeInt(rng, 2, 3) : rangeInt(rng, 1, 2);
      for (let b = 0; b < count; b += 1) {
        const w = range(rng, 10, 18);
        const d = range(rng, 10, 18);
        const h = downtown(i - 3, j - 3) ? range(rng, 24, 58) : range(rng, 8, 26);
        const ox = range(rng, -8, 8);
        const oz = range(rng, -8, 8);
        const x = cx + ox;
        const z = cz + oz;
        const tint = pick(rng, PALETTE.building);
        const tex = winTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 12)));
        const mat = new THREE.MeshLambertMaterial({ color: tint, map: tex });
        box(w, h, d, tint, x, h / 2 + 0.3, z, { material: mat });
        // Roof cap so towers read at a distance.
        box(w + 0.6, 0.6, d + 0.6, 0x5a4a3a, x, h + 0.6, z, { shadow: false });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Landmarks the missions use: docks east, Marina hotel south, garage west.
  const hotel = box(26, 44, 18, 0xe8dcc8, -40, 22.3, half - 22);
  void hotel;
  colliders.push({ minX: -53, maxX: -27, minZ: half - 31, maxZ: half - 13 });
  box(20, 10, 14, 0x7a9ab8, half - 20, 5.3, 0);
  colliders.push({ minX: half - 30, maxX: half - 10, minZ: -7, maxZ: 7 });
  box(24, 8, 16, 0x9a8a7a, -half + 20, 4.3, -40);
  colliders.push({ minX: -half + 8, maxX: -half + 32, minZ: -48, maxZ: -32 });

  // Shipping containers at the docks.
  for (let k = 0; k < 6; k += 1) {
    const cx = half - 34 + (k % 3) * 9;
    const cz = 30 + Math.floor(k / 3) * 10;
    box(8, 3, 3, pick(rng, [0xb8442c, 0x2c6e8a, 0xc7a23a]), cx, 1.8, cz);
    colliders.push({ minX: cx - 4, maxX: cx + 4, minZ: cz - 1.5, maxZ: cz + 1.5 });
  }

  // Palm trees along the beach and a few on the blocks.
  const trunkMat = lambert(0x7a5a34);
  const frondMat = lambert(0x3f8f4f);
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    for (let f = 0; f < 5; f += 1) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 4), frondMat);
      frond.scale.set(1.6, 0.35, 0.7);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.8, 7.2, z + Math.sin(a) * 1.8);
      frond.rotation.y = -a;
      scene.add(frond);
    }
  }
  for (let x = -half + 10; x <= half - 10; x += 26) palm(x + range(rng, -4, 4), half + 14);
  for (let k = 0; k < 10; k += 1) palm(range(rng, -half, half), range(rng, -half, half));

  // Street lamps at every other intersection.
  const lampMat = lambert(0x3a3a3a);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < lines.length; i += 2) {
    for (let j = 0; j < lines.length; j += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 5), lampMat);
      pole.position.set(lines[i] + 8, 3, lines[j] + 8);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.6), lampHeadMat);
      head.position.set(lines[i] + 8, 6.1, lines[j] + 8);
      scene.add(head);
    }
  }

  // Sun, sky light and haze.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.1);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75));
  scene.fog = new THREE.Fog(PALETTE.fog, 260, 620);
  scene.background = new THREE.Color(PALETTE.sky);

  return {
    colliders,
    lines,
    half,
    waterMat,
    locations: {
      spawn: { x: 0, z: 120 },
      docks: { x: half - 20, z: 0 },
      hotel: { x: -40, z: half - 22 },
      garage: { x: -half + 20, z: -40 },
      plaza: { x: 0, z: 0 },
      beach: { x: 60, z: half + 30 },
    },
  };
}

// Push a circle (x, z, radius) out of every building it overlaps. Returns true
// when a push happened; pos is edited in place.
export function resolveCircle(pos, radius, world) {
  let hit = false;
  for (const c of world.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      // Centre inside the box: shove out along the shortest side.
      const left = pos.x - c.minX;
      const right = c.maxX - pos.x;
      const top = pos.z - c.minZ;
      const bottom = c.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = c.minX - radius;
      else if (m === right) pos.x = c.maxX + radius;
      else if (m === top) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  const bound = world.half + CITY.beach + CITY.water - 6;
  pos.x = Math.max(-world.half - 20, Math.min(world.half + 20, pos.x));
  pos.z = Math.max(-world.half - 20, Math.min(bound, pos.z));
  return hit;
}

// A random point on a road, for spawning traffic and police.
export function randomRoadPoint(rng, world) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const line = world.lines[Math.floor(rng() * world.lines.length)];
  const along = (rng() * 2 - 1) * (world.half - 10);
  const lane = rng() < 0.5 ? -3.5 : 3.5;
  if (axis === 'x') return { x: along, z: line + lane, axis, line, dir: rng() < 0.5 ? 1 : -1 };
  return { x: line + lane, z: along, axis, line, dir: rng() < 0.5 ? 1 : -1 };
}
