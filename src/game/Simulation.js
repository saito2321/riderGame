import { CoinSystem } from './CoinSystem.js';
import { updateBikeBank } from './BikeBank.js';
import { CONFIG as C, VEHICLES, TRAFFIC_BIKE, steer, moveToward, multiplier, warningSeconds, signalEvery, nearPoints, smoothstep, randomGenerator } from './config.js';

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
    this.x = 0; this.bank = 0; this.bankLateralSpeed = 0; this.time = 0; this.distance = 0; this.score = 0; this.health = C.health;
    this.combo = 0; this.bestCombo = 0; this.nearMisses = 0; this.lastNear = -Infinity;
    this.baseSpeed = C.baseSpeed; this.speed = C.baseSpeed; this.turbo = 0;
    this.jumpTime = 0; this.jumpDuration = 0; this.jumpVehicleId = null;
    this.turboRate = 0; this.turboRiseRate = 2; this.invincible = 0; this.crashRecovery = 0; this.hitStop = 0;
    this.dead = false; this.revived = false; this.spawnTravel = 0; this.laneTimer = 0; this.brakeTimer = 0;
    this.gapSide = 0; this.gapPassCount = 0; this.gapRetry = 0;
    if(this.coins)this.coins.reset(seed);else this.coins=new CoinSystem(seed);
    this.events = []; this.speedLevel = 0; this.unsignaledTraffic = 3;
    for (const v of this.vehicles) v.active = false;
    this.spawnVehicle('car', -3.5, -60);
    this.spawnVehicle('car', 3.5, -92);
    const openingRamp = this.spawnVehicle('rampTruck', 0, -55);
    openingRamp.trafficSpeed = 4; openingRamp.cruiseSpeed = 4;
    this.coins.placeStartingCoins();
  }
  spawnVehicle(type, x, z) {
    const v = this.vehicles.find(v => !v.active);
    if (!v) return null;
    Object.assign(v, type === 'bike' ? TRAFFIC_BIKE : VEHICLES[type], { type, id: this.nextId++, active: true, x, z, oldX: x, oldZ: z,
      gapPassSide: 0, nearStarted: false, disqualified: false, scored: false, minGap: Infinity, side: 0,
      change: 'straight', plannedDirection: 0, changeUsed: false, changeTime: 0, warning: 0, direction: 0, fromX: x, toX: x,
      braking: false, brakeUsed: false, brakeTime: 0, trafficSpeed: C.vehicleSpeed, cruiseSpeed: C.vehicleSpeed, rampUsed: false });
    return v;
  }
  breakCombo(immediate = false) { this.combo = 0; this.turboRate = this.turbo; if (immediate) this.turbo = 0; }
  safeZone() {
    this.coins.clear();
    // Remove nearby hazards instead of teleporting them across the player's path.
    for (const v of this.vehicles) if (v.active && (v.z > -110 || v.change !== 'straight')) v.active = false;
    this.spawnTravel = 0; this.gapSide = 0; this.gapPassCount = 0; this.gapRetry = 0;
  }
  revive() {
    if (!this.dead || this.revived) return false;
    this.revived = true; this.bank = 0; this.bankLateralSpeed = 0; this.dead = false; this.health = 1; this.hitStop = 0;
    this.invincible = C.reviveInvincible; this.crashRecovery = 0; this.jumpTime = 0; this.jumpDuration = 0; this.jumpVehicleId = null; this.breakCombo(true); this.safeZone(); return true;
  }
  // Verify a smoothed steering trajectory after 1s reaction. Single-lane
  // changes use the full relative-speed envelope. Two-lane changes follow the
  // timed car trajectory at the current speed so their full-road sweep does
  // not block every possible path for the entire approach.
  // Conservative acceptance can reject a playable wave; rejection means less traffic.
  hasSafePath(extra = []) {
    const obstacles = [...this.vehicles.filter(v => v.active), ...extra];
    const minClosingSpeed = this.baseSpeed * .8 - C.vehicleSpeed;
    const slowestTraffic = Math.min(C.brakingSpeed, ...obstacles.map(v => v.cruiseSpeed ?? C.vehicleSpeed));
    const maxClosingSpeed = Math.min(C.maxSpeed, this.speed + C.maxTurbo + 2 * C.speedIncrement) - slowestTraffic;
    const horizon = Math.max(6, ...obstacles.map(v => (-v.z + (v.length + C.bikeLength) / 2) / minClosingSpeed));
    for (const target of [-C.edge, -3.5, -1.75, 0, 1.75, 3.5, C.edge]) {
      let x = this.x, safe = true;
      for (let t = .05; t <= horizon && safe; t += .05) {
        const oldX = x; if (t > 1) x = steer(x, target, .05);
        for (const v of obstacles) {
          const halfZ = (v.length + C.bikeLength) / 2;
          const twoLane = v.change !== 'straight' && Math.abs(v.toX - v.x) > C.laneWidth + 1e-9;
          if (twoLane) {
            const closing = Math.max(1, this.speed - (v.trafficSpeed ?? C.vehicleSpeed));
            if (v.z + closing * t < -halfZ || v.z + closing * (t - .05) > halfZ) continue;
          } else if (v.z + maxClosingSpeed * t < -halfZ || v.z + minClosingSpeed * (t - .05) > halfZ) continue;
          const halfX = (v.width + C.bikeWidth) / 2 + .15;
          let min = Math.min(v.x, v.change !== 'straight' ? v.toX : v.x) - halfX;
          let max = Math.max(v.x, v.change !== 'straight' ? v.toX : v.x) + halfX;
          if (twoLane) {
            const closing = Math.max(1, this.speed - (v.trafficSpeed ?? C.vehicleSpeed));
            const signalAt = v.change === 'queued' ? Math.max(0, ((v.signalZ ?? -105) - v.z) / closing) : 0;
            const warningLeft = v.change === 'queued' ? v.plannedWarning ?? warningSeconds(this.score) : v.change === 'signaling' ? Math.max(0, v.warning - v.changeTime) : 0;
            const progress = v.change === 'changing' ? (v.changeTime + t) / 2 : (t - signalAt - warningLeft) / 2;
            const origin = v.fromX ?? v.x;
            const position = origin + (v.toX - origin) * smoothstep(progress);
            min = position - halfX; max = position + halfX;
          }
          if (Math.max(oldX, x) >= min && Math.min(oldX, x) <= max) { safe = false; break; }
        }
      }
      if (safe) return true;
    }
    return false;
  }
  syncGapPosition() {
    const side = Math.abs(Math.abs(this.x) - C.laneWidth / 2) <= C.gapHalfWidth ? Math.sign(this.x) : 0;
    if (!side || side !== this.gapSide) {
      this.gapSide = side; this.resetGapPasses();
    }
  }
  resetGapPasses() {
    this.gapPassCount = 0; this.gapRetry = 0;
    for (const v of this.vehicles) v.gapPassSide = 0;
  }
  updateGapTraffic(dt) {
    if (this.dead || this.hitStop > 0 || dt <= 0) return;
    this.syncGapPosition();
    const side = this.gapSide;
    if (!side) return;
    this.gapRetry = Math.max(0, this.gapRetry - dt);
    if (this.gapPassCount < C.gapPassThreshold || this.gapRetry > 0) return;
    this.gapRetry = .25;
    // Keep one approaching motorcycle per gap, and reuse the normal traffic pool.
    if (!this.vehicles.some(v => !v.active) || this.vehicles.some(v => v.active && v.type === 'bike' && v.z < 0 && Math.sign(v.x) === side)) return;
    const z = -Math.max(C.gapSpawnDistance, (this.speed - C.vehicleSpeed) * C.gapReactionSeconds);
    const candidate = { ...TRAFFIC_BIKE, type: 'bike', x: this.x, z, change: 'straight' };
    for (const v of this.vehicles) {
      if (!v.active) continue;
      const minX = Math.min(v.x, v.change !== 'straight' ? v.toX : v.x);
      const maxX = Math.max(v.x, v.change !== 'straight' ? v.toX : v.x);
      const halfX = (v.width + candidate.width) / 2 + .2;
      if (Math.abs(v.z - z) < (v.length + candidate.length) / 2 + (v.change !== 'straight' ? 14 : 8) && candidate.x >= minX - halfX && candidate.x <= maxX + halfX) return;
    }
    if (!this.hasSafePath([candidate])) return;
    this.spawnVehicle('bike', candidate.x, z); this.gapPassCount = 0;
  }
  laneChangeTiming() {
    const closingSpeed = Math.max(1, Math.min(C.maxSpeed, this.baseSpeed + C.maxTurbo) - C.vehicleSpeed);
    const warning = Math.min(warningSeconds(this.score), Math.max(1.25, (155 - 35) / closingSpeed - 1));
    const signalDistance = Math.max(105, closingSpeed * (warning + 1) + 35);
    return { warning, signalZ: -signalDistance, spawnZ: -Math.max(155, signalDistance + 20) };
  }
  spawnWave() {
    const lanes = [-3.5, 0, 3.5], first = Math.floor(this.random() * 3);
    const count = this.distance >= 1000 && this.random() < .55 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const due = this.unsignaledTraffic >= signalEvery(this.score) - 1;
      const timing = due ? this.laneChangeTiming() : null;
      const spawnZ = timing?.spawnZ ?? C.spawnZ;
      const r = this.random();
      const twoLaneChange = due && this.score > 10000 && r < .5;
      const type = due ? 'car' : this.distance >= 300 && r < .15 ? 'rampTruck' : this.distance >= 3000 && r < .18 ? 'bus' : this.distance >= 1000 && r < .4 ? 'truck' : 'car';
      let spawned = false;
      for (let option = 0; option < (due ? 3 : 1); option++) {
        const x = lanes[(first + i + option) % 3];
        const candidate = { ...VEHICLES[type], type, x, z: spawnZ, change: 'straight' };
        const offsets = due ? [...(twoLaneChange && x !== 0 ? [-Math.sign(x) * 2] : []), ...(x > 0 ? [-1, 1] : [1, -1])] : [0];
        for (const offset of offsets) {
          const toX = x + offset * C.laneWidth;
          if (Math.abs(toX) > C.laneWidth) continue;
          if (due) {
            candidate.change = 'queued'; candidate.toX = toX; candidate.signalZ = timing.signalZ; candidate.plannedWarning = timing.warning;
            const horizon = 20 / Math.max(1, this.speed - C.vehicleSpeed) + timing.warning + 2;
            if (!this.changeTrafficIsClear(candidate, toX, horizon)) continue;
          }
          const occupiesReservation = this.vehicles.some(other => other.active && other.change !== 'straight' &&
            Math.abs(other.z - candidate.z) < (other.length + candidate.length) / 2 + 14 &&
            candidate.x >= Math.min(other.x, other.toX) - (other.width + candidate.width) / 2 &&
            candidate.x <= Math.max(other.x, other.toX) + (other.width + candidate.width) / 2);
          if (occupiesReservation || !this.hasSafePath([candidate])) continue;
          const v = this.spawnVehicle(type, x, spawnZ);
          if (!v) return;
          if (due) {
            Object.assign(v, {change:'queued', fromX:x, toX, plannedDirection:Math.sign(offset), signalZ:timing.signalZ, plannedWarning:timing.warning});
            this.unsignaledTraffic = 0;
          } else this.unsignaledTraffic++;
          spawned = true; break;
        }
        if (spawned) break;
      }
      // Do not replace a required signaling car with ordinary traffic. Retry the
      // reserved maneuver on the next wave once there is space for it.
      if (!spawned) return;
    }
  }
  changeTrafficIsClear(car, toX, horizon = 0) {
    const minX = Math.min(car.x, toX), maxX = Math.max(car.x, toX);
    for (const v of this.vehicles) {
      if (!v.active || v === car) continue;
      // Reserve enough longitudinal space for braking during the entire maneuver.
      const differential = v.braking || car.braking || (v.trafficSpeed ?? C.vehicleSpeed) < C.vehicleSpeed || (car.trafficSpeed ?? C.vehicleSpeed) < C.vehicleSpeed ? C.vehicleSpeed - C.brakingSpeed : 0;
      const gap = (v.length + car.length) / 2 + 14 + differential * horizon;
      const otherMin = Math.min(v.x, v.change !== 'straight' ? v.toX : v.x);
      const otherMax = Math.max(v.x, v.change !== 'straight' ? v.toX : v.x);
      const halfX = (v.width + car.width) / 2 + .2;
      if (Math.abs(v.z - car.z) < gap && otherMax >= minX - halfX && otherMin <= maxX + halfX) return false;
    }
    return true;
  }
  changeIsSafe(car, toX) {
    if (car.type === 'rampTruck') return false;
    if (!this.changeTrafficIsClear(car, toX, warningSeconds(this.score) + 2)) return false;
    const prior = { change: car.change, toX: car.toX };
    car.change = 'signaling'; car.toX = toX;
    const safe = this.hasSafePath(); Object.assign(car, prior); return safe;
  }
  scheduleChange(dt) {
    // A lane corridor is reserved at spawn, so quota cars cannot lose the lottery
    // or miss a short scheduling window. Show the signal once they are visible.
    for (const v of this.vehicles) {
      if (!v.active || v.type === 'rampTruck' || v.change !== 'queued' || v.z < (v.signalZ ?? -105)) continue;
      v.change = 'signaling'; v.changeUsed = true; v.warning = v.plannedWarning ?? warningSeconds(this.score);
      v.changeTime = 0; v.direction = v.plannedDirection;
    }
  }
  scheduleBrake(dt) {
    if (this.score < C.brakeStartScore || this.vehicles.some(v => v.active && v.change !== 'straight')) return;
    this.brakeTimer += dt; if (this.brakeTimer < C.brakeInterval) return; this.brakeTimer = 0;
    if (this.random() >= C.brakeChance) return;
    const candidates = this.vehicles.filter(v => v.active && v.type !== 'bike' && v.type !== 'rampTruck' && !v.brakeUsed && v.change === 'straight' && v.z < -30 && v.z > -105);
    if (!candidates.length) return;
    const v = candidates[Math.floor(this.random() * candidates.length)];
    v.braking = true; v.brakeUsed = true; v.brakeTime = C.brakeDuration;
  }
  updateVehicle(v, dt) {
    v.oldX = v.x; v.oldZ = v.z;
    if (v.change !== 'straight') {
      v.changeTime += dt;
      if (v.change === 'signaling' && v.changeTime >= v.warning) {
        // The player already received the full warning. Restarting the reaction-time
        // path check here incorrectly cancels announced changes as the car approaches.
        if (!this.changeTrafficIsClear(v, v.toX, 2)) { v.change = 'straight'; v.direction = 0; }
        else { v.change = 'changing'; v.changeTime -= v.warning; }
      }
      if (v.change === 'changing') {
        v.x = v.fromX + (v.toX - v.fromX) * smoothstep(v.changeTime / 2);
        if (v.changeTime >= 2) { v.change = 'straight'; v.direction = 0; v.x = v.toX; }
      }
    }
    if (v.braking) {
      v.brakeTime = Math.max(0, v.brakeTime - dt);
      v.trafficSpeed = moveToward(v.trafficSpeed, C.brakingSpeed, C.brakeDeceleration * dt);
      if (v.brakeTime === 0) v.braking = false;
    } else v.trafficSpeed = moveToward(v.trafficSpeed, v.cruiseSpeed, C.vehicleAcceleration * dt);
    v.z += (this.speed - v.trafficSpeed) * dt;
  }
  step(dt, input = { target: this.x, axis: 0 }) {
    this.events.length = 0;
    if (this.dead) return;
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); return; }
    const startTime = this.time; this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.crashRecovery = Math.max(0, this.crashRecovery - dt);
    this.jumpTime = Math.max(0, this.jumpTime - dt);
    const turboTarget = Math.min(this.combo * .4, C.maxTurbo);
    this.turbo = moveToward(this.turbo, turboTarget, (turboTarget > this.turbo ? this.turboRiseRate : this.combo ? C.boostDecay : Math.max(this.turboRate, C.boostDecay)) * dt);
    const level = Math.min((C.maxBaseSpeed - C.baseSpeed) / C.speedIncrement, Math.floor(this.distance / C.distanceStep));
    if (level > this.speedLevel) { this.events.push({ type: 'speed' }); this.speedLevel = level; }
    this.baseSpeed = moveToward(this.baseSpeed, C.baseSpeed + level * C.speedIncrement, C.baseAcceleration * dt);
    this.speed = Math.max(C.minSpeed, Math.min(C.maxSpeed, this.baseSpeed + this.turbo) * (1 - .2 * this.crashRecovery / 1.5));
    const traveled = this.speed * dt;
    this.distance += traveled; this.score = Math.min(Number.MAX_SAFE_INTEGER, this.score + traveled);
    const oldX = this.x;
    this.x = steer(this.x, input.axis ? input.axis : input.target, dt, Boolean(input.axis));
    const lateralSpeed = (this.x - oldX) / dt;
    this.bank = updateBikeBank(this.bank, lateralSpeed, dt, this.bankLateralSpeed);
    this.bankLateralSpeed = lateralSpeed;
    if (input.axis) input.target = this.x;
    this.syncGapPosition();
    this.scheduleChange(dt);
    this.scheduleBrake(dt);
    const contacts = [];
    for (const v of this.vehicles) {
      if (!v.active) continue;
      this.updateVehicle(v, dt);
      const halfZ = (v.length + C.bikeLength) / 2, halfX = (v.width + C.bikeWidth) / 2;
      const overlap = interval(v.oldZ, v.z, -halfZ, halfZ);
      if (overlap) {
        // Count a complete pass of either adjacent lane, independently of Near Miss.
        const adjacent = Math.abs(this.x - v.x) <= C.laneWidth / 2 + C.gapHalfWidth;
        if (v.type !== 'bike' && this.gapSide && adjacent && v.oldZ <= -halfZ) v.gapPassSide = this.gapSide;
        if (!adjacent) v.gapPassSide = 0;
        const rel0 = oldX - v.oldX, rel1 = this.x - v.x;
        const contact = interval(rel0, rel1, -halfX, halfX);
        if (contact && Math.max(contact[0], overlap[0]) <= Math.min(contact[1], overlap[1])) {
          const at = Math.max(contact[0], overlap[0]);
          const entryX = rel0 + (rel1 - rel0) * overlap[0];
          const rampEntry = v.type === 'rampTruck' && !v.rampUsed && v.oldZ <= -halfZ &&
            Math.abs(at - overlap[0]) < 1e-9 && Math.abs(entryX) <= C.rampHalfWidth;
          v.gapPassSide = 0; v.disqualified = true;
          if (rampEntry) contacts.push({ type: 'jump', v, at });
          else if (!(v.type === 'rampTruck' && v.rampUsed && this.jumpVehicleId === v.id)) contacts.push({ type: 'hit', v, at });
        }
        const r0 = rel0 + (rel1 - rel0) * overlap[0], r1 = rel0 + (rel1 - rel0) * overlap[1];
        if (!v.nearStarted) { v.nearStarted = true; v.side = Math.sign(r0); if (v.oldZ > -halfZ + 1e-6) v.disqualified = true; }
        const gap0 = Math.abs(r0) - halfX, gap1 = Math.abs(r1) - halfX;
        if (Math.sign(r0) !== v.side || Math.sign(r1) !== v.side || Math.min(gap0,gap1) <= 0 || Math.max(gap0,gap1) > C.nearMissGap + 1e-9) v.disqualified = true;
        v.minGap = Math.min(v.minGap, gap0, gap1);
      }
      if (v.oldZ <= halfZ && v.z > halfZ && v.gapPassSide && v.gapPassSide === this.gapSide) {
        this.gapPassCount = Math.min(C.gapPassThreshold, this.gapPassCount + 1); v.gapPassSide = 0;
      }
      if (v.oldZ <= halfZ && v.z > halfZ && v.nearStarted && !v.disqualified && !v.scored) contacts.push({ type: 'near', v, at: (halfZ - v.oldZ) / (v.z - v.oldZ), points: nearPoints(v.minGap) });
      if (v.z > 24) v.active = false;
    }
    const priority = { hit: 0, jump: 1, near: 2 };
    contacts.sort((a,b) => a.at - b.at || priority[a.type] - priority[b.type] || (a.points || 0) - (b.points || 0) || a.v.id - b.v.id);
    for (const event of contacts) {
      if (this.dead || !event.v.active) continue;
      if (event.type === 'jump') {
        event.v.rampUsed = true; this.jumpVehicleId = event.v.id;
        const closingSpeed = Math.max(1, this.speed - event.v.trafficSpeed);
        this.jumpDuration = Math.max(2, (event.v.length + C.bikeLength + VEHICLES.car.length) / closingSpeed + .35);
        this.jumpTime = this.jumpDuration;
        this.score = Math.min(Number.MAX_SAFE_INTEGER, this.score + 500);
        this.events.push({ type: 'jump', points: 500 });
      } else if (event.type === 'hit') {
        this.resetGapPasses();
        if (this.jumpTime > 0) continue;
        if (this.invincible > 0) continue;
        this.health--; this.breakCombo(); this.invincible = C.invincible; this.crashRecovery = 1.5; this.hitStop = .15;
        this.events.push({ type: 'hit', health: this.health });
        if (!this.health) {
          const unused = traveled * (1 - event.at); this.distance -= unused; this.score -= unused; this.time = startTime + event.at * dt;
          this.dead = true; this.bank = 0; this.breakCombo(true); this.events.push({ type: 'dead' });
        }
      } else {
        const at = startTime + event.at * dt;
        if (at - this.lastNear > C.comboTime + 1e-9) this.combo = 0;
        event.v.scored = true; this.combo++; this.lastNear = at;
        if (event.points === 300) this.turbo = Math.min(C.maxTurbo, this.turbo + C.veryCloseBoost);
        this.turboRiseRate = Math.max(0, Math.min(this.combo * .4, C.maxTurbo) - this.turbo) / .2;
        this.bestCombo = Math.max(this.bestCombo, this.combo); this.nearMisses++;
        const points = event.points * multiplier(this.combo);
        this.score = Math.min(Number.MAX_SAFE_INTEGER, this.score + points);
        this.events.push({ type: 'near', points, tier: event.points, combo: this.combo });
      }
    }
    if (this.combo && this.time - this.lastNear > C.comboTime + 1e-9) this.breakCombo();
    this.spawnTravel += (this.speed - C.vehicleSpeed) * dt;
    const spacing = (this.distance < 1000 ? 28 : this.distance < 3000 ? 36 : 44) / C.trafficDensity;
    if (this.spawnTravel >= spacing && !this.dead) { this.spawnTravel -= spacing; this.spawnWave(); }
    this.updateGapTraffic(dt);
    if(!this.dead&&this.hitStop<=0)this.coins.update(this,dt,oldX);
  }
  advanceCrash(dt) {
    if (!this.dead || dt <= 0) return;
    this.events.length = 0;
    const traveled = this.speed * dt;
    this.time += dt;
    this.distance += traveled;
    for (const v of this.vehicles) {
      if (!v.active) continue;
      v.z += (this.speed - v.trafficSpeed) * dt;
      if (v.z > 24) v.active = false;
    }
    for (const coin of this.coins.items) {
      if (!coin.active) continue;
      coin.z += traveled;
      if (coin.z > 8) coin.active = false;
    }
  }
}
