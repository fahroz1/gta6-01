// The wanted system and the Solmar Bay police: stars rise with crime and
// fall with quiet time; police cars spawn at the edge of the action, chase,
// ram, and bust a player they catch on foot.
import { WANTED } from './config.js';
import { randomRoadPoint, resolveCircle } from './world.js';
import { createCar, driveCar } from './vehicles.js';

export function createWanted() {
  return {
    stars: 0,
    quietTimer: 0, // seconds since the last crime
    bustTimer: 0, // seconds a cop has held the player on foot
    flash: 0, // light-bar flash phase
  };
}

export function addWanted(wanted, stars) {
  wanted.stars = Math.min(WANTED.maxStars, wanted.stars + stars);
  wanted.quietTimer = 0;
  wanted.bustTimer = 0;
}

export function updateWanted(wanted, dt) {
  wanted.quietTimer += dt;
  if (wanted.stars > 0 && wanted.quietTimer > WANTED.decaySeconds) {
    wanted.stars -= 1;
    wanted.quietTimer = 0;
  }
  wanted.flash += dt;
}

export function createPolice(scene) {
  return []; // police cars, spawned on demand
}

function spawnPoliceCar(scene, rng, world, near) {
  const p = randomRoadPoint(rng, world);
  // Spawn on a road near the player, not on top of them.
  let tries = 0;
  let point = p;
  while (tries < 8 && Math.hypot(point.x - near.x, point.z - near.z) < 55) {
    point = randomRoadPoint(rng, world);
    tries += 1;
  }
  const car = createCar({
    x: point.x,
    z: point.z,
    heading: Math.atan2(near.x - point.x, near.z - point.z),
    color: 0x1a2a44,
    police: true,
    scene,
  });
  car.stuckTimer = 0;
  return car;
}

export function updatePolice(police, wanted, dt, world, rng, scene, player, playerCar) {
  const target = playerCar && !playerCar.dead ? playerCar.pos : player.pos;
  // Spawn up to one cruiser per star.
  while (police.length < wanted.stars) {
    police.push(spawnPoliceCar(scene, rng, world, target));
  }
  // Stand down the extras when the heat drops.
  while (police.length > wanted.stars) {
    const car = police.pop();
    scene.remove(car.mesh);
  }
  let touchingFoot = false;
  for (const cop of police) {
    // Pursuit: aim at where the target will be, steer hard, drive faster.
    const lead = 0.6;
    const tx = target.x + (playerCar ? Math.sin(playerCar.heading) * playerCar.speed * lead : 0);
    const tz = target.z + (playerCar ? Math.cos(playerCar.heading) * playerCar.speed * lead : 0);
    const wantHeading = Math.atan2(tx - cop.pos.x, tz - cop.pos.z);
    let dh = wantHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const dist = Math.hypot(tx - cop.pos.x, tz - cop.pos.z);
    const input = {
      up: dist > 4,
      down: false,
      left: dh > 0.08,
      right: dh < -0.08,
    };
    const before = { x: cop.pos.x, z: cop.pos.z };
    driveCar(cop, input, dt);
    // Faster than the player's car, so a chase can be lost only by out-driving.
    if (cop.speed > 0) cop.speed = Math.min(cop.speed + 6 * dt, cop.maxSpeed + 6);
    const moved = Math.hypot(cop.pos.x - before.x, cop.pos.z - before.z);
    if (moved < 0.05 && dist > 6) {
      cop.stuckTimer += dt;
      if (cop.stuckTimer > 3) {
        const p = randomRoadPoint(rng, world);
        cop.pos.x = p.x;
        cop.pos.z = p.z;
        cop.stuckTimer = 0;
      }
    } else {
      cop.stuckTimer = 0;
    }
    if (resolveCircle(cop.pos, 1.6, world)) cop.speed *= 0.6;
    // Ram the player's car.
    if (playerCar && !playerCar.dead) {
      const d = Math.hypot(cop.pos.x - playerCar.pos.x, cop.pos.z - playerCar.pos.z);
      if (d < 3.4) {
        playerCar.hp -= 26 * dt;
        const push = 6 * dt;
        playerCar.pos.x += ((playerCar.pos.x - cop.pos.x) / (d || 1)) * push;
        playerCar.pos.z += ((playerCar.pos.z - cop.pos.z) / (d || 1)) * push;
      }
    }
    // Catch the player on foot.
    if (player.onFoot) {
      const d = Math.hypot(cop.pos.x - player.pos.x, cop.pos.z - player.pos.z);
      if (d < 2.6) touchingFoot = true;
    }
    // Flashing light bar.
    const bar = cop.mesh.getObjectByName('lightbar');
    if (bar) {
      const phase = Math.floor(wanted.flash * 6) % 2 === 0;
      bar.material.color.setHex(phase ? 0xff2222 : 0x2266ff);
    }
  }
  if (touchingFoot && wanted.stars >= 1) wanted.bustTimer += dt;
  else wanted.bustTimer = 0;
  return wanted.bustTimer >= WANTED.bustSeconds;
}
