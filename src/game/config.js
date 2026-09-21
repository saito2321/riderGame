export const CONFIG = Object.freeze({
  step: 1 / 120, roadWidth: 10.5, laneWidth: 3.5, bikeWidth: .6, bikeLength: 2,
  edge: 4.4, steeringSpeed: 6, smoothing: .12, sensitivity: 1.15,
  bikeLean: .56, reducedBikeLean: .28, leanInTime: .035, leanOutTime: .065,
  leanSpeedDeadzone: .08, minimumMovingBank: .55,
  health: 2, invincible: 1.25, reviveInvincible: 2, vehicleSpeed: 12,
  baseSpeed: 80 / 3.6, minSpeed: 80 / 3.6, maxBaseSpeed: 999 / 3.6, maxSpeed: 999 / 3.6,
  distanceStep: 300, speedIncrement: 5 / 3.6, baseAcceleration: 10 / 3.6,
  comboTime: 4.5, maxTurbo: 8, spawnZ: -155, poolSize: 18,
  coinBoost: 1.2, veryCloseBoost: 2.4, boostDecay: 2,
  rampHalfWidth: 1.15,
  trafficDensity: 1,
  brakeStartScore: 5000, brakeInterval: 3, brakeChance: .4, brakeDuration: 1.5,
  gapPassThreshold: 3, gapHalfWidth: .5, gapSpawnDistance: 45, gapReactionSeconds: 2.5,
  brakingSpeed: 6, brakeDeceleration: 12, vehicleAcceleration: 6,
});
export const TRAFFIC_BIKE = Object.freeze({ width: .72, length: 2.25, height: 2.1 });
export const VEHICLES = Object.freeze({
  car: { width: 1.8, length: 4.5, height: 1.5 },
  truck: { width: 2.4, length: 8, height: 3.2 },
  bus: { width: 2.5, length: 10, height: 3 },
  rampTruck: { width: 2.6, length: 11, height: 3.1 },
});
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const moveToward = (n, target, amount) => n + clamp(target - n, -amount, amount);
export function steer(x, target, dt, keyboard = false) {
  return clamp(x + clamp(keyboard ? target * CONFIG.steeringSpeed * dt : (target - x) * (1 - Math.exp(-dt / CONFIG.smoothing)), -CONFIG.steeringSpeed * dt, CONFIG.steeringSpeed * dt), -CONFIG.edge, CONFIG.edge);
}
export const multiplier = combo => combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 6 ? 2 : combo >= 3 ? 1.5 : 1;
export const warningSeconds = score => Math.max(1.25, 2.5 - Math.max(0, Math.floor((score - 10000) / 5000)) * .25);
export const nearPoints = gap => gap <= .18 + 1e-9 ? 300 : 100;
export const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Highest lane-change difficulty matches the shortest warning at score 35,000.
export const signalEvery = score => Math.max(3, 10 - Math.floor(Math.max(0, score) / 5000));
