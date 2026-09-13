import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { batchParts, coachworkGeometry } from '../src/game/VisualAssets.js';

test('beveled coachwork keeps the requested vehicle envelope and finite normals',()=>{
  const g=coachworkGeometry();g.computeBoundingBox();
  const size=g.boundingBox.getSize(new THREE.Vector3());
  for(const n of [size.x,size.y,size.z])assert.ok(Math.abs(n-1)<1e-6);
  for(const name of ['position','normal','uv'])assert.ok([...g.getAttribute(name).array].every(Number.isFinite));
  g.dispose();
});

test('static batching preserves transforms, materials and independent brake lights',()=>{
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),paint=new THREE.MeshStandardMaterial();
  for(const x of [-2,2]){const mesh=new THREE.Mesh(geometry,paint);mesh.position.set(x,1,0);mesh.rotation.y=.2;group.add(mesh);}
  const lamp=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());lamp.visible=false;group.add(lamp);
  group.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(group);
  batchParts(group,new Set([lamp]));group.updateMatrixWorld(true);const after=new THREE.Box3().setFromObject(group);
  assert.equal(group.children.length,2);assert.equal(lamp.parent,group);assert.equal(lamp.visible,false);
  assert.ok(before.min.distanceTo(after.min)<1e-6);assert.ok(before.max.distanceTo(after.max)<1e-6);
  lamp.visible=true;assert.ok(lamp.visible);assert.equal(group.children.find(c=>c!==lamp).material,paint);
});
