import { CONFIG as C, clamp } from './config.js';

// Unit bank angle, updated alongside steering at 120 Hz, never from render snapshots.
export function updateBikeBank(bank, lateralSpeed, dt) {
  if (dt <= 0) return bank;
  const moving = Math.abs(lateralSpeed) > C.leanSpeedDeadzone;
  const amount = Math.max(C.minimumMovingBank, clamp(Math.abs(lateralSpeed) / C.steeringSpeed, 0, 1));
  const target = moving ? -Math.sign(lateralSpeed) * amount : 0;
  const response = moving ? C.leanInTime : C.leanOutTime;
  const next = bank + (target - bank) * (1 - Math.exp(-dt / response));
  return !moving && Math.abs(next) < .002 ? 0 : next;
}
