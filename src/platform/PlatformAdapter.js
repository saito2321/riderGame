import { LocalAdapter, createDefaultSave, mergeSave } from './LocalAdapter.js';
import { DEFAULT_MACHINE_ID, isMachineUnlocked, machineById } from '../machines.js';

const REVIVE_REWARD_ID = 'revive-one-health';
const RETRY_DELAYS = [1, 2, 4];

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
    this.activeTime = 0;
    this.dirtySince = 0;
    this.lastChange = 0;
    this.paused = false;
    this.pendingLoad = null;
    this.pendingSave = null;
    this.pendingScore = null;
    this.loadRetryAt = null;
    this.saveRetryAt = null;
    this.scoreRetryAt = null;
    this.loadRetries = 0;
    this.saveRetries = 0;
    this.scoreRetries = 0;
    this.flushAfterPending = false;
    this.changedSettings = new Set();
    this.machineChanged = false;
    this.savedBestScore = 0;
    this.lastSentScore = 0;
    this.recoveryListener = null;
    this.recoveryNotificationPending = false;
    this.pendingReward = null;
    this.pendingMachineReward = null;
    this.pendingAd = null;
  }
  get writable() { return this.local ? this.local.writable : this.cloudWritable; }
  get saveFailed() { return this.local ? this.local.saveFailed : this.cloudSaveFailed; }
  setRecoveryListener(callback) {
    this.recoveryListener = callback;
    this.notifyRecovery();
  }
  notifyRecovery() {
    if (this.paused || !this.recoveryNotificationPending || !this.recoveryListener) return;
    this.recoveryNotificationPending = false;
    try { this.recoveryListener(this.savedBestScore); }
    catch (error) { console.error(error); }
  }
  scheduleRetry(kind) {
    const countKey = `${kind}Retries`, atKey = `${kind}RetryAt`;
    this[atKey] = this[countKey] < RETRY_DELAYS.length ? this.activeTime + RETRY_DELAYS[this[countKey]++] : Infinity;
  }
  markDirty() {
    if (!this.dirty) this.dirtySince = this.activeTime;
    this.dirty = true;
    this.lastChange = this.activeTime;
    if (this.saveRetryAt === Infinity) { this.saveRetries = 0; this.saveRetryAt = null; }
  }
  load() {
    if (this.local) { this.data = this.local.load(); return this.data; }
    if (this.pendingLoad) return this.pendingLoad;
    const recovering = !this.cloudWritable;
    const request = Promise.resolve().then(() => this.sdk.game.loadData()).then(raw => {
      const cloud = createDefaultSave();
      if (raw) mergeSave(cloud, JSON.parse(raw));
      for (const key of ['bestScore', 'bestDistance', 'bestCombo']) this.data[key] = Math.max(this.data[key], cloud[key]);
      this.data.tutorialCompleted ||= cloud.tutorialCompleted;
      this.data.adUnlockedMachines = [...new Set([...this.data.adUnlockedMachines, ...cloud.adUnlockedMachines])];
      for (const key of Object.keys(cloud.settings)) if (!this.changedSettings.has(key)) this.data.settings[key] = cloud.settings[key];
      if (!this.machineChanged) this.data.selectedMachine = cloud.selectedMachine;
      if (!isMachineUnlocked(this.data.selectedMachine, this.data.bestScore, this.data.adUnlockedMachines)) this.data.selectedMachine = cloud.selectedMachine;
      if (JSON.stringify(this.data) !== JSON.stringify(cloud)) this.markDirty();
      this.savedBestScore = cloud.bestScore;
      this.loaded = true;
      this.cloudWritable = true;
      this.cloudSaveFailed = false;
      this.loadRetries = 0;
      this.loadRetryAt = null;
      this.scoreRetries = 0;
      this.scoreRetryAt = null;
      if (recovering) { this.recoveryNotificationPending = true; this.notifyRecovery(); }
      if (!this.paused) this.sendBestScore();
      return this.data;
    }).catch(() => {
      this.cloudWritable = false;
      this.cloudSaveFailed = true;
      this.scheduleRetry('load');
      return this.data;
    }).finally(() => { this.pendingLoad = null; });
    this.pendingLoad = request;
    return request;
  }
  record(sim) {
    if (this.local) return this.local.record(sim);
    for (const [key,value] of [['bestScore',sim.score],['bestDistance',sim.distance],['bestCombo',sim.bestCombo]]) {
      const next = Math.max(this.data[key], Math.floor(value));
      if (next !== this.data[key]) { this.data[key] = next; this.markDirty(); }
    }
  }
  sendBestScore() {
    if (this.local || !this.loaded || this.paused || this.pendingScore || !this.savedBestScore || this.savedBestScore <= this.lastSentScore || typeof this.sdk.engagement?.sendScore !== 'function') return this.pendingScore ?? Promise.resolve();
    const score = this.savedBestScore;
    let failed = false;
    const request = Promise.resolve().then(() => this.sdk.engagement.sendScore({ value: score })).then(() => {
      this.lastSentScore = Math.max(this.lastSentScore, score);
      this.scoreRetries = 0;
      this.scoreRetryAt = null;
    }).catch(() => {
      failed = true;
      this.scheduleRetry('score');
    }).finally(() => {
      this.pendingScore = null;
      if (!failed && !this.paused && this.savedBestScore > this.lastSentScore) this.sendBestScore();
    });
    this.pendingScore = request;
    return request;
  }
  save(force = false) {
    if (this.local) return this.local.save(force);
    if (!this.loaded || !this.cloudWritable) return this.pendingSave ?? Promise.resolve();
    if (this.pendingSave) { if (force) this.flushAfterPending = true; return this.pendingSave; }
    if (!this.dirty || (!force && (this.saveRetryAt !== null || this.activeTime - this.lastChange < .5 && this.activeTime - this.dirtySince < 5))) return Promise.resolve();
    const serialized = JSON.stringify(this.data);
    const savedBestScore = this.data.bestScore;
    this.dirty = false;
    this.flushAfterPending = false;
    let failed = false;
    const request = Promise.resolve().then(() => this.sdk.game.saveData(serialized)).then(() => {
      this.cloudSaveFailed = false;
      this.savedBestScore = Math.max(this.savedBestScore, savedBestScore);
      this.saveRetries = 0;
      this.saveRetryAt = null;
      this.scoreRetries = 0;
      this.scoreRetryAt = null;
      if (!this.paused) this.sendBestScore();
    }).catch(() => {
      failed = true;
      this.cloudSaveFailed = true;
      this.markDirty();
      this.scheduleRetry('save');
    }).finally(() => {
      this.pendingSave = null;
      if (this.dirty && !failed && !this.paused) this.save(true);
    });
    this.pendingSave = request;
    return request;
  }
  update(dt) {
    if (this.local || this.paused) return;
    this.activeTime += Math.max(0, dt);
    if (!this.loaded) {
      if (!this.pendingLoad && this.loadRetryAt !== null && this.activeTime >= this.loadRetryAt) this.load();
      return;
    }
    if (this.dirty && !this.pendingSave) {
      if (this.saveRetryAt !== null) { if (this.activeTime >= this.saveRetryAt) this.save(true); }
      else this.save(false);
    }
    if (!this.pendingScore && this.scoreRetryAt !== null && this.activeTime >= this.scoreRetryAt) this.sendBestScore();
  }
  setPaused(paused) {
    if (this.local || this.paused === paused) return;
    this.paused = paused;
    if (!paused) {
      this.notifyRecovery();
      if (!this.loaded && this.loadRetryAt !== null) this.loadRetryAt = this.activeTime;
      if (this.saveRetryAt !== null) { this.saveRetries = 0; this.saveRetryAt = this.activeTime; }
      if (this.scoreRetryAt !== null) { this.scoreRetries = 0; this.scoreRetryAt = this.activeTime; }
      if (this.flushAfterPending && this.dirty && !this.pendingSave) this.save(true);
      this.update(0);
      if (this.loaded && this.savedBestScore > this.lastSentScore) this.sendBestScore();
    }
  }
  setSetting(key, value) {
    if (this.local) return this.local.setSetting(key, value);
    if (!(key in this.data.settings) || this.data.settings[key] === value) return;
    this.data.settings[key] = value; this.changedSettings.add(key); this.markDirty();
  }
  setMachine(id) {
    if (this.local) return this.local.setMachine(id);
    if (!isMachineUnlocked(id,this.data.bestScore,this.data.adUnlockedMachines) || id === this.data.selectedMachine) return false;
    this.data.selectedMachine = id; this.machineChanged = true; this.markDirty(); return true;
  }
  unlockMachine(id) {
    if (this.local) return this.local.unlockMachine(id);
    if (!machineById(id) || id === DEFAULT_MACHINE_ID || isMachineUnlocked(id,this.data.bestScore,this.data.adUnlockedMachines)) return false;
    this.data.adUnlockedMachines.push(id); this.markDirty(); return true;
  }
  completeTutorial() {
    if (this.local) return this.local.completeTutorial();
    if (!this.data.tutorialCompleted) { this.data.tutorialCompleted = true; this.markDirty(); }
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
  requestMachineUnlock(id) {
    if (!machineById(id) || id === DEFAULT_MACHINE_ID || isMachineUnlocked(id,this.data.bestScore,this.data.adUnlockedMachines)) return Promise.resolve(false);
    if (this.local) return this.local.requestMachineUnlock();
    if (this.pendingMachineReward) return Promise.resolve(false);
    const wait = this.pendingAd ?? Promise.resolve();
    const request = wait.catch(() => {}).then(() => this.sdk.ads.requestRewardedAd(`unlock-${id}`)).then(value => value === true).catch(() => false).finally(() => {
      this.pendingMachineReward = null;
      if (this.pendingAd === request) this.pendingAd = null;
    });
    this.pendingMachineReward = request;
    this.pendingAd = request;
    return request;
  }
  resolveMachineUnlock(earned) { this.local?.resolveMachineUnlock(earned); }
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
  async getLanguage(search = globalThis.location?.search ?? '') {
    if (!this.isPlayables) return new URLSearchParams(search).get('lang') === 'ja' ? 'ja' : 'en';
    let timeout;
    try {
      const tag = await Promise.race([
        this.sdk.system.getLanguage(),
        new Promise(resolve => { timeout = setTimeout(() => resolve('en'), 1200); }),
      ]);
      return typeof tag === 'string' && /^ja(?:-|$)/i.test(tag) ? 'ja' : 'en';
    } catch { return 'en'; }
    finally { clearTimeout(timeout); }
  }
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
    return this.local.onPause(pause, resume);
  }
}
