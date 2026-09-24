import test from 'node:test';
import assert from 'node:assert/strict';
import { PlatformAdapter } from '../src/platform/PlatformAdapter.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const saved = (bestScore, extras = {}) => JSON.stringify({
  schemaVersion: 3, bestScore, bestDistance: 0, bestCombo: 0,
  tutorialCompleted: false, selectedMachine: 'street', adUnlockedMachines: [],
  settings: { sfx: true, haptics: true }, ...extras,
});
const sdkWith = ({ loadData = async () => '', saveData = async () => {}, sendScore = async () => {} } = {}) => ({
  IN_PLAYABLES_ENV: true,
  game: { loadData, saveData },
  engagement: { sendScore },
  ads: {}, system: {},
});

test('YouTube language selects Japanese only for ja locale tags and falls back to English', async () => {
  const sdk = sdkWith();
  const platform = new PlatformAdapter({ sdk });
  for (const [tag, expected] of [['ja', 'ja'], ['ja-JP', 'ja'], ['en-US', 'en'], ['fr-FR', 'en']]) {
    sdk.system.getLanguage = async () => tag;
    assert.equal(await platform.getLanguage(), expected);
  }
  sdk.system.getLanguage = async () => { throw Error('unavailable'); };
  assert.equal(await platform.getLanguage(), 'en');
  const local = new PlatformAdapter({ sdk: { IN_PLAYABLES_ENV: false }, storage: { getItem: () => null } });
  assert.equal(await local.getLanguage('?lang=ja'), 'ja');
  assert.equal(await local.getLanguage('?lang=en'), 'en');
});

test('failed load retries, merges session progress, and saves only after cloud data is known', async () => {
  let reads = 0; const writes = [], scores = [];
  const sdk = sdkWith({
    loadData: async () => { if (++reads === 1) throw Error('offline'); return saved(400, { bestDistance: 90, bestCombo: 7, settings: { sfx: true, haptics: false } }); },
    saveData: async data => writes.push(JSON.parse(data)),
    sendScore: async ({ value }) => scores.push(value),
  });
  const p = new PlatformAdapter({ sdk });
  await p.load();
  const recovered = []; p.setRecoveryListener(score => recovered.push(score));
  p.record({ score: 500, distance: 20, bestCombo: 2 });
  p.setSetting('sfx', false); p.completeTutorial();
  await p.save(true);
  assert.equal(reads, 1); assert.equal(writes.length, 0);
  p.update(.99); await flush(); assert.equal(reads, 1);
  p.update(.01); await flush();
  assert.equal(reads, 2); assert.equal(p.writable, true);
  assert.deepEqual(recovered, [400]);
  assert.deepEqual([p.data.bestScore, p.data.bestDistance, p.data.bestCombo], [500, 90, 7]);
  assert.deepEqual(p.data.settings, { sfx: false, haptics: false });
  assert.equal(p.data.tutorialCompleted, true);
  p.update(.5); await flush();
  assert.equal(writes.length, 1); assert.equal(writes[0].bestScore, 500);
  assert.deepEqual(scores, [400, 500]);
});

test('save debounces changes, flushes by five seconds, and serializes newer snapshots', async () => {
  const writes = []; let finishFirst;
  const p = new PlatformAdapter({ sdk: sdkWith({
    saveData: data => { writes.push(JSON.parse(data)); return writes.length === 1 ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve(); },
  }) });
  await p.load();
  p.record({ score: 10, distance: 10, bestCombo: 1 });
  p.update(.4); await flush(); assert.equal(writes.length, 0);
  p.record({ score: 20, distance: 20, bestCombo: 1 });
  p.update(.4); await flush(); assert.equal(writes.length, 0);
  p.update(.1); await flush(); assert.equal(writes.length, 1);
  p.record({ score: 30, distance: 30, bestCombo: 1 });
  p.save(true);
  assert.equal(writes.length, 1);
  finishFirst(); await flush();
  assert.deepEqual(writes.map(write => write.bestScore), [20, 30]);
});

test('continuous progress flushes at five seconds even without a quiet half second', async () => {
  const writes = [];
  const p = new PlatformAdapter({ sdk: sdkWith({ saveData: async data => writes.push(JSON.parse(data)) }) });
  await p.load();
  for (let i = 1; i <= 11; i++) {
    p.record({ score: i, distance: i, bestCombo: 0 });
    p.update(.49);
    await flush();
  }
  assert.ok(writes.length >= 1);
  assert.ok(writes[0].bestScore >= 10);
});

test('save retries at 1, 2, and 4 active seconds, pauses, then retries on resume', async () => {
  let attempts = 0;
  const p = new PlatformAdapter({ sdk: sdkWith({ saveData: async () => { attempts++; if (attempts <= 4) throw Error('offline'); } }) });
  await p.load(); p.record({ score: 50, distance: 3, bestCombo: 1 });
  await p.save(true); assert.equal(attempts, 1); assert.equal(p.dirty, true);
  p.update(.99); await flush(); assert.equal(attempts, 1);
  p.update(.01); await flush(); assert.equal(attempts, 2);
  p.update(1.99); await flush(); assert.equal(attempts, 2);
  p.update(.01); await flush(); assert.equal(attempts, 3);
  p.update(4); await flush(); assert.equal(attempts, 4);
  p.setPaused(true); p.update(10); await flush(); assert.equal(attempts, 4);
  p.update(20); await flush(); assert.equal(attempts, 4);
  p.setPaused(true); p.setPaused(false); await flush();
  assert.equal(attempts, 5); assert.equal(p.dirty, false); assert.equal(p.saveFailed, false);
});

test('startup score sync retries and uses the latest successfully saved score', async () => {
  const scores = []; let fail = true;
  const p = new PlatformAdapter({ sdk: sdkWith({
    loadData: async () => saved(80),
    sendScore: async ({ value }) => { scores.push(value); if (fail) throw Error('offline'); },
  }) });
  await p.load(); await flush(); assert.deepEqual(scores, [80]);
  p.setPaused(true); p.update(10); await flush(); assert.deepEqual(scores, [80]);
  p.record({ score: 125, distance: 1, bestCombo: 0 });
  await p.save(true); fail = false;
  p.setPaused(false); await flush();
  assert.deepEqual(scores, [80, 125]); assert.equal(p.lastSentScore, 125);
});

test('corrupt cloud data is never replaced with session defaults', async () => {
  let writes = 0;
  const p = new PlatformAdapter({ sdk: sdkWith({
    loadData: async () => '{broken',
    saveData: async () => { writes++; },
  }) });
  await p.load();
  p.record({ score: 300, distance: 12, bestCombo: 2 });
  await p.save(true);
  p.update(7); await flush();
  assert.equal(p.writable, false); assert.equal(writes, 0);
  assert.equal(p.data.bestScore, 300);
});

test('a completed save during pause records its result without starting the next save', async () => {
  const writes = []; let finishFirst;
  const p = new PlatformAdapter({ sdk: sdkWith({
    saveData: data => { writes.push(JSON.parse(data).bestScore); return writes.length === 1 ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve(); },
  }) });
  await p.load(); p.record({ score: 10, distance: 1, bestCombo: 0 });
  p.save(true); await flush();
  p.record({ score: 20, distance: 2, bestCombo: 0 });
  p.save(true); p.setPaused(true);
  finishFirst(); await flush();
  assert.deepEqual(writes, [10]);
  p.setPaused(false); await flush();
  assert.deepEqual(writes, [10, 20]);
});

test('a load completed during pause updates the UI only after resume', async () => {
  let reads = 0; let finishLoad;
  const p = new PlatformAdapter({ sdk: sdkWith({
    loadData: () => ++reads === 1 ? Promise.reject(Error('offline')) : new Promise(resolve => { finishLoad = resolve; }),
  }) });
  const notifications = []; p.setRecoveryListener(score => notifications.push(score));
  await p.load(); p.update(1); await flush();
  p.setPaused(true); finishLoad(saved(40)); await flush();
  assert.equal(p.data.bestScore, 40); assert.deepEqual(notifications, []);
  p.setPaused(false); await flush(); assert.deepEqual(notifications, [40]);
});

test('rewarded machine unlock needs a true result and survives cloud recovery', async () => {
  let reads = 0; const writes = [], requested = [];
  const sdk = sdkWith({
    loadData: async () => { if (++reads === 1) throw Error('offline'); return saved(0, { adUnlockedMachines: ['scooter'] }); },
    saveData: async data => writes.push(JSON.parse(data)),
  });
  sdk.ads.requestRewardedAd = async id => { requested.push(id); return requested.length === 2; };
  const p = new PlatformAdapter({ sdk });
  await p.load();
  assert.equal(await p.requestMachineUnlock('horse'), false);
  assert.deepEqual(p.data.adUnlockedMachines, []);
  assert.equal(await p.requestMachineUnlock('horse'), true);
  assert.equal(p.unlockMachine('horse'), true);
  assert.equal(p.setMachine('horse'), true);
  assert.deepEqual(requested, ['unlock-horse', 'unlock-horse']);
  assert.equal(writes.length, 0);
  p.update(1); await flush();
  assert.deepEqual(p.data.adUnlockedMachines, ['horse', 'scooter']);
  assert.equal(p.data.selectedMachine, 'horse');
  await p.save(true);
  assert.deepEqual(writes.at(-1).adUnlockedMachines, ['horse', 'scooter']);
});

test('one pending rewarded ad cannot satisfy another machine unlock', async () => {
  let finishAd; const requested = [];
  const sdk = sdkWith();
  sdk.ads.requestRewardedAd = id => {
    requested.push(id);
    return new Promise(resolve => { finishAd = resolve; });
  };
  const p = new PlatformAdapter({ sdk });
  const first = p.requestMachineUnlock('horse');
  assert.equal(await p.requestMachineUnlock('robovac'), false);
  await flush();
  assert.deepEqual(requested, ['unlock-horse']);
  finishAd(true);
  assert.equal(await first, true);
  assert.equal(p.pendingMachineReward, null);
  const second = p.requestMachineUnlock('robovac');
  await flush();
  assert.deepEqual(requested, ['unlock-horse', 'unlock-robovac']);
  finishAd(false);
  assert.equal(await second, false);
});
