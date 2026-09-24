import * as THREE from '../vendor/three.module.js';
import { createBike, createScooter, createSuperSport, createHorse, createRobotVacuum } from './BikeModel.js';

const factories={street:createBike,scooter:createScooter,supersport:createSuperSport,horse:createHorse,robovac:createRobotVacuum};

export class MachinePreview{
  constructor(canvas){
    this.canvas=canvas;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.1,30);
    this.camera.position.set(3.6,2.35,4.6);this.camera.lookAt(0,0,0);
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight('#ffffff','#61716b',2.4));
    const key=new THREE.DirectionalLight('#fff7e3',3.2);key.position.set(-3,5,4);this.scene.add(key);
    const rim=new THREE.DirectionalLight('#b9e8ff',1.7);rim.position.set(4,2,-4);this.scene.add(rim);
    this.turntable=new THREE.Group();this.scene.add(this.turntable);
    this.models=new Map();this.lockedMaterial=new THREE.MeshBasicMaterial({color:'#090b0b'});
    const noShadow=()=>{const shadow=new THREE.Object3D();shadow.visible=false;return shadow;};
    for(const [id,create] of Object.entries(factories)){
      const model=create(noShadow),materials=new Map();model.traverse(part=>{if(part.isMesh)materials.set(part,part.material);});
      model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
      const scale=Math.min(2.05/size.y,2.8/Math.max(size.x,size.z));model.scale.setScalar(scale);model.position.copy(center).multiplyScalar(-scale);model.visible=false;
      this.turntable.add(model);this.models.set(id,{model,materials});
    }
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
    this.active=true;this.frame=0;this.lastTime=0;this.animate=this.animate.bind(this);this.frame=requestAnimationFrame(this.animate);
  }
  resize(){
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    // A hidden title has a 0 x 0 canvas. Keep the last valid viewport instead of collapsing it to 1 x 1.
    if(width<2||height<2)return false;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    return true;
  }
  setMachine(id,locked){
    for(const [machineId,entry] of this.models){
      entry.model.visible=machineId===id;if(machineId!==id)continue;
      for(const [part,material] of entry.materials)part.material=locked?this.lockedMaterial:material;
      entry.model.userData.flame.visible=false;entry.model.userData.scratches.visible=false;
    }
    this.turntable.rotation.y=-.5;this.render();
  }
  setActive(active){
    this.active=active;
    if(active){this.resize();this.render();}
    if(active&&!this.frame){this.lastTime=0;this.frame=requestAnimationFrame(this.animate);}
  }
  animate(time){
    this.frame=0;if(!this.active)return;const dt=this.lastTime?Math.min((time-this.lastTime)/1000,.05):0;this.lastTime=time;this.turntable.rotation.y+=dt*.65;
    const entry=[...this.models.values()].find(({model})=>model.visible);
    for(const brush of entry?.model.userData.brushes??[])brush.rotation.y+=dt*5;
    for(const leg of entry?.model.userData.legs??[])leg.rotation.x=Math.sin(time*.004+leg.userData.phase)*.25;
    this.render();this.frame=requestAnimationFrame(this.animate);
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
