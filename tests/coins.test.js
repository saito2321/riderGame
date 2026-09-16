import test from 'node:test';
import assert from 'node:assert/strict';
import { CoinSystem } from '../src/game/CoinSystem.js';
import { Simulation } from '../src/game/Simulation.js';
const fixture=()=>({speed:22,x:0,score:0,combo:25,turbo:8,vehicles:[],events:[]});
const car=(x,z,toX=x)=>({active:true,x,z,toX,change:toX===x?'straight':'queued',width:1.8,length:4.5,trafficSpeed:12});
test('coin rows contain 3–5 coins at a lane center and are reproducible',()=>{
 for(let seed=1;seed<=30;seed++){
  const a=new CoinSystem(seed),b=new CoinSystem(seed);assert.equal(a.spawn(fixture()),true);b.spawn(fixture());
  assert.deepEqual(a.items,b.items);const row=a.items.filter(c=>c.active);
  assert.ok(row.length>=3&&row.length<=5);assert.ok([-3.5,0,3.5].includes(row[0].x));
  assert.ok(row.every(c=>c.x===row[0].x));assert.equal(row[1].z-row[0].z,-4);
 }
});
test('pickup is a flat 20 points once even with combo and turbo',()=>{
 const c=new CoinSystem(1),s=fixture();Object.assign(c.items[0],{active:true,x:0,z:-.1});
 c.update(s,.02,0);c.update(s,.02,0);assert.equal(s.score,20);assert.equal(c.collected,1);assert.equal(s.combo,25);assert.deepEqual(s.events,[{type:'coin',points:20}]);
});
test('continuous pickup uses lateral position when passing the coin',()=>{
 const c=new CoinSystem(1),s=fixture();s.speed=44;s.x=1;
 Object.assign(c.items[0],{active:true,x:0,z:-2.2});c.update(s,.1,-1);assert.equal(s.score,20);
 Object.assign(c.items[1],{active:true,x:-3.5,z:-.1});c.update(s,.1,1);assert.equal(s.score,20);
});
test('blocked rows and lane-change corridors cannot attract the player',()=>{
 const c=new CoinSystem(1),s=fixture();s.vehicles=[car(-3.5,-30),car(0,-30),car(3.5,-30)];assert.equal(c.spawn(s),false);
 s.vehicles=[car(-3.5,-30,0)];assert.equal(c.safe(s,0,-66),false);
 Object.assign(c.items[0],{active:true,x:0,z:-66});c.update(s,.01,0);assert.equal(c.items[0].active,false);
});
test('reset and revival clear coins; dead simulation cannot collect',()=>{
 const s=new Simulation(1);s.vehicles.forEach(v=>v.active=false);Object.assign(s.coins.items[0],{active:true,x:0,z:-.01});
 s.dead=true;s.step(1/120,0);assert.equal(s.score,0);assert.equal(s.coins.collected,0);
 s.revive();assert.ok(s.coins.items.every(c=>!c.active));s.coins.collected=4;s.reset(2);assert.equal(s.coins.collected,0);
});
test('coin random draws leave traffic random sequence unchanged',()=>{
 const a=new Simulation(42),b=new Simulation(42);a.coins.spawn(fixture());assert.equal(a.random(),b.random());
});
