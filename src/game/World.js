import * as THREE from '../vendor/three.module.js';
import { CONFIG as C, VEHICLES, randomGenerator } from './config.js';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const wheelGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
const palette = new Map();
function material(color, emissive = false) {
  const key = `${color}:${emissive}`;
  if (!palette.has(key)) palette.set(key, emissive ? new THREE.MeshBasicMaterial({color}) : new THREE.MeshStandardMaterial({color, roughness: .85, metalness: .05}));
  return palette.get(key);
}
function box(parent, color, x,y,z, w,h,d) {
  const mesh = new THREE.Mesh(boxGeometry, material(color)); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); parent.add(mesh); return mesh;
}
function wheel(parent,x,y,z,r,width) {
  const mesh = new THREE.Mesh(wheelGeometry, material('#203039')); mesh.rotation.z = Math.PI/2;
  mesh.position.set(x,y,z); mesh.scale.set(r,width,r); parent.add(mesh);
  const hub = new THREE.Mesh(wheelGeometry, material('#a5b5ae')); hub.rotation.z = Math.PI/2;
  hub.position.set(x,y,z); hub.scale.set(r*.42,width+.025,r*.42); parent.add(hub); return mesh;
}
function shadow(parent,w,d) { const mesh = box(parent,'#344746',0,.022,0,w,.025,d); return mesh; }
function vehicle(type, color) {
  const g = new THREE.Group(), {width:w,length:d,height:h} = VEHICLES[type];
  shadow(g,w*1.15,d*1.03);
  box(g,'#263b40',0,.44,0,w*.92,.35,d*.92);
  box(g,color,0,.8,0,w,.65,d);
  if (type === 'car') {
    box(g,'#29494f',0,1.17,-.15,w*.83,.64,d*.51);
    box(g,color,0,1.52,-.15,w*.85,.13,d*.5);
    box(g,color,0,1.17,-.05,.12,.65,d*.53);
  } else if(type === 'truck') {
    box(g,'#e0dfc4',0,1.95,.85,w,2.35,d*.7);
    box(g,color,0,1.4,-d*.36,w,1.55,d*.24);
    box(g,'#29494f',0,1.75,-d*.489,w*.85,.7,.04);
    for (const x of [-w*.23,w*.23]) box(g,'#aeb7a6',x,1.95,d*.501,.05,2.1,.025);
  } else {
    box(g,color,0,1.8,0,w,2.1,d);
    box(g,'#29494f',0,2.1,0,w*1.012,.83,d*.86);
    box(g,color,0,2.75,0,w,.22,d);
    for(let z=-d*.4;z<d*.45;z+=1.25) box(g,color,0,2.1,z,w*1.02,.87,.12);
    box(g,'#f0e3b5',0,1.13,0,w*1.02,.14,d*.99);
  }
  const wheels=[];
  for(const x of [-w*.49,w*.49]) for(const z of [-d*.31,d*.31]) wheels.push(wheel(g,x,.45,z,.43,.2));
  for(const x of [-w*.3,w*.3]) {
    const tail = box(g,'#ff7762',x,.85,d*.505,w*.19,.17,.06); tail.material=material('#ff6655',true);
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
  g.userData={lamps,arrow,wheels}; return g;
}
function makeBike() {
  const root = new THREE.Group(), g = new THREE.Group();
  shadow(root,.85,2.3);
  root.add(g);
  const wheels=[wheel(g,0,.38,-.77,.38,.23),wheel(g,0,.38,.77,.38,.28)];
  box(g,'#254049',0,.65,0,.27,.22,1.5);
  const paint=box(g,'#d6ef7c',0,.96,-.15,.53,.53,1.05); paint.rotation.x=-.12;
  const tail=box(g,'#d6ef7c',0,.93,.73,.51,.25,.51);
  box(g,'#233b41',0,1.15,.34,.46,.15,.7);
  const light=box(g,'#ff715f',0,1.04,.99,.34,.1,.06); light.material=material('#ff715f',true);
  const frontLight=box(g,'#fff3b1',0,1.06,-.75,.27,.2,.1); frontLight.material=material('#fff3b1',true);
  box(g,'#a3b3ab',0,1.32,-.63,.94,.06,.08);
  const rider=box(g,'#1d3943',0,1.56,.03,.6,.69,.42); rider.rotation.x=-.3;
  box(g,'#aac47c',0,1.57,.28,.22,.4,.035);
  for(const side of [-1,1]) {
    const arm=box(g,'#23464f',side*.3,1.44,-.33,.15,.53,.16); arm.rotation.x=-.8;
    const leg=box(g,'#20383f',side*.29,.95,.36,.19,.52,.33); leg.rotation.x=-.3;
  }
  const head=new THREE.Mesh(sphereGeometry,material('#edf0d9')); head.position.set(0,2.08,-.2); head.scale.set(.3,.32,.31); g.add(head);
  box(g,'#254650',0,2.06,-.45,.47,.14,.12);
  const exhaust=box(g,'#78898c',.33,.52,.72,.14,.15,.65);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.14,.8,7),material('#9bf5ff',true)); flame.rotation.x=Math.PI/2; flame.position.set(.33,.52,1.35); g.add(flame); flame.visible=false;
  const scratches=box(g,'#7c8174',.272,1.03,.07,.018,.035,.44); scratches.rotation.x=.35; scratches.visible=false;
  root.userData={wheels,paint,tail,frontLight,exhaust,flame,scratches,visual:g}; return root;
}
export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color('#bcd8cb'); this.scene.fog=new THREE.Fog('#bcd8cb',65,175);
    this.camera=new THREE.PerspectiveCamera(70,1,.1,220); this.camera.position.set(0,12,18); this.camera.lookAt(0,1,-14);
    this.scene.add(new THREE.HemisphereLight('#fff9dc','#47656a',2.3));
    const sun=new THREE.DirectionalLight('#fff4d2',2.1); sun.position.set(-15,30,15); this.scene.add(sun);
    box(this.scene,'#7f9e89',0,-.19,-70,160,.2,260);
    box(this.scene,'#405557',0,-.03,-70,C.roadWidth,.15,230);
    for(const side of [-1,1]) {
      box(this.scene,'#d0d1b8',side*6.12,.04,-70,1.72,.28,230);
      box(this.scene,'#f2ebcc',side*5.31,.17,-70,.16,.12,230);
      box(this.scene,'#ededce',side*5.02,.065,-70,.1,.015,230);
    }
    this.markings=new THREE.InstancedMesh(boxGeometry,material('#e7e5c6'),48); this.scene.add(this.markings);
    this.matrix=new THREE.Object3D();
    this.blocks=[]; const rng=randomGenerator(482);
    for(let i=0;i<18;i++) {
      const block=new THREE.Group(); this.scene.add(block); this.blocks.push(block);
      for(const side of [-1,1]) {
        const height=4+rng()*12, depth=6+rng()*3, width=3+rng()*4;
        const color=['#91ad9c','#aec3ac','#8ca9a0','#d0cbb0','#a5b6a1'][Math.floor(rng()*5)];
        const x=side*(7.4+width/2);
        box(block,color,x,height/2,0,width,height,depth);
        box(block,'#d3d8bb',x,height+.12,0,width+.16,.24,depth+.16);
        const rows=Math.floor(height/1.45), cols=3;
        const windows=new THREE.InstancedMesh(boxGeometry,material('#567c7b'),rows*cols);
        const helper=new THREE.Object3D(); let n=0;
        for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
          helper.position.set(side*(7.38),1.2+row*1.4,-depth*.29+col*depth*.29); helper.scale.set(.025,.72,.65); helper.updateMatrix(); windows.setMatrixAt(n++,helper.matrix);
        }
        block.add(windows);
        if(i%2===0) {
          box(block,'#486866',side*6.45,2.3,4,.11,4.6,.11);
          box(block,'#486866',side*5.9,4.6,4,1.2,.1,.12);
          box(block,'#f6efc4',side*5.35,4.53,4,.38,.08,.27);
          box(block,'#647b63',side*6.5,.43,1,.65,.75,.7);
        }
      }
    }
    this.bike=makeBike(); this.scene.add(this.bike);
    this.traffic=Array.from({length:C.poolSize},(_,slot)=>{
      const variants={}; for(const type of Object.keys(VEHICLES)) { const g=vehicle(type,['#e4dfbf','#c8946f','#75a4a5','#d5bd78','#849e90'][slot%5]); g.visible=false; this.scene.add(g); variants[type]=g; } return variants;
    });
    this.particles=Array.from({length:28},()=>{const mesh=new THREE.Mesh(sphereGeometry,material('#ffc369',true));mesh.visible=false;this.scene.add(mesh);return {mesh,life:0,vx:0,vy:0,vz:0};});
    this.effectTime=0; this.lastTime=0; this.lastDistance=0; this.smokeClock=0; this.pixelRatio=Math.min(devicePixelRatio,1.5); this.slowFrames=0;
    this.resize(); this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.dispatchEvent(new CustomEvent('renderer-lost'));});
  }
  resize() {
    const rect=this.renderer.domElement.parentElement.getBoundingClientRect(); if(!rect.width||!rect.height)return;
    this.camera.aspect=rect.width/rect.height;
    this.camera.fov=Math.max(50,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(22.5))/this.camera.aspect)));
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
    this.blocks.forEach((b,i)=>{b.position.z=((24-i*12+sim.distance+180)%216)-180;});
    this.bike.position.x=sim.x;
    const damage=this.bike.userData;
    damage.paint.material=material(sim.health===3?'#d6ef7c':sim.health===2?'#aeb773':'#7d8870');
    damage.scratches.visible=sim.health<3;damage.frontLight.visible=sim.health>1;
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
      const blink=Math.floor(v.changeTime/.25)%2===0;
      for(const {dir,lamp} of g.userData.lamps)lamp.visible=v.direction===dir&&blink;
      g.userData.arrow.visible=v.direction!==0;g.userData.arrow.rotation.z=v.direction===-1?Math.PI:0;
    }
    this.smokeClock+=dt;
    if(sim.health===1&&!sim.dead&&this.smokeClock>.12) {
      this.smokeClock=0; const p=this.particles.find(p=>p.life<=0);
      if(p){p.life=.7;p.mesh.visible=true;p.mesh.material=material('#80918a');p.mesh.position.set(sim.x,.9,.8);p.mesh.scale.setScalar(.12);p.vx=.15;p.vy=.7;p.vz=1.2;}
    }
    for(const p of this.particles)if(p.life>0){p.life-=dt;p.mesh.visible=p.life>0;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;}
    if(frameDt>.035)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);
    if(this.slowFrames>100&&this.pixelRatio>1){this.pixelRatio=1;this.renderer.setPixelRatio(1);this.slowFrames=0;}
    this.renderer.render(this.scene,this.camera);
  }
}
