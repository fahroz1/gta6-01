// The player on foot: a third-person walker who can steal any car, punch,
// and shoot. The player object is the one thing every system reads.
import { PLAYER } from './config.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 8), shirt);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skin);
  head.position.y = 2.0;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 2.28;
  group.add(cap);
  for (const x of [-0.28, 0.28]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 6), pants);
    leg.position.set(x, 0.45, 0);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.85, 6), shirt);
    arm.position.set(x * 1.9, 1.2, 0);
    arm.name = x < 0 ? 'armL' : 'armR';
    group.add(arm);
  }
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    heading: 0,
    health: PLAYER.health,
    cash: 0,
    onFoot: true,
    car: null,
    weapon: 'fists', // 'fists' | 'pistol'
    punchCooldown: 0,
    shootCooldown: 0,
    walkPhase: 0,
  };
}

// Move on foot: WASD relative to the camera yaw. Returns distance moved.
export function movePlayer(player, input, camYaw, dt) {
  const run = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let fx = 0;
  let fz = 0;
  if (input.up) { fx += -Math.sin(camYaw); fz += -Math.cos(camYaw); }
  if (input.down) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
  if (input.left) { fx += -Math.cos(camYaw); fz += Math.sin(camYaw); }
  if (input.right) { fx += Math.cos(camYaw); fz += -Math.sin(camYaw); }
  const len = Math.hypot(fx, fz);
  if (len > 0.01) {
    fx /= len;
    fz /= len;
    player.pos.x += fx * run * dt;
    player.pos.z += fz * run * dt;
    player.heading = Math.atan2(fx, fz);
    player.mesh.rotation.y = player.heading;
    player.walkPhase += dt * run * 1.6;
    const swing = Math.sin(player.walkPhase) * 0.5;
    const armL = player.mesh.getObjectByName('armL');
    const armR = player.mesh.getObjectByName('armR');
    if (armL) armL.rotation.x = swing;
    if (armR) armR.rotation.x = -swing;
    return run * dt;
  }
  return 0;
}

// Nearest car within reach, for the E key. Parked and traffic cars count.
export function nearestCar(player, cars, maxDist = 4.5) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.dead || car.police) continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
