import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createBike, createScooter, createSuperSport, createHorse, createRobotVacuum } from '../src/game/BikeModel.js';
import { World } from '../src/game/World.js';

test('bike batching retains independent wheels, damage parts and lean root',()=>{
  const bike=createBike(()=>{}),d=bike.userData;
  for(const part of [d.paint,d.tail,d.frontLight,d.exhaust,d.flame,d.scratches,...d.wheels])assert.equal(part.parent,d.visual);
  assert.equal(d.visual.parent,bike);assert.equal(d.flame.visible,false);assert.equal(d.scratches.visible,false);
  d.visual.rotation.z=.5;d.wheels[0].rotation.x=2;d.tail.rotation.z=.18;
  bike.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(bike);
  assert.ok(bounds.max.y<2.3&&bounds.min.y>-.4);
  let triangles=0,meshes=0;
  bike.traverse(part=>{if(!part.isMesh)return;meshes++;
    for(const key of ['position','normal','uv'])assert.ok([...part.geometry.getAttribute(key).array].every(Number.isFinite));
    triangles+=(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3;
  });
  assert.ok(triangles<15000,`bike triangle budget: ${triangles}`);
  assert.ok(meshes<=30,`bike draw budget: ${meshes}`);
});

test('scooter has a distinct commuter model with the shared damage contract',()=>{
  const scooter=createScooter(()=>{}),d=scooter.userData;
  assert.equal(d.machineType,'scooter');assert.equal(d.visual.parent,scooter);assert.equal(d.wheels.length,2);
  for(const part of [d.paint,d.tail,d.frontLight,d.exhaust,d.flame,d.scratches,...d.wheels])assert.equal(part.parent,d.visual);
  assert.equal(d.flame.visible,false);assert.equal(d.scratches.visible,false);assert.notEqual(d.healthyPaint.color.getHexString(),'95b630');
  scooter.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scooter);
  assert.ok(bounds.max.y<2.3&&bounds.min.y>-.4);assert.ok(bounds.max.z-bounds.min.z>1.8);
  let triangles=0,meshes=0;scooter.traverse(part=>{if(!part.isMesh)return;meshes++;triangles+=(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3;});
  assert.ok(triangles<15000,`scooter triangle budget: ${triangles}`);assert.ok(meshes<=30,`scooter draw budget: ${meshes}`);
});

test('world selects each implemented unlock model',()=>{
  const street={visible:true},scooter={visible:false},supersport={visible:false},horse={visible:false},robovac={visible:false},world={playerMachines:{street,scooter,supersport,horse,robovac},bike:street,crashElapsed:1,lastTime:1};
  World.prototype.setMachine.call(world,'scooter');assert.equal(world.bike,scooter);assert.equal(street.visible,false);assert.equal(world.crashElapsed,0);
  World.prototype.setMachine.call(world,'supersport');assert.equal(world.bike,supersport);assert.equal(scooter.visible,false);
  World.prototype.setMachine.call(world,'horse');assert.equal(world.bike,horse);assert.equal(supersport.visible,false);
  World.prototype.setMachine.call(world,'robovac');assert.equal(world.bike,robovac);assert.equal(horse.visible,false);
  World.prototype.setMachine.call(world,'unknown');assert.equal(world.bike,street);assert.equal(robovac.visible,false);
});

test('horse is a rideable joke machine with animated legs and shared damage parts',()=>{
  const horse=createHorse(()=>{}),d=horse.userData;assert.equal(d.machineType,'horse');assert.equal(d.visual.parent,horse);assert.equal(d.wheels.length,0);assert.equal(d.legs.length,4);
  for(const part of [d.paint,d.tail,d.frontLight,d.exhaust,d.flame,d.scratches,...d.legs])assert.equal(part.parent,d.visual);
  assert.equal(d.flame.visible,false);assert.equal(d.scratches.visible,false);horse.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(horse);assert.ok(bounds.max.y<2.3&&bounds.min.y>-.4);assert.ok(bounds.max.z-bounds.min.z>1.8);
  let triangles=0,meshes=0;horse.traverse(part=>{if(!part.isMesh)return;meshes++;triangles+=(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3;});
  assert.ok(triangles<15000,`horse triangle budget: ${triangles}`);assert.ok(meshes<=40,`horse draw budget: ${meshes}`);
});

test('robot vacuum is a rideable joke machine with spinning side brushes',()=>{
  const robot=createRobotVacuum(()=>{}),d=robot.userData;assert.equal(d.machineType,'robovac');assert.equal(d.visual.parent,robot);assert.equal(d.wheels.length,0);assert.equal(d.brushes.length,2);assert.ok(d.lidar);
  for(const part of [d.paint,d.tail,d.frontLight,d.exhaust,d.flame,d.scratches,...d.brushes])assert.equal(part.parent,d.visual);
  assert.equal(d.flame.visible,false);assert.equal(d.scratches.visible,false);robot.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(robot);assert.ok(bounds.max.y<2.3&&bounds.min.y>-.4);assert.ok(bounds.max.z-bounds.min.z>1.4);
  let triangles=0,meshes=0;robot.traverse(part=>{if(!part.isMesh)return;meshes++;triangles+=(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3;});
  assert.ok(triangles<15000,`robot vacuum triangle budget: ${triangles}`);assert.ok(meshes<=40,`robot vacuum draw budget: ${meshes}`);
});

test('supersport has a full-cowl model within the player bike budget',()=>{
  const bike=createSuperSport(()=>{}),d=bike.userData;assert.equal(d.machineType,'supersport');assert.equal(d.visual.parent,bike);assert.equal(d.wheels.length,2);assert.ok(d.screen);
  for(const part of [d.paint,d.tail,d.frontLight,d.exhaust,d.flame,d.scratches,...d.wheels])assert.equal(part.parent,d.visual);
  bike.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(bike);assert.ok(bounds.max.y<2.3&&bounds.min.y>-.4);assert.ok(bounds.max.z-bounds.min.z>2);
  let triangles=0,meshes=0;bike.traverse(part=>{if(!part.isMesh)return;meshes++;triangles+=(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3;});
  assert.ok(triangles<15000,`supersport triangle budget: ${triangles}`);assert.ok(meshes<=30,`supersport draw budget: ${meshes}`);
});
