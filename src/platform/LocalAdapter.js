const KEY = 'lsr.save.v1';
export const createDefaultSave = () => ({ schemaVersion: 1, bestScore: 0, bestDistance: 0, bestCombo: 0, tutorialCompleted: false,
  settings: { sfx: true } });
export function mergeSave(target, saved) {
  if (saved.schemaVersion !== 1 || !['bestScore','bestDistance','bestCombo'].every(k => Number.isSafeInteger(saved[k]) && saved[k] >= 0)) throw new Error('Invalid save');
  for (const k of ['bestScore','bestDistance','bestCombo']) target[k] = saved[k];
  target.tutorialCompleted = saved.tutorialCompleted === true;
  for (const k of Object.keys(target.settings)) if (typeof saved.settings?.[k] === 'boolean') target.settings[k] = saved.settings[k];
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
      } else {
        const oldScore = Number(this.storage.getItem('lsr.bestScore'));
        if (Number.isSafeInteger(oldScore) && oldScore >= 0) this.data.bestScore = oldScore;
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
      this.storage.setItem('lsr.bestScore', String(this.data.bestScore));
      this.lastSave = now; this.dirty = false; this.saveFailed = false;
    } catch { this.saveFailed = true; }
  }
  setSetting(key,value) { if (!(key in this.data.settings)) return; this.data.settings[key] = value; this.dirty = true; this.save(true); }
  completeTutorial() { this.data.tutorialCompleted = true; this.dirty = true; this.save(true); }
  // No SDK, network, or ad provider. UI explicitly resolves this local test request.
  requestRevive() {
    if (this.pendingReward) return this.pendingReward.promise;
    let resolve; const promise = new Promise(r => { resolve = r; });
    this.pendingReward = { promise, resolve }; return promise;
  }
  resolveRevive(earned) { const pending = this.pendingReward; this.pendingReward = null; pending?.resolve(earned === true); }
  onPause(callback) {
    const pause = () => callback();
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', () => this.save(true));
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); };
  }
}
