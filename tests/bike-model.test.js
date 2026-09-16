import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createBike } from '../src/game/BikeModel.js';

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
