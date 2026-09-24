import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/Simulation.js';
import { CONFIG as C, VEHICLES } from '../src/game/config.js';
function empty(x=1.75){const s=new Simulation(12);s.vehicles.forEach(v=>v.active=false);s.spawnWave=()=>{};s.scheduleChange=()=>{};s.scheduleBrake=()=>{};s.x=x;return s;}
function advance(s,seconds){for(let i=0;i<Math.round(seconds/C.step);i++)s.step(C.step,{target:s.x,axis:0});}
const bikes=s=>s.vehicles.filter(v=>v.active&&v.type==='bike');
function pass(s,type='car',x=0){const length=VEHICLES[type]?.length??2.25;const v=s.spawnVehicle(type,x,-(length+C.bikeLength)/2-.1);while(v.active&&v.z<=(length+C.bikeLength)/2+.1&&!s.dead)s.step(C.step,{target:s.x,axis:0});v.active=false;}

test('waiting never spawns; the third full adjacent pass spawns on either gap',()=>{
  for(const x of [-1.75,1.75]){const s=empty(x);advance(s,12);assert.equal(bikes(s).length,0);
    pass(s);assert.equal(s.gapPassCount,1);advance(s,4);pass(s);assert.equal(s.gapPassCount,2);assert.equal(bikes(s).length,0);
    pass(s);assert.equal(bikes(s).length,1);assert.equal(bikes(s)[0].x,x);
  }
});
test('leaving or switching gaps resets consecutive passes; waiting does not',()=>{
  const s=empty();pass(s);pass(s);s.x=0;advance(s,.1);assert.equal(s.gapPassCount,0);
  s.x=1.75;pass(s);s.x=-1.75;advance(s,.1);assert.equal(s.gapPassCount,0);pass(s);assert.equal(bikes(s).length,0);
});
test('both adjacent lanes count, distant lane and motorcycles do not',()=>{
  const s=empty();pass(s,'car',-3.5);assert.equal(s.gapPassCount,0);
  pass(s,'bike',0);assert.equal(s.gapPassCount,0);
  pass(s,'car',3.5);pass(s,'car',0);assert.equal(s.gapPassCount,2);
  advance(s,3);assert.equal(s.gapPassCount,2);assert.equal(bikes(s).length,0);
});
test('truck pass counts without requiring a near-miss and collisions reset streak',()=>{
  const s=empty();pass(s,'truck');assert.equal(s.gapPassCount,1);
  pass(s,'car',1.75);assert.equal(s.gapPassCount,0);
});
test('late entry beside a vehicle does not count as a complete pass',()=>{
  const s=empty();s.spawnVehicle('car',0,0);advance(s,1);assert.equal(s.gapPassCount,0);
});
test('blocked spawn remains pending and reset/revive clear the streak',()=>{
  const s=empty();pass(s);pass(s);const blocker=s.spawnVehicle('car',1.75,-55);pass(s);assert.equal(bikes(s).length,0);assert.equal(s.gapPassCount,3);
  blocker.active=false;advance(s,.3);assert.equal(bikes(s).length,1);
  s.dead=true;assert.ok(s.revive());assert.equal(s.gapPassCount,0);s.reset(12);assert.equal(s.gapPassCount,0);
});
test('remaining in the gap after the third pass eventually collides with the motorcycle',()=>{
  const s=empty();pass(s);pass(s);pass(s);advance(s,12);assert.ok(s.health<C.health);
});
