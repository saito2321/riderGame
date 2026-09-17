import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/Simulation.js';
import { CONFIG as C, signalEvery } from '../src/game/config.js';

test('normal and maximum difficulty reserve every tenth and third vehicle',()=>{
 for(const [score,every] of [[0,10],[15000,7],[35000,3],[100000,3]]){
  assert.equal(signalEvery(score),every);
  const s=new Simulation(12);s.vehicles.forEach(v=>v.active=false);s.unsignaledTraffic=0;s.score=score;s.random=()=>.5;
  for(let n=1;n<=30;n++){
   s.spawnWave();const v=s.vehicles.find(v=>v.active);assert.ok(v);
   assert.equal(v.change==='queued',n%every===0);v.active=false;
  }
 }
 assert.equal(C.trafficDensity,1);
});
test('a second vehicle in a wave cannot occupy a reserved lane-change corridor',()=>{
 const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.score=35000;s.distance=4000;s.unsignaledTraffic=2;s.random=()=>0;
 s.spawnWave();const planned=s.vehicles.find(v=>v.active&&v.change==='queued');assert.ok(planned);
 assert.equal(s.changeTrafficIsClear(planned,planned.toX),true);
});
test('quota survives a blocked spawn instead of quietly becoming a straight vehicle',()=>{
 const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.unsignaledTraffic=9;
 const original=s.hasSafePath;s.hasSafePath=()=>false;s.spawnWave();assert.equal(s.unsignaledTraffic,9);assert.equal(s.vehicles.filter(v=>v.active).length,0);
 s.hasSafePath=original;s.spawnWave();assert.ok(s.vehicles.some(v=>v.active&&v.change==='queued'));
});
test('lane change begins before the player passes at 150 and 300 km/h',()=>{
 for(const kmh of [150,300]){
  const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.coins.clear();
  s.x=3.5;s.distance=(kmh-60)/5*C.distanceStep;s.baseSpeed=kmh/3.6;s.speed=s.baseSpeed;
  s.unsignaledTraffic=signalEvery(0)-1;s.random=()=>0;s.spawnWave();
  const car=s.vehicles.find(v=>v.active&&v.change==='queued');assert.ok(car,`${kmh} km/h: planned car`);
  s.spawnWave=()=>{};
  for(let i=0;i<120*10&&car.change!=='changing';i++)s.step(C.step,{target:s.x,axis:0});
  assert.equal(car.change,'changing',`${kmh} km/h: change starts`);
  assert.ok(car.z < -35,`${kmh} km/h: change starts at z=${car.z}`);
  for(let i=0;i<120*5&&car.z<0;i++)s.step(C.step,{target:s.x,axis:0});
  assert.ok(car.x>car.fromX+1.75,`${kmh} km/h: car has crossed half a lane before passing`);
 }
});
test('reserved signals actually start and finish over multiple seeded full runs',()=>{
 for(const score of [0,35000])for(const seed of [1,7,12]){
  const s=new Simulation(seed);s.invincible=10000;let started=0,cancelled=0;
  const original=s.updateVehicle.bind(s);s.updateVehicle=(v,dt)=>{const before=v.change;original(v,dt);if(before==='signaling'&&v.change==='straight')cancelled++;};
  const seen=new Set();
  for(let i=0;i<120*180;i++){
   s.score=score;s.step(C.step,{target:-1.75,axis:0});
   for(const v of s.vehicles)if(v.active&&v.changeUsed&&!seen.has(v.id)){seen.add(v.id);started++;}
  }
  assert.ok(started>=4,`score ${score}, seed ${seed}: ${started} signals`);assert.equal(cancelled,0);
 }
});
