import { LocalAdapter, createDefaultSave, mergeSave } from './LocalAdapter.js';
import { isMachineUnlocked } from '../machines.js';

const REVIVE_REWARD_ID = 'revive-one-health';

export class PlatformAdapter {
  constructor({ sdk = globalThis.ytgame, storage } = {}) {
    this.sdk = sdk;
    this.isPlayables = typeof sdk !== 'undefined' && sdk?.IN_PLAYABLES_ENV === true;
    this.local = this.isPlayables ? null : new LocalAdapter(storage);
    this.data = this.local?.data ?? createDefaultSave();
    this.cloudWritable = true;
    this.cloudSaveFailed = false;
    this.loaded = false;
    this.dirty = false;
    this.lastSave = 0;
    this.pendingSave = null;
    this.pendingReward = null;
    this.pendingAd = null;
    this.lastScoreAttempt = 0;
  }
  get writable() { return this.local ? this.local.writable : this.cloudWritable; }
  get saveFailed() { return this.local ? this.local.saveFailed : this.cloudSaveFailed; }
  async load() {
    if (this.local) { this.data = this.local.load(); return this.data; }
    try {
      const raw = await this.sdk.game.loadData();
      if (raw) mergeSave(this.data, JSON.parse(raw));
      this.loaded = true;
    } catch {
      this.cloudWritable = false;
      this.cloudSaveFailed = true;
    }
    return this.data;
  }
  record(sim) {
    if (this.local) return this.local.record(sim);
    for (const [key,value] of [['bestScore',sim.score],['bestDistance',sim.distance],['bestCombo',sim.bestCombo]]) {
      const next = Math.max(this.data[key], Math.floor(value));
      if (next !== this.data[key]) { this.data[key] = next; this.dirty = true; }
    }
  }
  sendBestScore(score = this.data.bestScore) {
    if (!score || score <= this.lastScoreAttempt || typeof this.sdk.engagement?.sendScore !== 'function') return;
    this.lastScoreAttempt = score;
    try { Promise.resolve(this.sdk.engagement.sendScore({ value: score })).catch(() => { if (this.lastScoreAttempt === score) this.lastScoreAttempt = 0; }); }
    catch { this.lastScoreAttempt = 0; }
  }
  save(force = false) {
    if (this.local) return this.local.save(force);
    const now = Date.now();
    if (!this.loaded || !this.cloudWritable) return this.pendingSave ?? Promise.resolve();
    if (!this.dirty || (!force && now - this.lastSave < 1000)) return this.pendingSave ?? Promise.resolve();
    if (this.pendingSave) return this.pendingSave;
    const serialized = JSON.stringify(this.data);
    const savedBestScore = this.data.bestScore;
    this.dirty = false;
    this.lastSave = now;
    let failed = false;
    const request = Promise.resolve().then(() => this.sdk.game.saveData(serialized)).then(() => {
      this.cloudSaveFailed = false;
      this.sendBestScore(savedBestScore);
    }).catch(() => {
      failed = true;
      this.cloudSaveFailed = true;
      this.dirty = true;
    }).finally(() => {
      this.pendingSave = null;
      if (this.dirty && !failed) this.save(true);
    });
    this.pendingSave = request;
    return request;
  }
  setSetting(key, value) {
    if (this.local) return this.local.setSetting(key, value);
    if (!(key in this.data.settings)) return;
    this.data.settings[key] = value; this.dirty = true; this.save(true);
  }
  setMachine(id) {
    if (this.local) return this.local.setMachine(id);
    if (!isMachineUnlocked(id,this.data.bestScore) || id === this.data.selectedMachine) return false;
    this.data.selectedMachine = id; this.dirty = true; this.save(true); return true;
  }
  completeTutorial() {
    if (this.local) return this.local.completeTutorial();
    this.data.tutorialCompleted = true; this.dirty = true; this.save(true);
  }
  requestRevive() {
    if (this.local) return this.local.requestRevive();
    if (this.pendingReward) return this.pendingReward;
    const wait = this.pendingAd ?? Promise.resolve();
    const request = wait.catch(() => {}).then(() => this.sdk.ads.requestRewardedAd(REVIVE_REWARD_ID)).then(value => value === true).catch(() => false).finally(() => {
      this.pendingReward = null;
      if (this.pendingAd === request) this.pendingAd = null;
    });
    this.pendingReward = request;
    this.pendingAd = request;
    return request;
  }
  resolveRevive(earned) { this.local?.resolveRevive(earned); }
  requestInterstitial() {
    if (!this.isPlayables || this.pendingAd) return Promise.resolve(false);
    const request = Promise.resolve().then(() => this.sdk.ads.requestInterstitialAd()).then(() => true).catch(() => false).finally(() => {
      if (this.pendingAd === request) this.pendingAd = null;
    });
    this.pendingAd = request;
    return request;
  }
  firstFrameReady() { if (this.isPlayables) this.sdk.game.firstFrameReady(); }
  gameReady() { if (this.isPlayables) this.sdk.game.gameReady(); }
  isAudioEnabled() { return this.isPlayables ? this.sdk.system.isAudioEnabled() : true; }
  onAudioEnabledChange(callback) {
    return this.isPlayables ? this.sdk.system.onAudioEnabledChange(callback) : () => {};
  }
  onPause(pause, resume) {
    if (this.isPlayables) {
      const offPause = this.sdk.system.onPause(pause);
      const offResume = this.sdk.system.onResume(resume);
      return () => { offPause?.(); offResume?.(); };
    }
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', () => this.save(true));
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); };
  }
}
