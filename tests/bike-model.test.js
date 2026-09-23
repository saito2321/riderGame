import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createBike, createScooter } from '../src/game/BikeModel.js';
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

test('world selects the scooter model for the 5000 point machine',()=>{
  const street={visible:true},scooter={visible:false},world={playerMachines:{street,scooter},bike:street,crashElapsed:1,lastTime:1};
  World.prototype.setMachine.call(world,'scooter');assert.equal(world.bike,scooter);assert.equal(street.visible,false);assert.equal(world.crashElapsed,0);
  World.prototype.setMachine.call(world,'racer');assert.equal(world.bike,street);assert.equal(scooter.visible,false);
});
