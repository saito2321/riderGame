import * as THREE from '../vendor/three.module.js';
import { randomGenerator } from './config.js';

function canvasTexture(w,h,draw) {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  draw(canvas.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export function environment() {
  const faces=Array.from({length:6},(_,side)=>{
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,0,64);gradient.addColorStop(0,'#dce4ec');gradient.addColorStop(.5,'#9aabb7');gradient.addColorStop(.52,'#53616c');gradient.addColorStop(1,'#27333e');
    ctx.fillStyle=side===2?'#dce4ec':side===3?'#28333c':gradient;ctx.fillRect(0,0,64,64);
    if(side!==2&&side!==3){ctx.fillStyle='#dae1de';ctx.fillRect(10,10,7,30);ctx.fillRect(43,3,4,40);}return c;
  });
  const t=new THREE.CubeTexture(faces);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}

export function roadMaterial() {
  const rng=randomGenerator(778);
  const map=canvasTexture(256,512,(ctx,w,h)=>{
    ctx.fillStyle='#343f48';ctx.fillRect(0,0,w,h);
    for(let i=0;i<17000;i++){const v=35+Math.floor(rng()*44);ctx.fillStyle=`rgba(${v},${v+5},${v+9},.35)`;ctx.fillRect(rng()*w,rng()*h,1,2);}
  });
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(1,16);map.anisotropy=2;
  return new THREE.MeshStandardMaterial({map,color:'#b4bdc5',roughness:.88,metalness:.02,envMapIntensity:.1});
}

// One shared 256 x 512 facade; window recesses, mullions and masonry cost no geometry.
function facadeTexture() {
  const rng=randomGenerator(391);
  return canvasTexture(256,512,(ctx,w,h)=>{
    ctx.fillStyle='#8c8983';ctx.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=8){ctx.fillStyle='#6c6b68';ctx.fillRect(0,y,w,1);for(let x=(y%16?0:-16);x<w;x+=32)ctx.fillRect(x,y,1,8);}
    for(let y=12;y<h;y+=64)for(let x=16;x<w;x+=64){
      ctx.fillStyle='#484b4d';ctx.fillRect(x-3,y-3,38,47);
      const lit=rng()>.82;const g=ctx.createLinearGradient(x,y,x+30,y+40);g.addColorStop(0,lit?'#a99a79':'#405361');g.addColorStop(1,lit?'#e7c18a':'#1e2d36');ctx.fillStyle=g;ctx.fillRect(x,y,30,40);
      ctx.fillStyle='#919896';ctx.fillRect(x+14,y,2,40);ctx.fillRect(x,y+21,30,2);
      ctx.fillStyle='#404648';ctx.fillRect(x-3,y+41,38,4);ctx.fillStyle='#c2cccb';ctx.fillRect(x-4,y+40,40,2);
    }
    for(let i=0;i<3500;i++){ctx.fillStyle=rng()>.5?'#ffffff0a':'#0000000c';ctx.fillRect(rng()*w,rng()*h,2,3);}
  });
}

export function createCity(scene,geometry) {
  const rng=randomGenerator(482),dummy=new THREE.Object3D(),batches=[];
  const facade=new THREE.MeshStandardMaterial({map:facadeTexture(),roughness:.94});
  const stone=new THREE.MeshStandardMaterial({color:'#7e898e',roughness:.92});
  const dark=new THREE.MeshStandardMaterial({color:'#33444f',roughness:.65,metalness:.25});
  const glass=new THREE.MeshStandardMaterial({color:'#304853',roughness:.26,metalness:.35});
  const awning=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8});
  const glow=new THREE.MeshBasicMaterial({color:'#ffe4ad'});
  for(const mat of [facade,stone,dark,glass,awning,glow])batches.push({mat,items:[]});
  const add=(batch,i,x,y,z,w,h,d,color,tilt=0)=>batches[batch].items.push({i,x,y,z,w,h,d,color,tilt});
  for(let i=0;i<18;i++)for(const side of [-1,1]){
    // Each 12 m lot leaves a 2.5–4.5 m alley; opposite sides are staggered.
    const height=16+rng()*22,width=6+rng()*4,depth=7.5+rng()*2;
    const setback=rng()*.75;
    const building=(batch,x,y,z,w,h,d,color,tilt=0)=>add(batch,i,x+side*setback,y,z+side*1.1,w,h,d,color,tilt);
    const tint=['#867e76','#a18b78','#8b9498','#777f87'][Math.floor(rng()*4)];
    building(0,side*(7.35+width/2),height/2+2.7,0,width,height,depth,tint);
    building(1,side*(7.35+width/2),height+2.8,0,width+.2,.22,depth);
    building(2,side*(7.4+width/2),1.35,0,width,2.7,depth);
    const bay=depth/3;
    for(let shop=0;shop<3;shop++){
      const z=(shop-1)*bay;
      building(3,side*7.34,1.2,z,.04,2.3,bay-.3);
      building(1,side*7.28,1.35,z-bay/2+.1,.17,2.7,.14);
      building(4,side*6.98,2.65,z,.95,.09,bay-.15,['#8a4a4f','#5b7779','#b1b9b5'][i%3],side*.17);
      building(1,side*7.22,3.1,z,.12,.32,bay-.5);
    }
    building(1,side*7.2,3.5,0,.3,.18,depth);
    if(i%2===0){add(2,i,side*6.05,2.7,3,.09,5.4,.09);add(2,i,side*5.66,5.4,3,.85,.08,.09);add(5,i,side*5.3,5.26,3,.22,.3,.22);add(2,i,side*6.05,.16,3,.3,.32,.3);}
  }
  for(const batch of batches){
    batch.mesh=new THREE.InstancedMesh(geometry,batch.mat,batch.items.length);batch.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.mesh.frustumCulled=false;
    batch.items.forEach((item,i)=>batch.mesh.setColorAt(i,new THREE.Color(item.color||'#ffffff')));scene.add(batch.mesh);
  }
  return {update(distance){for(const {mesh,items} of batches){items.forEach((p,i)=>{
    dummy.position.set(p.x,p.y,((24-p.i*12+distance+180)%216)-180+p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,0,p.tilt);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });mesh.instanceMatrix.needsUpdate=true;}}};
}

// Chamfered silhouette shared by every painted body panel.
export function coachworkGeometry() {
  const s=new THREE.Shape();s.moveTo(-.42,-.5);s.lineTo(.42,-.5);s.lineTo(.5,-.34);s.lineTo(.5,.25);s.lineTo(.36,.5);s.lineTo(-.36,.5);s.lineTo(-.5,.25);s.lineTo(-.5,-.34);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.9,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.05,curveSegments:1});g.center();g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3());g.scale(1/size.x,1/size.y,1/size.z);g.computeVertexNormals();return g;
}

// Merge stationary vehicle parts by material, retaining moving wheels and signals.
export function batchParts(group,exclude) {
  const byMaterial=new Map();group.updateMatrixWorld(true);
  for(const child of [...group.children])if(child.isMesh&&!exclude.has(child)){
    let entries=byMaterial.get(child.material);if(!entries)byMaterial.set(child.material,entries=[]);
    const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();child.updateMatrix();g.applyMatrix4(child.matrix);entries.push(g);group.remove(child);
  }
  for(const [mat,entries] of byMaterial){const merged=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv']){const size=entries.reduce((n,g)=>n+g.getAttribute(name).array.length,0),data=new Float32Array(size);let offset=0;
      for(const g of entries){data.set(g.getAttribute(name).array,offset);offset+=g.getAttribute(name).array.length;}merged.setAttribute(name,new THREE.BufferAttribute(data,name==='uv'?2:3));
    }entries.forEach(g=>g.dispose());merged.computeBoundingSphere();group.add(new THREE.Mesh(merged,mat));
  }
}
