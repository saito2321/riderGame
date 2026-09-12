import { CONFIG as C, clamp } from './config.js';

// Unit bank angle, updated alongside steering at 120 Hz, never from render snapshots.
export function updateBikeBank(bank, lateralSpeed, dt, previousLateralSpeed = lateralSpeed) {
  if (dt <= 0) return bank;
  const moving = Math.abs(lateralSpeed) > C.leanSpeedDeadzone;
  const slowing = lateralSpeed * previousLateralSpeed > 0 &&
    Math.abs(lateralSpeed) < Math.abs(previousLateralSpeed) - 1e-6;
  // Keep slow steering visible, but let the bank pass through that minimum on return.
  const amount = Math.max(slowing ? 0 : C.minimumMovingBank, clamp(Math.abs(lateralSpeed) / C.steeringSpeed, 0, 1));
  const target = moving ? -Math.sign(lateralSpeed) * amount : 0;
  const response = moving && !slowing ? C.leanInTime : C.leanOutTime;
  const next = bank + (target - bank) * (1 - Math.exp(-dt / response));
  return !moving && Math.abs(next) < .002 ? 0 : next;
}
