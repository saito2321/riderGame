import { DEFAULT_MACHINE_ID, isMachineUnlocked, machineById } from '../machines.js';

const KEY = 'lsr.save.v3';
export const createDefaultSave = () => ({ schemaVersion: 3, bestScore: 0, bestDistance: 0, bestCombo: 0, tutorialCompleted: false, selectedMachine: DEFAULT_MACHINE_ID, adUnlockedMachines: [],
  settings: { sfx: true, haptics: true } });
export function mergeSave(target, saved) {
  if (saved.schemaVersion !== 3
    || !['bestScore','bestDistance','bestCombo'].every(k => Number.isSafeInteger(saved[k]) && saved[k] >= 0)
    || typeof saved.tutorialCompleted !== 'boolean'
    || !machineById(saved.selectedMachine)
    || !Array.isArray(saved.adUnlockedMachines)
    || saved.adUnlockedMachines.some(id => id === DEFAULT_MACHINE_ID || !machineById(id))
    || new Set(saved.adUnlockedMachines).size !== saved.adUnlockedMachines.length
    || !isMachineUnlocked(saved.selectedMachine, saved.bestScore, saved.adUnlockedMachines)
    || typeof saved.settings?.sfx !== 'boolean'
    || typeof saved.settings.haptics !== 'boolean') throw new Error('Invalid save');
  for (const k of ['bestScore','bestDistance','bestCombo']) target[k] = saved[k];
  target.tutorialCompleted = saved.tutorialCompleted;
  target.selectedMachine = saved.selectedMachine;
  target.adUnlockedMachines = [...saved.adUnlockedMachines];
  target.settings.sfx = saved.settings.sfx;
  target.settings.haptics = saved.settings.haptics;
  return target;
}
export class LocalAdapter {
  constructor(storage) { try { this.storage = storage ?? globalThis.localStorage; } catch {} this.data = createDefaultSave(); this.writable = true; this.saveFailed = false; this.lastSave = 0; this.dirty = false; }
  load() {
    try {
      const raw = this.storage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        mergeSave(this.data, saved);
      }
    } catch { this.writable = false; }
    return this.data;
  }
  record(sim) {
    for (const [key,value] of [['bestScore',sim.score],['bestDistance',sim.distance],['bestCombo',sim.bestCombo]]) {
      const next = Math.max(this.data[key], Math.floor(value));
      if (next !== this.data[key]) { this.data[key] = next; this.dirty = true; }
    }
  }
  save(force = false) {
    const now = Date.now();
    if (!this.writable || !this.dirty || (!force && now - this.lastSave < 1000)) return;
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
      this.lastSave = now; this.dirty = false; this.saveFailed = false;
    } catch { this.saveFailed = true; }
  }
  setSetting(key,value) { if (!(key in this.data.settings)) return; this.data.settings[key] = value; this.dirty = true; this.save(true); }
  setMachine(id) { if (!isMachineUnlocked(id,this.data.bestScore,this.data.adUnlockedMachines) || id === this.data.selectedMachine) return false; this.data.selectedMachine = id; this.dirty = true; this.save(true); return true; }
  unlockMachine(id) { if (!machineById(id) || id === DEFAULT_MACHINE_ID || isMachineUnlocked(id,this.data.bestScore,this.data.adUnlockedMachines)) return false; this.data.adUnlockedMachines.push(id); this.dirty = true; this.save(true); return true; }
  completeTutorial() { this.data.tutorialCompleted = true; this.dirty = true; this.save(true); }
  // No SDK, network, or ad provider. UI explicitly resolves this local test request.
  requestRevive() {
    if (this.pendingReward) return this.pendingReward.promise;
    let resolve; const promise = new Promise(r => { resolve = r; });
    this.pendingReward = { promise, resolve }; return promise;
  }
  resolveRevive(earned) { const pending = this.pendingReward; this.pendingReward = null; pending?.resolve(earned === true); }
  requestMachineUnlock() {
    if (this.pendingMachineReward) return this.pendingMachineReward.promise;
    let resolve; const promise = new Promise(r => { resolve = r; });
    this.pendingMachineReward = { promise, resolve }; return promise;
  }
  resolveMachineUnlock(earned) { const pending = this.pendingMachineReward; this.pendingMachineReward = null; pending?.resolve(earned === true); }
  onPause(callback) {
    const pause = () => callback();
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', () => this.save(true));
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); };
  }
}
