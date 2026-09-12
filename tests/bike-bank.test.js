import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/Simulation.js';
import {CONFIG as C} from '../src/game/config.js';
import {updateBikeBank} from '../src/game/BikeBank.js';

function ride(){const sim=new Simulation(1);sim.vehicles.forEach(v=>v.active=false);sim.spawnWave=()=>{};return sim;}
function step(sim, count, input){for(let i=0;i<count;i++)sim.step(C.step,input);}

test('short keyboard movements visibly bank during movement in both directions',()=>{
  for(const axis of [-1,1]){
    const sim=ride(),input={axis,target:0};step(sim,4,input);
    assert.equal(Math.sign(sim.x),axis);assert.equal(Math.sign(sim.bank),-axis);
    assert.ok(Math.abs(sim.bank*C.bikeLean)>.3,'at least 17 degrees after 33ms');
  }
});
test('slow drag visibly leans and its pose does not depend on the render rate',()=>{
  const run=renderStride=>{const sim=ride();for(let i=0;i<120;i++){sim.step(C.step,{axis:0,target:sim.x+.04});if(i%renderStride===0){const ignoredPose=sim.bank;assert.ok(Number.isFinite(ignoredPose));}}return {x:sim.x,bank:sim.bank};};
  assert.deepEqual(run(1),run(4));assert.ok(Math.abs(run(1).bank*C.bikeLean)>.3);
});
test('release returns to exactly upright without overshoot or recurring idle wobble',()=>{
  const sim=ride(),input={axis:1,target:0};step(sim,12,input);input.axis=0;
  let previous=Math.abs(sim.bank);for(let i=0;i<120;i++){sim.step(C.step,input);assert.ok(Math.abs(sim.bank)<=previous+1e-12);assert.ok(sim.bank<=0);previous=Math.abs(sim.bank);}
  assert.equal(sim.bank,0);sim.health=1;step(sim,600,input);assert.equal(sim.bank,0);
});
test('held input at road edge straightens instead of keeping a stationary bike leaned',()=>{
  const sim=ride();sim.x=C.edge;step(sim,120,{axis:1,target:C.edge});assert.equal(sim.bank,0);
});
test('micro drift is ignored and hit stop freezes the pose',()=>{
  assert.equal(updateBikeBank(0,.01,C.step),0);assert.equal(updateBikeBank(0,-.01,C.step),0);
  const sim=ride();step(sim,12,{axis:-1,target:0});const bank=sim.bank;sim.hitStop=.15;step(sim,10,{axis:1,target:0});assert.equal(sim.bank,bank);
});
test('retry and revive clear the old movement pose',()=>{
  const sim=ride();step(sim,12,{axis:1,target:0});assert.ok(sim.bank<0);sim.reset(1);assert.equal(sim.bank,0);
  sim.bank=.8;sim.dead=true;assert.ok(sim.revive());assert.equal(sim.bank,0);
});
