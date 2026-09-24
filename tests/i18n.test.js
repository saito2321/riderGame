import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Japanese UI covers every English key while keeping only the app name unchanged', async () => {
  const en = JSON.parse(await readFile(new URL('../locales/en.json', import.meta.url), 'utf8'));
  const ja = JSON.parse(await readFile(new URL('../locales/ja.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort());
  for (const key of ['title.lane', 'title.split', 'title.rush']) assert.equal(ja[key], en[key]);
  for (const [key, value] of Object.entries(en)) {
    const placeholders = value.match(/\{\w+\}/g) ?? [];
    assert.deepEqual((ja[key].match(/\{\w+\}/g) ?? []).sort(), placeholders.sort(), key);
  }
});
