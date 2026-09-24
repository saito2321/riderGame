import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderQuality } from '../src/game/RenderQuality.js';

test('stable 60 fps increases rendering resolution up to the device and game cap', () => {
  const quality = new RenderQuality(3);
  assert.equal(quality.ratio, 1.5);
  for (let i = 0; i < 1200; i++) quality.observe(1 / 60);
  assert.equal(quality.ratio, 2);
  const native = new RenderQuality(1);
  for (let i = 0; i < 1200; i++) native.observe(1 / 60);
  assert.equal(native.ratio, 1);
});

test('sustained slow frames lower resolution and later recovery raises it again', () => {
  const quality = new RenderQuality(3);
  for (let i = 0; i < 300; i++) quality.observe(1 / 30);
  assert.equal(quality.ratio, .75);
  quality.observe(0);
  quality.observe(.5);
  assert.equal(quality.ratio, .75);
  for (let i = 0; i < 3000; i++) quality.observe(1 / 60);
  assert.equal(quality.ratio, 2);
});
