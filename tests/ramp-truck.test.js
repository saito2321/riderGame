import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/Simulation.js';
import { CONFIG as C, VEHICLES } from '../src/game/config.js';

function empty(x=0){
  const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);s.coins.clear();
  s.spawnWave=()=>{};s.x=x;return s;
}
function advance(s,seconds){
  const events=[];
  for(let i=0;i<Math.round(seconds/C.step);i++){
    s.step(C.step,{target:s.x,axis:0});events.push(...s.events);
  }
  return events;
}

test('the opening center-lane vehicle is always a ramp truck',()=>{
  const s=new Simulation(1);
  for(const seed of [1,2,42]){
    s.reset(seed);
    const center=s.vehicles.filter(v=>v.active&&v.x===0);
    assert.equal(center.length,1);
    assert.equal(center[0].type,'rampTruck');
    assert.equal(center[0].z,-124);
    assert.equal(s.coins.items.filter(c=>c.active&&c.x===0).length,5);
  }
});

test('ramp truck spawns after the opening stretch',()=>{
  const s=empty();s.distance=300;s.random=()=>0;s.unsignaledTraffic=0;
  s.spawnWave=Simulation.prototype.spawnWave.bind(s);s.spawnWave();
  assert.ok(s.vehicles.some(v=>v.active&&v.type==='rampTruck'));
});
test('entering the ramp from behind jumps and awards 500 points once',()=>{
  const s=empty(),halfZ=(VEHICLES.rampTruck.length+C.bikeLength)/2;
  const truck=s.spawnVehicle('rampTruck',0,-halfZ-.1);
  const events=advance(s,5);
  assert.equal(events.filter(e=>e.type==='jump').length,1);
  assert.ok(Math.abs(s.score-s.distance-500)<1e-6);
  assert.equal(s.health,C.health);
  assert.equal(truck.rampUsed,true);
  assert.equal(s.jumpTime,0);
});
test('jump lasts at least two seconds and clears the truck by a car length',()=>{
  for(const kmh of [60,150,300]){
    const s=empty(),halfZ=(VEHICLES.rampTruck.length+C.bikeLength)/2;
    s.baseSpeed=kmh/3.6;s.speed=s.baseSpeed;
    const truck=s.spawnVehicle('rampTruck',0,-halfZ-.1);
    for(let i=0;i<120&&s.jumpTime===0;i++)s.step(C.step,{target:0,axis:0});
    assert.ok(s.jumpTime>0,`${kmh} km/h: jumped`);
    assert.ok(s.jumpDuration>=2,`${kmh} km/h: air time`);
    const closing=s.speed-truck.trafficSpeed;
    assert.ok(closing*s.jumpDuration>=truck.length+C.bikeLength+VEHICLES.car.length,`${kmh} km/h: flight distance`);
  }
});
test('side and late entry into the ramp truck still cause damage',()=>{
  for(const [x,z] of [[1,-6.6],[0,0]]){
    const s=empty(x);s.spawnVehicle('rampTruck',0,z);
    const events=advance(s,.3);
    assert.equal(s.health,C.health-1,`x=${x}, z=${z}`);
    assert.equal(events.filter(e=>e.type==='jump').length,0);
  }
});
test('retry clears the jump state and reused trucks can jump again',()=>{
  const s=empty(),halfZ=(VEHICLES.rampTruck.length+C.bikeLength)/2;
  const truck=s.spawnVehicle('rampTruck',0,-halfZ-.1);advance(s,.1);
  assert.ok(s.jumpTime>0);truck.active=false;
  const reused=s.spawnVehicle('rampTruck',0,-halfZ-.1);
  assert.equal(reused.rampUsed,false);
  s.reset(2);assert.equal(s.jumpTime,0);assert.equal(s.jumpVehicleId,null);
});
