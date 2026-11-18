// SOLMAR — Open Streets: central tuning for the whole game.
// Every number the city, the cars, the police and the missions share lives
// here, so a single edit retunes the feel of the game.
export const CONFIG = {
  // City layout: 7 streets each way, 48 units apart, blocks between them.
  streetPitch: 48,
  streetCount: 7,
  streetHalfWidth: 6,
  cityHalf: 168,
  blockInset: 24,

  // Look and light.
  skyColor: 0x87b5d6,
  fogColor: 0x9db8c8,
  fogNear: 120,
  fogFar: 420,
  groundColor: 0x3f5a3a,
  roadColor: 0x2c2f36,
  sidewalkColor: 0x8a8d90,

  // The player on foot.
  walkSpeed: 9,
  runSpeed: 13,
  playerRadius: 1.1,

  // Driving.
  carAccel: 26,
  carBrake: 34,
  carReverseMax: 12,
  carTopSpeed: 30,
  carSteer: 1.9,
  carRadius: 2.2,
  enterRange: 5,

  // Traffic.
  trafficCount: 10,
  trafficSpeed: 9,
  trafficSpeedJitter: 3,

  // Police and wanted.
  wantedMax: 5,
  policeTopSpeed: 31,
  policeCatchRadius: 3.2,
  wantedDecayPerSec: 0.12,
  wantedDecayClearRange: 34,

  // Missions.
  arriveRadius: 7,
  beaconPulseSpeed: 2.4,

  // Camera.
  camFollowDistance: 13,
  camFollowHeight: 7,
  camLookAhead: 8,

  // Minimap.
  minimapSize: 168,
};

// The seeded default the city and the staged shots both start from.
export const DEFAULT_SEED = 1;

// Mara's three jobs. Positions sit on street intersections so a car can
// always drive right up to them.
export const JOBS = [
  {
    id: 'boost',
    title: 'Job 1 — Boost the Comet',
    intro:
      "Rook, I need a Comet. Silver one, parked by the marina on West Pier. Take it, then bring it to the garage on Crane Street.",
    hint: 'Steal the silver car, then drive to the garage marker.',
    carSpot: { x: -96, z: -48 },
    target: { x: 96, z: 96 },
    targetLabel: 'Garage — Crane Street',
  },
  {
    id: 'getaway',
    title: 'Job 2 — Shake the Tail',
    intro:
      'Cops are on you now, Rook. Lose them and get to the north bridge. Do not stop at the lights.',
    hint: 'Reach the north bridge while the police chase you.',
    carSpot: null,
    target: { x: 0, z: -144 },
    targetLabel: 'North Bridge',
    forceWanted: 2,
  },
  {
    id: 'drop',
    title: 'Job 3 — The Last Drop',
    intro:
      'Last one. Take the Comet across town to the south docks and walk away clean. You did good, Rook.',
    hint: 'Deliver the car to the south docks.',
    carSpot: null,
    target: { x: -48, z: 144 },
    targetLabel: 'South Docks',
  },
];
