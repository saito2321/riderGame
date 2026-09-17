import * as THREE from '../vendor/three.module.js';
import { batchParts } from './VisualAssets.js';

const metal=new THREE.MeshStandardMaterial({color:'#89949e',metalness:.85,roughness:.27});
const black=new THREE.MeshStandardMaterial({color:'#151b23',metalness:.25,roughness:.45});
const rubber=new THREE.MeshStandardMaterial({color:'#101317',metalness:0,roughness:.96});
const leather=new THREE.MeshStandardMaterial({color:'#202a35',metalness:0,roughness:.83});
const paint=new THREE.MeshStandardMaterial({color:'#95b630',metalness:.5,roughness:.25});
const helmetPaint=new THREE.MeshStandardMaterial({color:'#cfd4d8',metalness:.18,roughness:.3});
const visor=new THREE.MeshStandardMaterial({color:'#162837',metalness:.65,roughness:.12});
const red=new THREE.MeshBasicMaterial({color:'#ff2539'});
const white=new THREE.MeshBasicMaterial({color:'#e3f1ff'});
const gold=new THREE.MeshStandardMaterial({color:'#af8751',metalness:.8,roughness:.3});
const sphere=new THREE.SphereGeometry(1,16,10);
const cylinder=new THREE.CylinderGeometry(1,1,1,10);
const cube=new THREE.BoxGeometry(1,1,1);
const up=new THREE.Vector3(0,1,0);

function mesh(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1){
  const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
}
function link(parent,mat,a,b,radius,endRadius=radius){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const geometry=radius===endRadius?cylinder:new THREE.CylinderGeometry(endRadius/radius,1,1,10);
  const m=mesh(parent,geometry,mat,...start.clone().add(end).multiplyScalar(.5).toArray(),radius,delta.length(),radius);
  m.quaternion.setFromUnitVectors(up,delta.normalize());return m;
}
// Cross sections provide a continuous tank/fairing silhouette with a small vertex budget.
function shell(parent,mat,sections){
  const positions=[],uv=[],indices=[],segments=16;
  for(let row=0;row<sections.length;row++){
    const [z,y,rx,ry]=sections[row];
    for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI*2;positions.push(Math.cos(angle)*rx,y+Math.sin(angle)*ry,z);uv.push(i/segments,row/(sections.length-1));}
  }
  for(let row=0;row<sections.length-1;row++)for(let i=0;i<segments;i++){
    const a=row*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  return mesh(parent,g,mat,0,0,0);
}

function bikeWheel(parent,z,width){
  const g=new THREE.Group();g.position.set(0,.34,z);parent.add(g);
  const tire=mesh(g,new THREE.TorusGeometry(.265,.075,8,28),rubber,0,0,0,1,1,width/.15);tire.rotation.y=Math.PI/2;
  const rim=mesh(g,new THREE.TorusGeometry(.216,.018,6,24),metal,0,0,0);rim.rotation.y=Math.PI/2;
  link(g,black,[-width*.51,0,0],[width*.51,0,0],.056);
  for(let spoke=0;spoke<5;spoke++){
    const a=spoke*Math.PI*2/5;
    link(g,metal,[0,Math.sin(a)*.05,Math.cos(a)*.05],[0,Math.sin(a+.18)*.21,Math.cos(a+.18)*.21],.016);
  }
  for(const side of [-1,1]){
    const disc=mesh(g,new THREE.RingGeometry(.095,.175,24),metal,side*width*.38,0,0);disc.rotation.y=side*Math.PI/2;
  }
  batchParts(g,new Set());return g;
}

export function createBike(shadow){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);const groundShadow=shadow(root,.8,2.3);
  const wheels=[bikeWheel(g,-.76,.16),bikeWheel(g,.76,.21)];
  const tank=shell(g,paint,[[-.62,.99,.001,.001],[-.49,1.01,.17,.12],[-.28,1.04,.265,.19],[0,1.02,.24,.16],[.23,.99,.14,.085],[.3,.97,.001,.001]]);
  mesh(g,cylinder,metal,0,1.226,-.23,.052,.012,.052);
  // Narrow raised tail and split seat, exposing the rear wheel and swingarm.
  const tail=shell(g,paint,[[.2,.92,.001,.001],[.38,.95,.22,.085],[.65,1.01,.18,.075],[.95,1.055,.085,.04],[1.02,1.055,.001,.001]]);
  mesh(g,sphere,leather,0,1.025,.27,.185,.045,.25);
  mesh(g,sphere,leather,0,1.085,.66,.14,.032,.17);
  mesh(g,cube,red,0,1.054,1.025,.12,.025,.025);
  shell(g,paint,[[-.94,.94,.001,.001],[-.86,.99,.19,.16],[-.69,.93,.26,.23],[-.49,.78,.235,.23],[-.2,.61,.18,.09],[-.1,.61,.001,.001]]);
  mesh(g,sphere,black,0,.63,-.03,.19,.18,.24);
  for(let i=0;i<5;i++)mesh(g,cube,metal,0,.6+i*.035,-.02,.38,.013,.29);
  for(const side of [-1,1]){
    link(g,black,[side*.17,.78,-.43],[side*.18,.56,.29],.035);
    link(g,metal,[side*.16,.49,.13],[side*.12,.34,.76],.034);
    link(g,gold,[side*.13,1.08,-.57],[side*.13,.62,-.7],.031);
    link(g,metal,[side*.13,.62,-.7],[side*.13,.34,-.76],.025);
    mesh(g,cube,black,side*.105,.39,-.63,.055,.11,.1);
    link(g,metal,[side*.14,1.15,-.52],[side*.33,1.17,-.56],.021);
    link(g,rubber,[side*.33,1.17,-.56],[side*.43,1.17,-.56],.032);
    link(g,black,[side*.2,1.17,-.73],[side*.4,1.34,-.78],.015);
    mesh(g,sphere,visor,side*.41,1.35,-.78,.075,.043,.027);
    mesh(g,sphere,black,side*.24,.88,-.42,.035,.08,.145);
    link(g,metal,[side*.16,.53,.24],[side*.3,.53,.24],.018);
  }
  const frontLight=mesh(g,cube,white,0,1.015,-.867,.24,.036,.03);frontLight.rotation.x=-.2;
  shell(g,visor,[[-.89,1.11,.001,.001],[-.8,1.23,.145,.075],[-.61,1.34,.115,.026],[-.57,1.34,.001,.001]]);
  shell(g,black,[[-1.02,.53,.001,.001],[-.94,.62,.085,.023],[-.76,.697,.102,.018],[-.56,.62,.09,.025],[-.48,.54,.001,.001]]);
  link(g,metal,[.12,.54,-.23],[.28,.42,.38],.035);
  const exhaust=link(g,metal,[.29,.46,.4],[.32,.56,.94],.066,.049);
  link(g,black,[.32,.56,.938],[.323,.566,.973],.041);
  link(g,black,[0,.9,.76],[0,.66,.97],.02);
  const plate=mesh(g,cube,metal,0,.69,.98,.15,.095,.014);plate.rotation.x=-.25;
  // Bent knees and elbows, fitted leather suit and a full-face helmet.
  mesh(g,sphere,leather,0,1.13,.28,.205,.15,.18);
  const torso=mesh(g,sphere,leather,0,1.41,.015,.255,.335,.165);torso.rotation.x=-.57;
  const back=mesh(g,sphere,black,0,1.46,.13,.16,.235,.058);back.rotation.x=-.57;
  const trim=mesh(g,cube,metal,0,1.57,.075,.24,.028,.018);trim.rotation.x=-.57;
  for(const side of [-1,1]){
    const shoulder=[side*.225,1.59,-.14],elbow=[side*.33,1.34,-.26],hand=[side*.36,1.2,-.55];
    link(g,leather,shoulder,elbow,.083,.066);link(g,leather,elbow,hand,.065,.046);
    mesh(g,sphere,black,...shoulder,.09,.1,.095);mesh(g,sphere,black,...hand,.057,.055,.075);
    const hip=[side*.16,1.13,.3],knee=[side*.285,.88,-.12],ankle=[side*.255,.55,.28];
    link(g,leather,hip,knee,.108,.084);link(g,leather,knee,ankle,.078,.055);
    mesh(g,sphere,black,...knee,.087,.095,.09);
    const boot=mesh(g,sphere,black,side*.255,.52,.19,.067,.074,.16);boot.rotation.x=.12;
  }
  mesh(g,sphere,black,0,1.72,-.28,.085,.1,.085);
  const helmet=mesh(g,sphere,helmetPaint,0,1.83,-.37,.218,.245,.25);helmet.rotation.x=-.17;
  const face=mesh(g,sphere,visor,0,1.85,-.505,.197,.115,.142);face.rotation.x=-.17;
  mesh(g,sphere,black,0,1.69,-.49,.159,.057,.131);
  mesh(g,cube,metal,0,1.8,-.12,.15,.027,.014);
  mesh(g,cube,black,0,1.89,-.125,.115,.018,.02);
  const flame=mesh(g,new THREE.ConeGeometry(.09,.65,7),new THREE.MeshBasicMaterial({color:'#9bf5ff'}),.32,.56,1.23);flame.rotation.x=Math.PI/2;flame.visible=false;
  const scratches=mesh(g,cube,metal,.253,1.03,-.22,.008,.019,.16);scratches.visible=false;
  batchParts(g,new Set([tank,tail,frontLight,exhaust,flame,scratches]));
  root.userData={wheels,paint:tank,healthyPaint:paint,tail,frontLight,exhaust,flame,scratches,visual:g,groundShadow};return root;
}


// Traffic uses a compact orange commuter with an upright rider and rear cargo box.
// Geometry/materials are shared by the pooled clones, never rebuilt during a run.
export function createTrafficBike(shadow){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);shadow(root,.8,2.3);
  const orange=new THREE.MeshStandardMaterial({color:'#d56525',metalness:.3,roughness:.37});
  const jacket=new THREE.MeshStandardMaterial({color:'#775847',roughness:.95});
  bikeWheel(g,-.72,.17);bikeWheel(g,.72,.2);
  shell(g,orange,[[-.9,.75,.001,.001],[-.75,.82,.24,.29],[-.53,.78,.25,.3],[-.3,.6,.16,.12],[.4,.64,.23,.13],[.82,.65,.17,.13],[.96,.65,.001,.001]]);
  mesh(g,sphere,leather,0,.88,.23,.23,.07,.43);
  for(const side of [-1,1]){
    link(g,metal,[side*.12,.99,-.56],[side*.12,.34,-.72],.027);
    link(g,black,[side*.14,.55,.05],[side*.12,.34,.72],.035);
    link(g,black,[side*.12,1.15,-.51],[side*.35,1.15,-.51],.025);
    link(g,metal,[side*.28,1.15,-.54],[side*.36,1.4,-.57],.014);
    mesh(g,sphere,visor,side*.36,1.4,-.57,.065,.05,.025);
    link(g,jacket,[side*.21,1.52,-.02],[side*.29,1.27,-.17],.08);
    link(g,jacket,[side*.29,1.27,-.17],[side*.33,1.16,-.5],.064);
    mesh(g,sphere,black,side*.33,1.16,-.5,.05,.05,.07);
    link(g,leather,[side*.13,1.03,.28],[side*.24,.75,-.13],.092);
    link(g,leather,[side*.24,.75,-.13],[side*.24,.46,-.02],.067);
    mesh(g,sphere,black,side*.24,.43,-.1,.065,.065,.14);
  }
  mesh(g,sphere,orange,0,1.13,-.63,.19,.14,.12);
  mesh(g,sphere,white,0,1.14,-.738,.085,.085,.018);
  mesh(g,sphere,jacket,0,1.31,.19,.235,.34,.17);
  mesh(g,sphere,black,0,1.77,.1,.22,.25,.25);
  mesh(g,sphere,visor,0,1.8,-.08,.195,.11,.09);
  // Broad rectangular top box clearly distinguishes its rear silhouette.
  mesh(g,cube,black,0,1.04,.74,.54,.32,.38);
  mesh(g,cube,orange,0,1.19,.74,.55,.04,.39);
  mesh(g,cube,red,0,1.06,.937,.36,.035,.018);
  mesh(g,cube,metal,0,.61,.965,.15,.09,.015);
  link(g,metal,[.28,.43,.3],[.28,.45,.9],.052);
  batchParts(g,new Set());return root;
}
