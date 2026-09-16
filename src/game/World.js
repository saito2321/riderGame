import * as THREE from '../vendor/three.module.js';
import { CONFIG as C, VEHICLES } from './config.js';

import { environment, roadMaterial, createCity, coachworkGeometry, batchParts } from './VisualAssets.js';

import { createBike, createTrafficBike } from './BikeModel.js';

const bodyGeometry=coachworkGeometry();
const tireGeometry=new THREE.TorusGeometry(1,.24,6,20);
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const wheelGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
const sphereGeometry = new THREE.IcosahedronGeometry(1, 2);
const palette = new Map();
function material(color, emissive = false) {
  const key = `${color}:${emissive}`;
  if (!palette.has(key)) palette.set(key, emissive ? new THREE.MeshBasicMaterial({color}) : new THREE.MeshStandardMaterial({color, roughness: color==='#17212a'?.95:.34, metalness: color==='#17212a'?0:.38, envMapIntensity: .7}));
  return palette.get(key);
}
function box(parent, color, x,y,z, w,h,d) {
  const mesh = new THREE.Mesh(boxGeometry, material(color)); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); parent.add(mesh); return mesh;
}
function panel(parent,color,x,y,z,w,h,d) {
  const mesh=new THREE.Mesh(bodyGeometry,material(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
}
function wheel(parent,x,y,z,r,width) {
  const mesh=new THREE.Mesh(tireGeometry,material('#17212a'));mesh.rotation.y=Math.PI/2;
  mesh.position.set(x,y,z);mesh.scale.set(r/1.24,r/1.24,width/.48);parent.add(mesh);
  const hub=new THREE.Mesh(wheelGeometry,material('#aab6bd'));hub.rotation.z=Math.PI/2;
  hub.position.set(x,y,z);hub.scale.set(r*.64,width+.018,r*.64);parent.add(hub);
  const cap=new THREE.Mesh(wheelGeometry,material('#39454d'));cap.rotation.z=Math.PI/2;
  cap.position.set(x,y,z);cap.scale.set(r*.28,width+.028,r*.28);parent.add(cap);return mesh;
}
let shadowMaterial;
function shadow(parent,w,d) {
  if(!shadowMaterial){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(32,32,3,32,32,32);g.addColorStop(0,'#020810bd');g.addColorStop(.5,'#02081080');g.addColorStop(1,'#02081000');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false});}
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w*1.35,d*1.2),shadowMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.y=.055;parent.add(mesh);return mesh;
}
function vehicle(type, color) {
  const g = new THREE.Group(), {width:w,length:d,height:h} = VEHICLES[type];
  const contact=shadow(g,w*1.15,d*1.03);
  box(g,'#263b40',0,.44,0,w*.92,.35,d*.92);
  panel(g,color,0,.76,0,w,.66,d);
  box(g,'#252e36',0,.46,d*.49,w*.88,.16,.12);
  box(g,'#b0b8bd',0,.58,d*.495,w*.78,.035,.04);
  box(g,'#d3d8d5',0,.65,d*.516,.36,.14,.015);
  box(g,'#27313a',0,.66,-d*.505,w*.54,.19,.035);
  if (type === 'car') {
    panel(g,'#273e50',0,1.18,-.12,w*.83,.65,d*.5);
    panel(g,color,0,1.49,-.2,w*.73,.12,d*.32);
    panel(g,color,0,1.00,-d*.34,w*.95,.13,d*.25);
    panel(g,color,0,1.00,d*.37,w*.96,.14,d*.23);
    for(const side of [-1,1]){
      box(g,color,side*w*.40,1.2,-.05,.055,.52,.09);
      box(g,'#b5c2c9',side*w*.46,1.00,.05,.022,.035,d*.63);
      panel(g,color,side*w*.55,1.11,-.68,.21,.15,.25);
      for(const z of [-.35,.7])box(g,'#c3cbd0',side*w*.498,.95,z,.025,.04,.17);
      box(g,'#27333d',side*w*.501,.59,0,.025,.1,d*.53);
    }
  } else if(type === 'truck') {
    box(g,'#e0dfc4',0,1.95,.85,w,2.35,d*.7);
    panel(g,color,0,1.4,-d*.36,w,1.55,d*.24);
    box(g,'#29494f',0,1.75,-d*.489,w*.85,.7,.04);
    for (const x of [-w*.23,w*.23]) box(g,'#aeb7a6',x,1.95,d*.501,.05,2.1,.025);
    for(const side of [-1,1]){
      panel(g,color,side*w*.55,1.85,-d*.43,.24,.33,.18);
      box(g,'#aeb7a6',side*w*.505,.86,.85,.025,.08,d*.69);
      for(let z=-d*.22;z<d*.44;z+=.65)box(g,'#aeb7a6',side*w*.502,2.03,z,.025,1.94,.035);
    }
  } else {
    panel(g,color,0,1.8,0,w,2.1,d);
    box(g,'#29494f',0,2.1,0,w*1.012,.83,d*.86);
    panel(g,color,0,2.75,0,w,.22,d);
    for(let z=-d*.4;z<d*.45;z+=1.25) box(g,color,0,2.1,z,w*1.02,.87,.12);
    box(g,'#f0e3b5',0,1.13,0,w*1.02,.14,d*.99);
    box(g,'#27333d',0,1.72,d*.505,w*.6,.25,.04);
    for(const side of [-1,1])panel(g,color,side*w*.55,2.12,-d*.4,.24,.35,.3);
  }
  const wheels=[];
  for(const x of [-w*.49,w*.49]) for(const z of [-d*.31,d*.31]) wheels.push(wheel(g,x,.45,z,.43,.2));
  const brakeLamps=[];
  for(const x of [-w*.3,w*.3]) {
    box(g,'#8f3f37',x,.85,d*.505,w*.19,.17,.06);
    const brakeLamp=box(g,'#ff3025',x,.85,d*.517,w*.24,.22,.035); brakeLamp.material=material('#ff3025',true); brakeLamp.visible=false; brakeLamps.push(brakeLamp);
    const head = box(g,'#fff4bd',x,.85,-d*.505,w*.22,.18,.06); head.material=material('#fff4bd',true);
  }
  const lamps=[];
  for(const dir of [-1,1]) for(const z of [-d*.51,d*.51]) {
    const lamp=box(g,'#ffb632',dir*w*.43,1.04,z,.21,.2,.08); lamp.material=material('#ffb632',true); lamp.visible=false; lamps.push({dir,lamp});
  }
  const arrow = new THREE.Group();
  const shaft=box(arrow,'#fff0ad',0,0,0,.8,.11,.14); shaft.material=material('#fff0ad',true);
  for(const sign of [-1,1]) { const tip=box(arrow,'#fff0ad',.35,sign*.15,0,.45,.11,.14); tip.rotation.z=sign*-Math.PI/4; tip.material=material('#fff0ad',true); }
  arrow.position.set(0,h+.65,d*.1); arrow.visible=false; g.add(arrow);
  batchParts(g,new Set([contact,...wheels,...brakeLamps,...lamps.map(p=>p.lamp)]));
  const signals=new Set([contact,arrow,...brakeLamps,...lamps.map(p=>p.lamp)]);
  const detail=g.children.filter(child=>!signals.has(child));
  const distant=new THREE.Group();
  box(distant,color,0,.77,0,w,.66,d);
  if(type==='car')box(distant,'#273e50',0,1.24,-.12,w*.82,.55,d*.5);
  else if(type==='truck'){
    box(distant,'#e0dfc4',0,1.95,.85,w,2.35,d*.7);
    box(distant,color,0,1.4,-d*.36,w,1.55,d*.24);
  }
  else box(distant,color,0,1.8,0,w,2.1,d);
  batchParts(distant,new Set());g.add(distant);distant.visible=false;
  g.userData={lamps,brakeLamps,arrow,wheels,detail,distant}; return g;
}
export class World {
  constructor(canvas) {
    this.lowPower=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||8)<=4;
    this.renderer = new THREE.WebGLRenderer({canvas,antialias:!this.lowPower,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.lowPower?1:1.5));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color('#9eaeba'); this.scene.fog=new THREE.Fog('#9eaeba',42,168);this.scene.environment=environment();
    this.camera=new THREE.PerspectiveCamera(70,1,.1,220); this.camera.position.set(0,6.2,11.5); this.camera.lookAt(0,1,-22);
    this.scene.add(new THREE.HemisphereLight('#dfeafa','#39434d',1.7));
    const sun=new THREE.DirectionalLight('#fff0d8',2.6); sun.position.set(-15,30,15); this.scene.add(sun);
    box(this.scene,'#606a70',0,-.19,-70,160,.2,260);
    const road=new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth,230),roadMaterial());road.rotation.x=-Math.PI/2;road.position.set(0,.045,-70);this.scene.add(road);this.road=road;
    for(const side of [-1,1]) {
      box(this.scene,'#8b9296',side*6.12,.04,-70,1.72,.28,230);
      box(this.scene,'#bac0bd',side*5.31,.17,-70,.16,.12,230);
      box(this.scene,'#ccd0c9',side*5.02,.065,-70,.1,.015,230);
    }
    this.markings=new THREE.InstancedMesh(boxGeometry,material('#d9dbce'),48); this.scene.add(this.markings);
    this.coinDiscs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.32,.32,.085,16),new THREE.MeshStandardMaterial({color:'#ffc333',metalness:.65,roughness:.28,emissive:'#b57000',emissiveIntensity:.25}),30);
    this.coinMarks=new THREE.InstancedMesh(boxGeometry,material('#fff0ae',true),30);
    for(const coins of [this.coinDiscs,this.coinMarks]){coins.count=0;coins.frustumCulled=false;coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(coins);}
    this.matrix=new THREE.Object3D();
    this.city=createCity(this.scene,boxGeometry);
    this.bike=createBike(shadow); this.scene.add(this.bike);
    // Clone only once at startup; traffic motorcycles share all geometry/materials.
    const trafficBike=createTrafficBike(shadow);
    this.traffic=Array.from({length:C.poolSize},(_,slot)=>{
      const variants={}; for(const type of Object.keys(VEHICLES)) { const g=vehicle(type,['#aebbc8','#802f42','#35657d','#d2a448','#38464f'][slot%5]); g.visible=false; this.scene.add(g); variants[type]=g; } const bike=trafficBike.clone(true);bike.visible=false;this.scene.add(bike);variants.bike=bike;return variants;
    });
    this.particles=Array.from({length:28},()=>{const mesh=new THREE.Mesh(sphereGeometry,material('#ffc369',true));mesh.visible=false;this.scene.add(mesh);return {mesh,life:0,vx:0,vy:0,vz:0};});
    this.effectTime=0; this.lastTime=0; this.lastDistance=0; this.smokeClock=0; this.pixelRatio=Math.min(devicePixelRatio,this.lowPower?1:1.5); this.slowFrames=0;
    if(new URLSearchParams(location.search).has('renderStats')){
      this.stats=document.createElement('output');this.stats.style.cssText='position:absolute;bottom:12px;left:8px;z-index:4;background:#101c2ddd;color:white;font:10px monospace;padding:6px;pointer-events:none';canvas.parentElement.append(this.stats);this.statsTime=0;this.statsFrames=0;
    }
    this.resize(); this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.dispatchEvent(new CustomEvent('renderer-lost'));});
  }
  resize() {
    const rect=this.renderer.domElement.parentElement.getBoundingClientRect(); if(!rect.width||!rect.height)return;
    this.camera.aspect=rect.width/rect.height;
    this.camera.fov=Math.max(52,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(22.5))/this.camera.aspect)));
    this.camera.updateProjectionMatrix();this.renderer.setSize(rect.width,rect.height,false);
    if(this.currentSim)this.render(this.currentSim,this.currentSettings);
  }
  burst(x) {
    for(let i=0;i<18;i++) { const p=this.particles[i]; p.life=.3+i*.017; p.mesh.visible=true; p.mesh.material=material('#ffc369',true);p.mesh.position.set(x,.7,0);p.mesh.scale.setScalar(.035+i%3*.02);p.vx=Math.sin(i*2.4)*4;p.vy=1+i%4;p.vz=2+i%6; }
  }
  render(sim, settings, frameDt=0) {
    this.currentSim=sim;this.currentSettings=settings;
    const dt=Math.max(0,sim.time-this.lastTime);this.lastTime=sim.time;
    if(sim.distance<this.lastDistance) { for(const p of this.particles){p.life=0;p.mesh.visible=false;} }
    this.lastDistance=sim.distance;
    const phase=sim.distance%8;
    for(let i=0;i<48;i++) { this.matrix.position.set(i%2?1.75:-1.75,.065,18-Math.floor(i/2)*8+phase);this.matrix.scale.set(.12,.015,3.5);this.matrix.updateMatrix();this.markings.setMatrixAt(i,this.matrix.matrix); }
    this.markings.instanceMatrix.needsUpdate=true;
    this.city.update(sim.distance);
    this.road.material.map.offset.y=-sim.distance*16/230;
    this.bike.position.x=sim.x;
    const damage=this.bike.userData;
    damage.paint.material=sim.health===C.health?damage.healthyPaint:material('#7d8870');
    damage.scratches.visible=sim.health<C.health;damage.frontLight.visible=sim.health>1;
    damage.tail.rotation.z=sim.health<2?.18:0;
    // Render the fixed-step movement pose; damage never adds an idle body wobble.
    damage.visual.rotation.z=sim.dead?-.8:sim.bank*(settings.reduceMotion?C.reducedBikeLean:C.bikeLean);
    this.bike.position.y=sim.dead?-.18:0;
    damage.flame.visible=sim.turbo>.05 && !sim.dead;damage.flame.scale.y=.6+sim.turbo*.24;
    for(const wheel of damage.wheels)wheel.rotation.x=-sim.distance*2;
    this.bike.visible=sim.invincible<=0 || settings.reduceMotion || Math.floor(sim.time*8)%2===0;
    for(let i=0;i<this.traffic.length;i++) {
      const v=sim.vehicles[i],variants=this.traffic[i];
      for(const [type,g] of Object.entries(variants)) g.visible=v.active&&type===v.type;
      if(!v.active)continue;
      const g=variants[v.type];g.position.set(v.x,0,v.z);
      if(v.type==='bike')continue;
      const detailed=v.z>-(this.lowPower?48:65);
      for(const part of g.userData.detail)part.visible=detailed;
      g.userData.distant.visible=!detailed;
      const blink=Math.floor(v.changeTime/.25)%2===0;
      for(const {dir,lamp} of g.userData.lamps)lamp.visible=v.direction===dir&&blink;
      for(const lamp of g.userData.brakeLamps)lamp.visible=v.braking;
      g.userData.arrow.visible=v.direction!==0;g.userData.arrow.rotation.z=v.direction===-1?Math.PI:0;
    }
    let coinIndex=0;
    for(const coin of sim.coins.items)if(coin.active){
      const angle=settings.reduceMotion?0:sim.time*1.8;
      this.matrix.position.set(coin.x,.85,coin.z);this.matrix.rotation.set(Math.PI/2,angle,0,'YXZ');this.matrix.scale.set(1,1,1);this.matrix.updateMatrix();this.coinDiscs.setMatrixAt(coinIndex,this.matrix.matrix);
      this.matrix.position.set(coin.x+Math.sin(angle)*.055,.85,coin.z+Math.cos(angle)*.055);this.matrix.rotation.set(0,angle,0);this.matrix.scale.set(.055,.35,.016);this.matrix.updateMatrix();this.coinMarks.setMatrixAt(coinIndex++,this.matrix.matrix);
    }
    for(const coins of [this.coinDiscs,this.coinMarks]){coins.count=coinIndex;coins.instanceMatrix.needsUpdate=true;}
    this.matrix.rotation.set(0,0,0,'XYZ');
    this.smokeClock+=dt;
    if(sim.health===1&&!sim.dead&&this.smokeClock>.12) {
      this.smokeClock=0; const p=this.particles.find(p=>p.life<=0);
      if(p){p.life=.7;p.mesh.visible=true;p.mesh.material=material('#80918a');p.mesh.position.set(sim.x,.9,.8);p.mesh.scale.setScalar(.12);p.vx=.15;p.vy=.7;p.vz=1.2;}
    }
    for(const p of this.particles)if(p.life>0){p.life-=dt;p.mesh.visible=p.life>0;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;}
    if(frameDt>.035)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);
    if(this.slowFrames>75&&this.pixelRatio>.7){this.pixelRatio=Math.max(.7,this.pixelRatio-.2);this.renderer.setPixelRatio(this.pixelRatio);this.slowFrames=0;}
    this.renderer.render(this.scene,this.camera);
    if(this.stats&&frameDt>0&&frameDt<.2){
      this.statsTime+=frameDt;this.statsFrames++;
      if(this.statsTime>=1){const info=this.renderer.info;this.stats.textContent=`${Math.round(this.statsFrames/this.statsTime)} fps | ${info.render.calls} draws | ${info.render.triangles} tris | DPR ${this.pixelRatio.toFixed(1)}`;this.statsTime=0;this.statsFrames=0;}
    }
  }
}
