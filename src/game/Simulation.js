import { updateBikeBank } from './BikeBank.js';
import { CONFIG as C, VEHICLES, steer, moveToward, multiplier, warningSeconds, nearPoints, smoothstep, randomGenerator } from './config.js';

// Continuous intersection of a line segment and a 1D interval, in frame fractions.
export function interval(a, b, min, max) {
  if (Math.abs(b - a) < 1e-12) return a >= min && a <= max ? [0, 1] : null;
  const t0 = (min - a) / (b - a), t1 = (max - a) / (b - a);
  const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
  return lo <= hi ? [lo, hi] : null;
}
export class Simulation {
  constructor(seed = 1) {
    this.vehicles = Array.from({ length: C.poolSize }, (_, slot) => ({ slot, active: false }));
    this.reset(seed);
  }
  reset(seed) {
    this.seed = seed >>> 0; this.random = randomGenerator(this.seed); this.nextId = 1;
    this.x = 0; this.bank = 0; this.time = 0; this.distance = 0; this.score = 0; this.health = C.health;
    this.combo = 0; this.bestCombo = 0; this.nearMisses = 0; this.lastNear = -Infinity;
    this.baseSpeed = C.baseSpeed; this.speed = C.baseSpeed; this.turbo = 0;
    this.turboRate = 0; this.turboRiseRate = 2; this.invincible = 0; this.crashRecovery = 0; this.hitStop = 0;
    this.dead = false; this.revived = false; this.spawnTravel = 0; this.laneTimer = 0;
    this.events = []; this.speedLevel = 0;
    for (const v of this.vehicles) v.active = false;
    this.spawnVehicle('car', -3.5, -60);
    this.spawnVehicle('car', 3.5, -92);
    this.spawnVehicle('car', 0, -124);
  }
  spawnVehicle(type, x, z) {
    const v = this.vehicles.find(v => !v.active);
    if (!v) return null;
    Object.assign(v, VEHICLES[type], { type, id: this.nextId++, active: true, x, z, oldX: x, oldZ: z,
      nearStarted: false, disqualified: false, scored: false, minGap: Infinity, side: 0,
      change: 'straight', changeUsed: false, changeTime: 0, warning: 0, direction: 0, fromX: x, toX: x });
    return v;
  }
  breakCombo(immediate = false) { this.combo = 0; this.turboRate = this.turbo; if (immediate) this.turbo = 0; }
  safeZone() {
    // Remove nearby hazards instead of teleporting them across the player's path.
    for (const v of this.vehicles) if (v.active && (v.z > -110 || v.change !== 'straight')) v.active = false;
    this.spawnTravel = 0;
  }
  revive() {
    if (!this.dead || this.revived) return false;
    this.revived = true; this.bank = 0; this.dead = false; this.health = 1; this.hitStop = 0;
    this.invincible = C.reviveInvincible; this.crashRecovery = 0; this.breakCombo(true); this.safeZone(); return true;
  }
  // Reserve the full swept width of lane changes. Verify an actual smoothed steering
  // trajectory after 1s reaction, against the envelope of relative speeds 5.6..32 m/s.
  // Conservative acceptance can reject a playable wave; rejection means less traffic.
  hasSafePath(extra = []) {
    const obstacles = [...this.vehicles.filter(v => v.active), ...extra];
    const horizon = Math.max(6, ...obstacles.map(v => (-v.z + (v.length + C.bikeLength) / 2) / 5.6));
    for (const target of [-4.7, -3.5, -1.75, 0, 1.75, 3.5, 4.7]) {
      let x = this.x, safe = true;
      for (let t = .05; t <= horizon && safe; t += .05) {
        const oldX = x; if (t > 1) x = steer(x, target, .05);
        for (const v of obstacles) {
          const halfZ = (v.length + C.bikeLength) / 2;
          if (v.z + 32 * t < -halfZ || v.z + 5.6 * (t - .05) > halfZ) continue;
          const halfX = (v.width + C.bikeWidth) / 2 + .15;
          const min = Math.min(v.x, v.change !== 'straight' ? v.toX : v.x) - halfX;
          const max = Math.max(v.x, v.change !== 'straight' ? v.toX : v.x) + halfX;
          if (Math.max(oldX, x) >= min && Math.min(oldX, x) <= max) { safe = false; break; }
        }
      }
      if (safe) return true;
    }
    return false;
  }
  spawnWave() {
    const lanes = [-3.5, 0, 3.5], first = Math.floor(this.random() * 3);
    const count = this.distance >= 1000 && this.random() < .55 ? 2 : 1;
    const candidates = [];
    for (let i = 0; i < count; i++) {
      const r = this.random();
      const type = this.distance >= 3000 && r < .18 ? 'bus' : this.distance >= 1000 && r < .4 ? 'truck' : 'car';
      candidates.push({ ...VEHICLES[type], type, x: lanes[(first + i) % 3], z: C.spawnZ, change: 'straight' });
    }
    while (candidates.length && !this.hasSafePath(candidates)) candidates.pop();
    for (const v of candidates) this.spawnVehicle(v.type, v.x, v.z);
  }
  changeIsSafe(car, toX) {
    const minX = Math.min(car.x, toX), maxX = Math.max(car.x, toX);
    for (const v of this.vehicles) {
      if (!v.active || v === car) continue;
      if (Math.abs(v.z - car.z) < (v.length + car.length) / 2 + 14 && v.x >= minX - 2.5 && v.x <= maxX + 2.5) return false;
      if (v.z > car.z && v.z < 0 && Math.abs(v.x - car.x) < 2.5) return false;
    }
    const prior = { change: car.change, toX: car.toX };
    car.change = 'signaling'; car.toX = toX;
    const safe = this.hasSafePath(); Object.assign(car, prior); return safe;
  }
  scheduleChange(dt) {
    if (this.score < 500) return;
    this.laneTimer += dt; if (this.laneTimer < 4) return; this.laneTimer = 0;
    if (this.vehicles.some(v => v.active && v.change !== 'straight') || this.random() >= .35) return;
    const candidates = this.vehicles.filter(v => v.active && v.type === 'car' && !v.changeUsed && v.z < -48 && v.z > -105).sort((a,b) => a.id-b.id);
    for (const v of candidates) {
      const dirs = this.random() < .5 ? [-1, 1] : [1, -1];
      for (const dir of dirs) {
        const toX = v.x + dir * C.laneWidth;
        if (Math.abs(toX) > 3.51 || !this.changeIsSafe(v, toX)) continue;
        v.change = 'signaling'; v.changeUsed = true; v.warning = warningSeconds(this.score);
        v.changeTime = 0; v.direction = dir; v.fromX = v.x; v.toX = toX; return;
      }
    }
  }
  updateVehicle(v, dt) {
    v.oldX = v.x; v.oldZ = v.z;
    if (v.change !== 'straight') {
      v.changeTime += dt;
      if (v.change === 'signaling' && v.changeTime >= v.warning) {
        if (!this.changeIsSafe(v, v.toX)) { v.change = 'straight'; v.direction = 0; }
        else { v.change = 'changing'; v.changeTime -= v.warning; }
      }
      if (v.change === 'changing') {
        v.x = v.fromX + (v.toX - v.fromX) * smoothstep(v.changeTime / 2);
        if (v.changeTime >= 2) { v.change = 'straight'; v.direction = 0; v.x = v.toX; }
      }
    }
    v.z += (this.speed - C.vehicleSpeed) * dt;
  }
  step(dt, input = { target: this.x, axis: 0 }) {
    this.events.length = 0;
    if (this.dead) return;
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); return; }
    const startTime = this.time; this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.crashRecovery = Math.max(0, this.crashRecovery - dt);
    const turboTarget = Math.min(this.combo * .4, C.maxTurbo);
    this.turbo = moveToward(this.turbo, turboTarget, (turboTarget > this.turbo ? this.turboRiseRate : this.turboRate) * dt);
    const level = Math.min(28, Math.floor(this.distance / C.distanceStep));
    if (level > this.speedLevel) { this.events.push({ type: 'speed' }); this.speedLevel = level; }
    this.baseSpeed = moveToward(this.baseSpeed, C.baseSpeed + level * .5, dt);
    this.speed = Math.min(C.maxSpeed, this.baseSpeed + this.turbo) * (1 - .2 * this.crashRecovery / 1.5);
    const traveled = this.speed * dt;
    this.distance += traveled; this.score = Math.min(Number.MAX_SAFE_INTEGER, this.score + traveled);
    const oldX = this.x;
    this.x = steer(this.x, input.axis ? input.axis : input.target, dt, Boolean(input.axis));
    this.bank = updateBikeBank(this.bank, (this.x - oldX) / dt, dt);
    if (input.axis) input.target = this.x;
    this.scheduleChange(dt);
    const contacts = [];
    for (const v of this.vehicles) {
      if (!v.active) continue;
      this.updateVehicle(v, dt);
      const halfZ = (v.length + C.bikeLength) / 2, halfX = (v.width + C.bikeWidth) / 2;
      const overlap = interval(v.oldZ, v.z, -halfZ, halfZ);
      if (overlap) {
        const rel0 = oldX - v.oldX, rel1 = this.x - v.x;
        const contact = interval(rel0, rel1, -halfX, halfX);
        if (contact && Math.max(contact[0], overlap[0]) <= Math.min(contact[1], overlap[1])) {
          v.disqualified = true; contacts.push({ type: 'hit', v, at: Math.max(contact[0], overlap[0]) });
        }
        const r0 = rel0 + (rel1 - rel0) * overlap[0], r1 = rel0 + (rel1 - rel0) * overlap[1];
        if (!v.nearStarted) { v.nearStarted = true; v.side = Math.sign(r0); if (v.oldZ > -halfZ + 1e-6) v.disqualified = true; }
        const gap0 = Math.abs(r0) - halfX, gap1 = Math.abs(r1) - halfX;
        if (Math.sign(r0) !== v.side || Math.sign(r1) !== v.side || Math.min(gap0,gap1) <= 0 || Math.max(gap0,gap1) > .6 + 1e-9) v.disqualified = true;
        v.minGap = Math.min(v.minGap, gap0, gap1);
      }
      if (v.oldZ <= halfZ && v.z > halfZ && v.nearStarted && !v.disqualified && !v.scored) contacts.push({ type: 'near', v, at: (halfZ - v.oldZ) / (v.z - v.oldZ), points: nearPoints(v.minGap) });
      if (v.z > 24) v.active = false;
    }
    contacts.sort((a,b) => a.at - b.at || (a.type === b.type ? (a.points || 0) - (b.points || 0) || a.v.id-b.v.id : a.type === 'hit' ? -1 : 1));
    for (const event of contacts) {
      if (this.dead || !event.v.active) continue;
      if (event.type === 'hit') {
        if (this.invincible > 0) continue;
        this.health--; this.breakCombo(); this.invincible = C.invincible; this.crashRecovery = 1.5; this.hitStop = .15;
        this.events.push({ type: 'hit', health: this.health });
        if (!this.health) {
          const unused = traveled * (1 - event.at); this.distance -= unused; this.score -= unused; this.time = startTime + event.at * dt;
          this.dead = true; this.bank = 0; this.breakCombo(true); this.events.push({ type: 'dead' });
        }
        else this.safeZone();
      } else {
        const at = startTime + event.at * dt;
        if (at - this.lastNear > C.comboTime + 1e-9) this.combo = 0;
        event.v.scored = true; this.combo++; this.lastNear = at;
        this.turboRiseRate = Math.max(0, Math.min(this.combo * .4, C.maxTurbo) - this.turbo) / .2;
        this.bestCombo = Math.max(this.bestCombo, this.combo); this.nearMisses++;
        const points = event.points * multiplier(this.combo);
        this.score = Math.min(Number.MAX_SAFE_INTEGER, this.score + points);
        this.events.push({ type: 'near', points, tier: event.points, combo: this.combo });
      }
    }
    if (this.combo && this.time - this.lastNear > C.comboTime + 1e-9) this.breakCombo();
    this.spawnTravel += (this.speed - C.vehicleSpeed) * dt;
    const spacing = this.distance < 1000 ? 28 : this.distance < 3000 ? 36 : 44;
    if (this.spawnTravel >= spacing && !this.dead) { this.spawnTravel = 0; this.spawnWave(); }
  }
}
