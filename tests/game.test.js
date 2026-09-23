import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,interval} from '../src/game/Simulation.js';
import {CONFIG as C,VEHICLES,steer,multiplier,warningSeconds,nearPoints} from '../src/game/config.js';
import {LocalAdapter} from '../src/platform/LocalAdapter.js';
import {PlatformAdapter} from '../src/platform/PlatformAdapter.js';
import {MACHINES,isMachineUnlocked} from '../src/machines.js';
const close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function empty(){const s=new Simulation(12);s.vehicles.forEach(v=>v.active=false);s.spawnWave=()=>{};return s;}
function advance(s,seconds,target=s.x){for(let i=0;i<Math.round(seconds/C.step);i++)s.step(C.step,{target,axis:0});}
function pass(type,gap,{speed=C.baseSpeed,invincible=false}={}){
  const s=empty();s.distance=(speed-C.baseSpeed)/C.speedIncrement*C.distanceStep;s.baseSpeed=speed;s.speed=speed;s.x=(VEHICLES[type].width+C.bikeWidth)/2+gap;
  s.invincible=invincible?10:0;const v=s.spawnVehicle(type,0,-(VEHICLES[type].length+C.bikeLength)/2-.2);
  advance(s,4);return {s,v};
}

test('continuous overlap detects a crossing even if endpoints are outside',()=>{
  assert.deepEqual(interval(-3,3,-1,1),[1/3,2/3]);assert.equal(interval(2,2,-1,1),null);
});
test('outer movement limits cannot bypass traffic with keyboard or drag input',()=>{
  for(const side of [-1,1])for(const keyboard of [false,true])for(const type of Object.keys(VEHICLES).filter(type=>type!=='rampTruck')){
    const s=empty();s.x=side*C.edge;
    s.spawnVehicle(type,side*C.laneWidth,-8);
    const input={axis:keyboard?side:0,target:side*100};
    for(let i=0;i<180;i++){
      s.step(C.step,input);
      assert.ok(Math.abs(s.x)<=C.edge,'input must stay inside the movement limits');
    }
    assert.ok(s.health<C.health,`${type} must hit at the ${side<0?'left':'right'} limit with ${keyboard?'keyboard':'drag'} input`);
  }
});

test('steering has common 6 m/s cap and respects both road boundaries',()=>{
  close(steer(0,4.8,C.step),.05);close(steer(0,1,C.step,true),.05);
  let x=0;for(let i=0;i<300;i++)x=steer(x,1,C.step,true);close(x,C.edge);
  for(let i=0;i<600;i++)x=steer(x,-1,C.step,true);close(x,-C.edge);
});
test('full passes score once for all vehicle sizes, sides and tiers',()=>{
  for(const type of Object.keys(VEHICLES))for(const [gap,points] of [[.1,300],[.18,300],[.18001,100],[.25,100],[.5,100]]){
    const {s,v}=pass(type,gap);assert.equal(s.nearMisses,1,`${type}/${gap}`);close(s.score-s.distance,points);assert.ok(v.scored);advance(s,2);assert.equal(s.nearMisses,1);
    const left=empty();left.x=-(VEHICLES[type].width+C.bikeWidth)/2-gap;left.spawnVehicle(type,0,-7);advance(left,4);assert.equal(left.nearMisses,1);
  }
});
test('very close gives a larger speed burst than a regular near miss',()=>{
  const burst=gap=>{
    const s=empty();s.x=(VEHICLES.car.width+C.bikeWidth)/2+gap;
    const v=s.spawnVehicle('car',0,3.249);v.nearStarted=true;v.side=1;v.minGap=gap;
    s.step(C.step,{target:s.x,axis:0});assert.equal(s.nearMisses,1);
    const turbo=s.turbo;s.step(C.step,{target:s.x,axis:0});return {turbo,speed:s.speed};
  };
  const regular=burst(.3),veryClose=burst(.1);
  assert.equal(regular.turbo,0);assert.equal(veryClose.turbo,C.veryCloseBoost);
  assert.ok(veryClose.speed>regular.speed+2);
});
test('gap boundaries and max-speed complete passes remain correct',()=>{
  assert.equal(nearPoints(.18),300);assert.equal(nearPoints(.18001),100);assert.equal(nearPoints(.35),100);
  for(const type of Object.keys(VEHICLES)){
    const {s}=pass(type,.6,{speed:C.maxBaseSpeed});assert.equal(s.nearMisses,1);
    const outside=pass(type,.601);assert.equal(outside.s.nearMisses,0);
    const contact=pass(type,0,{invincible:true});assert.equal(contact.s.nearMisses,0);assert.equal(contact.s.health,2);
    const fast=empty();fast.distance=13200;fast.baseSpeed=C.maxBaseSpeed;fast.combo=20;fast.lastNear=0;fast.turbo=8;fast.x=(VEHICLES[type].width+C.bikeWidth)/2+.3;
    fast.spawnVehicle(type,0,-8);advance(fast,1);assert.equal(fast.nearMisses,1);
  }
});
test('late entry, leaving/reentering zone, and invincible contact do not score',()=>{
  const late=empty();late.x=1.5;late.spawnVehicle('car',0,-1);advance(late,1);assert.equal(late.nearMisses,0);
  const leave=empty();leave.x=1.5;const v=leave.spawnVehicle('bus',0,-7);advance(leave,.15);advance(leave,.4,4);advance(leave,1,1.5);assert.equal(leave.nearMisses,0);assert.ok(v.disqualified);
});
test('two collisions end the ride; death freezes scoring; revive works only once',()=>{
  const s=empty();assert.equal(s.health,2);const hitCar=s.spawnVehicle('car',0,-3.3);advance(s,.5);assert.equal(s.health,1);assert.equal(s.dead,false);assert.ok(s.invincible>0);assert.equal(hitCar.active,true);
  s.invincible=0;s.hitStop=0;s.spawnVehicle('car',0,-3.3);advance(s,.5);assert.ok(s.dead);assert.equal(s.health,0);
  const score=s.score,distance=s.distance;advance(s,5);assert.equal(s.score,score);assert.equal(s.distance,distance);
  const passing=s.spawnVehicle('car',3.5,-100),coin=s.coins.items[0];Object.assign(coin,{active:true,x:3.5,z:-30});
  const vehicleZ=passing.z,coinZ=coin.z,speed=s.speed,time=s.time;
  s.advanceCrash(.5);
  close(s.distance,distance+speed*.5);close(s.time,time+.5);close(passing.z,vehicleZ+(speed-passing.trafficSpeed)*.5);close(coin.z,coinZ+speed*.5);
  assert.equal(s.score,score);assert.equal(s.events.length,0);
  assert.ok(s.revive());assert.equal(s.health,1);assert.equal(s.score,score);assert.equal(s.combo,0);assert.equal(s.turbo,0);assert.equal(s.invincible,2);
  s.dead=true;assert.equal(s.revive(),false);s.reset(12);assert.equal(s.revived,false);assert.equal(s.health,2);assert.equal(s.score,0);
});
test('combo uses new count for points and expires only after 4.5 seconds',()=>{
  assert.equal(multiplier(2),1);assert.equal(multiplier(3),1.5);assert.equal(multiplier(6),2);assert.equal(multiplier(20),4);
  const s=empty();s.combo=2;s.lastNear=0;s.x=1.5;const v=s.spawnVehicle('car',0,3.249);v.nearStarted=true;v.side=1;v.minGap=.3;
  s.step(C.step);assert.equal(s.combo,3);close(s.score-s.distance,150);
  s.lastNear=s.time-C.comboTime+C.step;s.step(C.step);assert.equal(s.combo,3);s.step(C.step);assert.equal(s.combo,0);
});
test('simultaneous passes are ordered independently of vehicle pool order',()=>{
  const run=reverse=>{const s=empty();s.combo=2;s.lastNear=0;for(const [x,gap] of [[-1.3,.1],[1.7,.5]]){const v=s.spawnVehicle('car',x,3.249);v.nearStarted=true;v.side=Math.sign(-x);v.minGap=gap;}if(reverse)s.vehicles.reverse();s.step(C.step);return [s.score-s.distance,s.combo,s.nearMisses];};
  assert.deepEqual(run(false),run(true));assert.equal(run(false)[2],2);
});
test('speed follows distance, reaches cap, and turbo decays in 1 second',()=>{
  const s=empty();s.score=40000;advance(s,.1);close(s.baseSpeed,80/3.6);
  s.distance=297;advance(s,.1);close(s.baseSpeed,80/3.6);
  s.distance=300;advance(s,.5);close(s.baseSpeed,85/3.6);
  s.distance=13500;s.baseSpeed=300/3.6;advance(s,.5);close(s.baseSpeed,305/3.6);
  s.distance=55200;s.baseSpeed=995/3.6;advance(s,.5);close(s.baseSpeed,999/3.6);
  s.combo=20;s.lastNear=s.time;s.turbo=8;advance(s,.1);close(s.speed,999/3.6);
  s.breakCombo();advance(s,1);close(s.turbo,0);assert.ok(s.speed<=999/3.6);
});
test('crash recovery never lowers actual speed below 80 km/h',()=>{
  const s=empty();s.crashRecovery=1.5;s.step(C.step,{target:0,axis:0});close(s.speed,C.minSpeed);
  s.distance=1200;s.baseSpeed=100/3.6;s.crashRecovery=1.5;s.step(C.step,{target:0,axis:0});assert.ok(s.speed>=C.minSpeed&&s.speed<C.minSpeed+.1);
});
test('lane-change warnings use the per-run score and stop at the lower bound',()=>{
  assert.equal(warningSeconds(10000),2.5);assert.equal(warningSeconds(15000),2.25);assert.equal(warningSeconds(35000),1.25);assert.equal(warningSeconds(999999),1.25);
  const s=empty();s.random=()=>0;const v=s.spawnVehicle('car',0,-106);Object.assign(v,{change:'queued',plannedDirection:1,toX:3.5});s.score=499;s.scheduleChange(4);assert.equal(v.change,'queued');
  v.z=-105;s.score=500;s.scheduleChange(4);assert.equal(v.change,'signaling');assert.equal(v.warning,2.5);assert.equal(v.x,0);
  s.score=50000;s.updateVehicle(v,1);assert.equal(v.warning,2.5);assert.equal(v.x,0);
});
test('lane-change recheck cancels occupied destination and reuse clears indicators',()=>{
  const s=empty();const car=s.spawnVehicle('car',0,-80);Object.assign(car,{change:'signaling',direction:1,toX:3.5,fromX:0,warning:1.25,changeTime:1.24,changeUsed:true});
  s.spawnVehicle('bus',3.5,-80);s.updateVehicle(car,.02);assert.equal(car.change,'straight');assert.equal(car.direction,0);
  car.active=false;const reused=s.spawnVehicle('car',0,-100);assert.equal(reused.changeUsed,false);assert.equal(reused.direction,0);assert.equal(reused.nearStarted,false);
});
test('announced lane change completes after approaching during the warning',()=>{
  for(const startZ of [-100,-80,-60])for(const playerX of [-3.5,0,3.5]){
    const s=empty();s.random=()=>0;s.score=500;s.x=playerX;
    const car=s.spawnVehicle('car',0,startZ);Object.assign(car,{change:'queued',plannedDirection:1,toX:3.5});s.scheduleChange(4);
    assert.equal(car.change,'signaling');const destination=car.toX;
    // Includes the reported case: from -80 m the old recheck cancels at -55 m,
    // even with no other traffic and no player movement during the warning.
    for(let i=0;i<299;i++)s.updateVehicle(car,C.step);
    assert.equal(car.change,'signaling');close(car.x,0);
    for(let i=0;i<243;i++)s.updateVehicle(car,C.step);
    close(car.x,destination);assert.equal(car.change,'straight');assert.equal(car.direction,0);
  }
});
test('lane-change reservation accounts for traffic braking before movement starts',()=>{
  const s=empty();s.x=-3.5;const car=s.spawnVehicle('car',0,-80);
  const braking=s.spawnVehicle('car',3.5,-110);braking.braking=true;
  assert.equal(s.changeTrafficIsClear(car,3.5),true);
  assert.equal(s.changeIsSafe(car,3.5),false);
});
test('random braking starts only at 5000 points, slows traffic, and resets on reuse',()=>{
  const s=empty();const car=s.spawnVehicle('car',0,-80);s.random=()=>0;
  s.score=C.brakeStartScore-1;s.scheduleBrake(C.brakeInterval);assert.equal(car.braking,false);
  s.score=C.brakeStartScore;s.scheduleBrake(C.brakeInterval);assert.equal(car.braking,true);assert.equal(car.brakeUsed,true);
  s.updateVehicle(car,.5);assert.equal(car.trafficSpeed,C.brakingSpeed);assert.equal(car.braking,true);
  s.updateVehicle(car,C.brakeDuration);assert.equal(car.braking,false);
  s.updateVehicle(car,1);assert.equal(car.trafficSpeed,C.vehicleSpeed);
  car.active=false;const reused=s.spawnVehicle('bus',3.5,-100);assert.equal(reused.braking,false);assert.equal(reused.brakeUsed,false);assert.equal(reused.trafficSpeed,C.vehicleSpeed);
});
test('path check rejects blocked roads and waves never use every lane',()=>{
  const s=empty();for(const x of [-3.5,0,3.5])s.spawnVehicle('bus',x,-6);assert.equal(s.hasSafePath(),false);
  for(let seed=1;seed<=50;seed++){
    const run=new Simulation(seed);run.distance=6000;for(let i=0;i<20;i++){run.vehicles.forEach(v=>v.active=false);run.spawnWave();assert.ok(run.vehicles.filter(v=>v.active).length<=2);assert.ok(run.hasSafePath());}
  }
});
test('30 and 60 FPS consume the same fixed steps and seeded input',()=>{
  const run=fps=>{const s=new Simulation(481);s.invincible=1000;for(let f=0;f<fps*60;f++)for(let i=0;i<120/fps;i++)s.step(C.step,{target:Math.sin(s.time*.7)*4.5,axis:0});return [s.score,s.distance,s.x,s.nextId,s.nearMisses];};
  assert.deepEqual(run(30),run(60));
});
test('30 minute simulation remains finite, bounded and reuses vehicle slots',()=>{
  const s=new Simulation(112);s.invincible=10000;
  const slots=[...s.vehicles];for(let i=0;i<120*1800;i++)s.step(C.step,{target:Math.sin(i/800)*4.5,axis:0});
  assert.ok(Number.isFinite(s.score)&&s.score>1000);assert.equal(s.vehicles.length,C.poolSize);assert.ok(s.vehicles.every((v,i)=>v===slots[i]));assert.ok(s.speed<=C.maxSpeed);assert.ok(s.nextId>100);
});
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
test('local save persists current settings and reloads best records',()=>{
  const storage=memory();storage.setItem('lsr.bestScore','99');const p=new LocalAdapter(storage);assert.equal(p.load().bestScore,0);
  p.record({score:123.9,distance:50.8,bestCombo:4});p.setSetting('sfx',false);p.completeTutorial();p.save(true);
  const reload=new LocalAdapter(storage).load();assert.equal(reload.bestScore,123);assert.equal(reload.bestDistance,50);assert.deepEqual(reload.settings,{sfx:false});assert.equal(reload.tutorialCompleted,true);assert.equal(reload.selectedMachine,'street');
});
test('machines unlock from best score and only unlocked selections persist',()=>{
  assert.deepEqual(MACHINES.map(machine=>machine.unlockScore),[0,5000,10000,20000,30000]);assert.equal(isMachineUnlocked('scooter',4999),false);assert.equal(isMachineUnlocked('scooter',5000),true);
  const storage=memory(),p=new LocalAdapter(storage);p.load();assert.equal(p.setMachine('scooter'),false);p.record({score:10000,distance:0,bestCombo:0});assert.equal(p.setMachine('supersport'),true);assert.equal(p.setMachine('phantom'),false);
  const reload=new LocalAdapter(storage).load();assert.equal(reload.selectedMachine,'supersport');assert.equal(reload.bestScore,10000);
});
test('broken or unavailable save storage never prevents session play or overwrites data',()=>{
  const storage=memory();storage.setItem('lsr.save.v2','broken');const p=new LocalAdapter(storage);p.load();assert.equal(p.writable,false);p.record({score:500,distance:30,bestCombo:2});p.save(true);assert.equal(p.data.bestScore,500);assert.equal(storage.getItem('lsr.save.v2'),'broken');
  const blocked=new LocalAdapter({getItem(){throw Error();}});assert.doesNotThrow(()=>blocked.load());
});
test('revive adapter resolves success only for true and deduplicates requests',async()=>{
  const p=new LocalAdapter(memory());const a=p.requestRevive();assert.equal(p.requestRevive(),a);p.resolveRevive(true);assert.equal(await a,true);
  const b=p.requestRevive();p.resolveRevive(false);assert.equal(await b,false);p.resolveRevive(true);
});

test('hit stop freezes traffic, combo timer and scoring',()=>{
  const s=new Simulation(1);s.hitStop=.15;s.combo=5;s.lastNear=0;const z=s.vehicles[0].z;
  advance(s,.1);assert.equal(s.time,0);assert.equal(s.distance,0);assert.equal(s.combo,5);assert.equal(s.vehicles[0].z,z);
});
test('successful lane change keeps warning duration and finishes at adjacent center',()=>{
  const s=empty();s.x=-3.5;const v=s.spawnVehicle('car',0,-100);Object.assign(v,{change:'signaling',direction:1,fromX:0,toX:3.5,warning:2.5,changeUsed:true});
  for(let i=0;i<299;i++)s.updateVehicle(v,C.step);close(v.x,0);assert.equal(v.change,'signaling');
  for(let i=0;i<243;i++)s.updateVehicle(v,C.step);close(v.x,3.5);assert.equal(v.change,'straight');assert.equal(v.direction,0);
});
test('save write failure keeps dirty data and retries on next request',()=>{
  const storage=memory();let fail=true;const original=storage.setItem;storage.setItem=(k,v)=>{if(fail)throw Error('quota');original(k,v);};
  const p=new LocalAdapter(storage);p.load();p.record({score:70,distance:20,bestCombo:3});p.save(true);assert.equal(p.saveFailed,true);assert.equal(p.dirty,true);
  fail=false;p.save(true);assert.equal(p.saveFailed,false);assert.equal(new LocalAdapter(storage).load().bestScore,70);
});
test('playables adapter loads before cloud save and uses YouTube ads',async()=>{
  const calls=[];
  const sdk={IN_PLAYABLES_ENV:true,
    game:{loadData:async()=>{calls.push('load');return JSON.stringify({schemaVersion:2,bestScore:80,bestDistance:40,bestCombo:3,tutorialCompleted:true,selectedMachine:'street',settings:{sfx:true}});},saveData:async data=>{calls.push(['save',JSON.parse(data).bestScore]);},firstFrameReady:()=>calls.push('first'),gameReady:()=>calls.push('ready')},
    engagement:{sendScore:async score=>calls.push(['score',score.value])},
    ads:{requestRewardedAd:async id=>{calls.push(['reward',id]);return true;},requestInterstitialAd:async()=>calls.push('interstitial')},
    system:{isAudioEnabled:()=>false,onAudioEnabledChange:()=>()=>{},onPause:()=>()=>{},onResume:()=>()=>{}}};
  const p=new PlatformAdapter({sdk});p.firstFrameReady();const data=await p.load();assert.equal(data.bestScore,80);assert.equal(p.isAudioEnabled(),false);
  p.record({score:125,distance:60,bestCombo:5});await p.save(true);assert.deepEqual(calls.slice(0,4),['first','load',['save',125],['score',125]]);
  assert.equal(await p.requestInterstitial(),true);assert.equal(await p.requestRevive(),true);assert.ok(calls.some(call=>Array.isArray(call)&&call[0]==='reward'&&call[1]==='revive-one-health'));
  p.gameReady();assert.equal(calls.at(-1),'ready');
});
test('non-playables adapter keeps using localStorage and local revive flow',async()=>{
  const storage=memory(),sdk={IN_PLAYABLES_ENV:false};const p=new PlatformAdapter({sdk,storage});await p.load();
  p.record({score:45,distance:12,bestCombo:2});p.save(true);assert.equal(JSON.parse(storage.getItem('lsr.save.v2')).bestScore,45);
  const revive=p.requestRevive();p.resolveRevive(true);assert.equal(await revive,true);assert.equal(await p.requestInterstitial(),false);
});
test('failed YouTube load cannot overwrite an unknown cloud save',async()=>{
  let saves=0;const sdk={IN_PLAYABLES_ENV:true,game:{loadData:async()=>{throw Error('offline');},saveData:async()=>{saves++;}},engagement:{},ads:{},system:{}};
  const p=new PlatformAdapter({sdk});await p.load();p.record({score:500,distance:20,bestCombo:2});await p.save(true);
  assert.equal(p.writable,false);assert.equal(p.saveFailed,true);assert.equal(saves,0);
});
test('playables sends only the best score from a successful cloud save',async()=>{
  const calls=[];let rejectSave;
  const sdk={IN_PLAYABLES_ENV:true,
    game:{loadData:async()=>'',saveData:data=>{calls.push(['save',JSON.parse(data).bestScore]);return new Promise((_,reject)=>{rejectSave=reject;});}},
    engagement:{sendScore:score=>calls.push(['score',score.value])},ads:{},system:{}};
  const p=new PlatformAdapter({sdk});await p.load();p.record({score:250,distance:30,bestCombo:4});
  const pending=p.save(true);await Promise.resolve();assert.deepEqual(calls,[['save',250]]);
  rejectSave(Error('offline'));await pending;assert.deepEqual(calls,[['save',250]]);assert.equal(p.dirty,true);
});
