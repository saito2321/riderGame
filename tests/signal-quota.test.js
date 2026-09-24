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
test('two-lane changes unlock only after 10,000 points and cross both lanes',()=>{
 for(const score of [9999,10000,10001]){
  const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);
  s.score=score;s.unsignaledTraffic=signalEvery(score)-1;s.random=()=>0;
  s.spawnWave();
  const car=s.vehicles.find(v=>v.active&&v.change==='queued');assert.ok(car);
  assert.equal(car.x,-3.5);
  assert.equal(car.toX,score>10000?3.5:0);
  if(score<=10000)continue;
  car.z=car.signalZ;s.scheduleChange(C.step);
  assert.equal(car.change,'signaling');
  for(let i=0;i<Math.ceil((car.warning+1)/C.step);i++)s.updateVehicle(car,C.step);
  assert.equal(car.change,'changing');
  assert.ok(Math.abs(car.x)<.05,`midway: ${car.x}`);
  for(let i=0;i<Math.ceil(1/C.step)+2;i++)s.updateVehicle(car,C.step);
  assert.equal(car.change,'straight');assert.equal(car.x,3.5);
 }
});
test('lane change begins before the player passes at 150 and 300 km/h',()=>{
 for(const kmh of [150,300]){
  const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.coins.clear();
  s.x=3.5;s.distance=(kmh-80)/5*C.distanceStep;s.baseSpeed=kmh/3.6;s.speed=s.baseSpeed;
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
test('two-lane cars finish changing before collider contact at high speeds',()=>{
 for(const kmh of [300,400,600,999]){
  const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.coins.clear();
  s.x=0;s.distance=(kmh-80)/5*C.distanceStep;s.baseSpeed=kmh/3.6;s.speed=s.baseSpeed;
  s.score=35000;s.unsignaledTraffic=signalEvery(s.score)-1;s.random=()=>0;s.spawnWave();
  const car=s.vehicles.find(v=>v.active&&v.change==='queued');assert.ok(car,`${kmh} km/h: planned car`);
  assert.equal(Math.abs(car.toX-car.fromX),2*C.laneWidth);
  s.spawnWave=()=>{};s.combo=20;s.lastNear=Infinity;s.turbo=C.maxTurbo;
  let completedAt=null,contactAt=null;
  for(let i=0;i<120*12;i++){
   const before=car.change;s.step(C.step,{target:0,axis:0});
   if(before==='changing'&&car.change==='straight')completedAt=car.z;
   if(car.z>=-(car.length+C.bikeLength)/2){contactAt=car.z;assert.equal(car.change,'straight',`${kmh} km/h: car still changing at contact`);break;}
  }
  assert.notEqual(completedAt,null,`${kmh} km/h: lane change completed`);
  assert.notEqual(contactAt,null,`${kmh} km/h: car reached the player`);
  assert.ok(completedAt<-(car.length+C.bikeLength)/2,`${kmh} km/h: completion at z=${completedAt}`);
  assert.equal(s.health,C.health,`${kmh} km/h: crossing did not hit the stationary player`);
 }
});
test('a late signal or late start cancels before crossing the player',()=>{
 const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.score=35000;s.unsignaledTraffic=signalEvery(s.score)-1;s.random=()=>0;s.spawnWave();
 const car=s.vehicles.find(v=>v.active&&v.change==='queued');assert.ok(car);
 car.z=-s.laneChangeClearance(car.plannedWarning+2)+1;s.scheduleChange(C.step);
 assert.equal(car.change,'straight');assert.equal(car.x,car.fromX);
 car.change='signaling';car.changeTime=car.plannedWarning-C.step;car.warning=car.plannedWarning;car.toX=-car.fromX;car.z=-s.laneChangeClearance(2)+1;
 s.updateVehicle(car,C.step);
 assert.equal(car.change,'straight');assert.equal(car.x,car.fromX);
});
test('reserved signals start and normally finish over multiple seeded full runs',()=>{
 for(const score of [0,35000])for(const seed of [1,7,12]){
  const s=new Simulation(seed);s.invincible=10000;let started=0,cancelled=0,doubles=0;
  const original=s.updateVehicle.bind(s);s.updateVehicle=(v,dt)=>{const before=v.change;original(v,dt);if(before==='signaling'&&v.change==='straight')cancelled++;};
  const seen=new Set();
  for(let i=0;i<120*180;i++){
   s.score=score;s.step(C.step,{target:-1.75,axis:0});
   for(const v of s.vehicles)if(v.active&&v.changeUsed&&!seen.has(v.id)){seen.add(v.id);started++;if(Math.abs(v.toX-v.fromX)>C.laneWidth+1e-9)doubles++;}
  }
  assert.ok(started>=4,`score ${score}, seed ${seed}: ${started} signals`);
  assert.ok(cancelled<started,`score ${score}, seed ${seed}: every signal was cancelled`);
  if(score>10000)assert.ok(doubles>0,`score ${score}, seed ${seed}: no two-lane changes`);
 }
});
