// Solmar Bay itself: the street grid, the procedural buildings, the lamps
// and the sky. Everything is laid out from one seeded stream, so the same
// seed always builds the same city.
import { CONFIG } from './config.js';
import { makeRng } from './random.js';

const BUILDING_COLORS = [
  0x6b7a8c, 0x8c7a6b, 0x7a6b8c, 0x5f7080, 0x94806a,
  0x6a7a5f, 0x826b6b, 0x5b6b7a, 0x9a8f7a, 0x746a5e,
];
const ROOF_COLORS = [0x4a4640, 0x5c5148, 0x3e4a52, 0x6b5a4a];

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

// Street centerlines, from -144 to 144 in steps of 48.
export function streetLines() {
  const lines = [];
  const half = ((CONFIG.streetCount - 1) / 2) * CONFIG.streetPitch;
  for (let i = 0; i < CONFIG.streetCount; i += 1) {
    lines.push(-half + i * CONFIG.streetPitch);
  }
  return lines;
}

export function buildWorld(scene, seed) {
  const rng = makeRng(seed);
  const pitch = CONFIG.streetPitch;
  const half = CONFIG.cityHalf;

  scene.background = new THREE.Color(CONFIG.skyColor);
  scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);

  const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x3a4a35, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  // Ground slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: CONFIG.groundColor }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Road strips along every street line, both directions.
  const lines = streetLines();
  const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.roadColor });
  const walkMat = new THREE.MeshLambertMaterial({ color: CONFIG.sidewalkColor });
  for (const line of lines) {
    const roadV = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.streetHalfWidth * 2, half * 2),
      roadMat,
    );
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(line, 0.02, 0);
    scene.add(roadV);
    const roadH = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2, CONFIG.streetHalfWidth * 2),
      roadMat,
    );
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0.02, line);
    scene.add(roadH);

    // Pale sidewalk edging on both sides of each road.
    for (const side of [-1, 1]) {
      const walkV = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, half * 2),
        walkMat,
      );
      walkV.rotation.x = -Math.PI / 2;
      walkV.position.set(line + side * (CONFIG.streetHalfWidth + 1.4), 0.03, 0);
      scene.add(walkV);
      const walkH = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 2, 2.4),
        walkMat,
      );
      walkH.rotation.x = -Math.PI / 2;
      walkH.position.set(0, 0.03, line + side * (CONFIG.streetHalfWidth + 1.4));
      scene.add(walkH);
    }
  }

  // Buildings fill the blocks between the streets. A few blocks stay open
  // as plazas so the city breathes.
  const footprints = [];
  const plazaBlocks = new Set(['-4,-4', '2,2', '-4,2']);
  for (let i = -4; i <= 2; i += 1) {
    for (let j = -4; j <= 2; j += 1) {
      const key = `${i},${j}`;
      const cx = i * pitch + CONFIG.blockInset;
      const cz = j * pitch + CONFIG.blockInset;
      if (plazaBlocks.has(key)) {
        continue;
      }
      const twin = rng.chance(0.35);
      const color = rng.pick(BUILDING_COLORS);
      const roof = rng.pick(ROOF_COLORS);
      if (twin) {
        const w1 = rng.range(12, 18);
        const d1 = rng.range(12, 18);
        const h1 = rng.range(9, 34);
        const b1 = box(w1, h1, d1, color, cx - 7, h1 / 2, cz - 5);
        scene.add(b1);
        footprints.push({ x: cx - 7, z: cz - 5, hw: w1 / 2, hd: d1 / 2 });
        const w2 = rng.range(10, 15);
        const d2 = rng.range(10, 15);
        const h2 = rng.range(7, 26);
        const b2 = box(w2, h2, d2, roof, cx + 8, h2 / 2, cz + 7);
        scene.add(b2);
        footprints.push({ x: cx + 8, z: cz + 7, hw: w2 / 2, hd: d2 / 2 });
      } else {
        const w = rng.range(18, 28);
        const d = rng.range(18, 28);
        const h = rng.range(8, 42);
        const b = box(w, h, d, color, cx, h / 2, cz);
        scene.add(b);
        footprints.push({ x: cx, z: cz, hw: w / 2, hd: d / 2 });
        // A flat roof cap so towers read as finished.
        const cap = box(w * 0.55, 1.2, d * 0.55, roof, cx, h + 0.6, cz);
        scene.add(cap);
      }
    }
  }

  // Street lamps: a dark pole and a warm glowing head, mid-block along
  // each street (offset from the intersections so they never stand in
  // the middle of a crossing), alternating sides.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampMat = new THREE.MeshLambertMaterial({
    color: 0xffe9a8,
    emissive: 0xffd76a,
  });
  let lampFlip = 0;
  for (const line of lines) {
    for (let k = -3; k <= 3; k += 1) {
      lampFlip += 1;
      const side = lampFlip % 2 === 0 ? 1 : -1;
      const along = k * pitch + 12;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(line + side * (CONFIG.streetHalfWidth + 2.6), 3.5, along);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
      head.position.set(line + side * (CONFIG.streetHalfWidth + 2.6), 7.1, along);
      scene.add(head);
    }
  }

  // A simple harbor wall along the west edge, for the marina flavor.
  const quay = box(6, 3, half * 2, 0x7a7468, -half - 8, 1.5, 0);
  scene.add(quay);

  // Curb parking spots the mission car and the parked cars use.
  const parkingSpots = [];
  const spotStreets = [-96, -48, 0, 48, 96];
  for (const sx of spotStreets) {
    parkingSpots.push({ x: sx, z: -48 + 8.4, heading: 0 });
    parkingSpots.push({ x: sx + 8.4, z: 48, heading: Math.PI / 2 });
  }

  return {
    footprints,
    parkingSpots,
    bounds: half,
    lines,
  };
}
