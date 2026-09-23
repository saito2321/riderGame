import * as THREE from '../vendor/three.module.js';
import { batchParts } from './VisualAssets.js';

const metal=new THREE.MeshStandardMaterial({color:'#89949e',metalness:.85,roughness:.27});
const black=new THREE.MeshStandardMaterial({color:'#151b23',metalness:.25,roughness:.45});
const rubber=new THREE.MeshStandardMaterial({color:'#101317',metalness:0,roughness:.96});
const leather=new THREE.MeshStandardMaterial({color:'#202a35',metalness:0,roughness:.83});
const paint=new THREE.MeshStandardMaterial({color:'#95b630',metalness:.5,roughness:.25});
const scooterPaint=new THREE.MeshStandardMaterial({color:'#35c8ba',metalness:.42,roughness:.28});
const superSportPaint=new THREE.MeshStandardMaterial({color:'#e34c36',metalness:.55,roughness:.22});
const horseCoat=new THREE.MeshStandardMaterial({color:'#9a5b32',metalness:0,roughness:.86});
const horseDark=new THREE.MeshStandardMaterial({color:'#321f19',metalness:0,roughness:.94});
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
  root.userData={machineType:'street',wheels,paint:tank,healthyPaint:paint,tail,frontLight,exhaust,flame,scratches,visual:g,groundShadow};return root;
}

export function createScooter(shadow){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);const groundShadow=shadow(root,.86,2.15);
  const wheels=[bikeWheel(g,-.68,.18),bikeWheel(g,.68,.18)];
  // Rounded rear body, low step-through floor and a tall front apron define the scooter silhouette.
  const body=shell(g,scooterPaint,[[.02,.66,.001,.001],[.18,.75,.29,.22],[.48,.83,.32,.27],[.82,.79,.26,.22],[.94,.7,.001,.001]]);
  const tail=shell(g,scooterPaint,[[.28,.9,.001,.001],[.48,.98,.3,.13],[.76,1.01,.28,.12],[.96,.94,.13,.08],[1.01,.9,.001,.001]]);
  mesh(g,cube,black,0,.53,-.02,.31,.055,.72);
  mesh(g,cube,metal,0,.575,-.11,.26,.018,.55);
  const apron=shell(g,scooterPaint,[[-.83,.57,.001,.001],[-.73,.72,.27,.18],[-.62,1.02,.3,.28],[-.55,1.3,.24,.16],[-.49,1.36,.001,.001]]);
  mesh(g,sphere,leather,0,1.045,.48,.27,.07,.41);
  mesh(g,cube,red,0,.92,.955,.17,.04,.025);
  for(const side of [-1,1]){
    link(g,metal,[side*.13,.82,-.54],[side*.13,.34,-.68],.03);
    link(g,black,[side*.17,.62,.3],[side*.13,.34,.68],.034);
    link(g,metal,[side*.13,1.34,-.57],[side*.34,1.42,-.61],.022);
    link(g,rubber,[side*.33,1.42,-.61],[side*.45,1.42,-.61],.032);
    link(g,black,[side*.26,1.42,-.6],[side*.39,1.62,-.62],.014);
    mesh(g,sphere,visor,side*.4,1.63,-.62,.07,.047,.026);
    mesh(g,sphere,black,side*.25,.78,-.47,.035,.11,.12);
  }
  const frontLight=mesh(g,sphere,white,0,1.19,-.724,.18,.12,.04);
  shell(g,visor,[[-.67,1.31,.001,.001],[-.6,1.49,.2,.12],[-.51,1.58,.15,.04],[-.47,1.58,.001,.001]]);
  link(g,metal,[.2,.47,.39],[.28,.49,.87],.06,.045);
  const exhaust=link(g,metal,[.28,.49,.57],[.3,.53,.94],.062,.045);
  link(g,black,[.3,.53,.935],[.302,.534,.976],.037);
  const plate=mesh(g,cube,metal,0,.66,.98,.15,.09,.014);plate.rotation.x=-.22;
  // An upright rider with feet on the floorboard reinforces the commuter posture.
  mesh(g,sphere,leather,0,1.15,.43,.22,.14,.2);
  const torso=mesh(g,sphere,leather,0,1.47,.27,.255,.34,.18);torso.rotation.x=-.16;
  const back=mesh(g,sphere,black,0,1.48,.42,.17,.24,.06);back.rotation.x=-.16;
  for(const side of [-1,1]){
    const shoulder=[side*.23,1.63,.18],elbow=[side*.34,1.48,-.14],hand=[side*.4,1.42,-.55];
    link(g,leather,shoulder,elbow,.082,.065);link(g,leather,elbow,hand,.063,.045);mesh(g,sphere,black,...hand,.055,.052,.07);
    const hip=[side*.16,1.14,.46],knee=[side*.25,.91,.08],ankle=[side*.24,.66,-.22];
    link(g,leather,hip,knee,.105,.083);link(g,leather,knee,ankle,.078,.055);
    mesh(g,sphere,black,side*.24,.62,-.3,.07,.065,.16);
  }
  mesh(g,sphere,black,0,1.77,.19,.085,.1,.085);
  const helmet=mesh(g,sphere,helmetPaint,0,1.91,.12,.22,.245,.25);helmet.rotation.x=-.04;
  const face=mesh(g,sphere,visor,0,1.93,-.025,.2,.115,.14);face.rotation.x=-.04;
  mesh(g,sphere,black,0,1.77,-.01,.16,.056,.13);
  const flame=mesh(g,new THREE.ConeGeometry(.085,.58,7),new THREE.MeshBasicMaterial({color:'#9bf5ff'}),.3,.53,1.22);flame.rotation.x=Math.PI/2;flame.visible=false;
  const scratches=mesh(g,cube,metal,.273,.83,.24,.008,.018,.17);scratches.visible=false;
  batchParts(g,new Set([body,tail,frontLight,exhaust,flame,scratches]));
  root.userData={machineType:'scooter',wheels,paint:body,healthyPaint:scooterPaint,tail,frontLight,exhaust,flame,scratches,visual:g,groundShadow};return root;
}

export function createSuperSport(shadow){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);const groundShadow=shadow(root,.9,2.4);
  const wheels=[bikeWheel(g,-.8,.19),bikeWheel(g,.8,.22)];
  // A continuous nose-to-engine fairing and enclosed belly pan create the full-cowl silhouette.
  const fairing=shell(g,superSportPaint,[[-1.02,.8,.001,.001],[-.91,.91,.24,.2],[-.7,.89,.34,.32],[-.42,.72,.38,.34],[-.02,.62,.36,.27],[.3,.67,.3,.2],[.47,.78,.17,.1],[.52,.81,.001,.001]]);
  const tank=shell(g,superSportPaint,[[-.52,1.05,.001,.001],[-.36,1.12,.24,.16],[-.08,1.13,.3,.19],[.2,1.05,.23,.14],[.32,.98,.001,.001]]);
  const tail=shell(g,superSportPaint,[[.18,.98,.001,.001],[.43,1.03,.24,.1],[.73,1.13,.19,.075],[1.02,1.2,.07,.035],[1.08,1.2,.001,.001]]);
  mesh(g,sphere,leather,0,1.08,.35,.2,.045,.27);mesh(g,sphere,leather,0,1.17,.72,.14,.03,.16);
  mesh(g,cube,black,0,.5,-.06,.35,.08,.82);mesh(g,cube,red,0,1.18,1.07,.13,.026,.024);
  for(const side of [-1,1]){
    link(g,gold,[side*.15,1.02,-.65],[side*.14,.35,-.8],.033);link(g,metal,[side*.14,.65,-.73],[side*.14,.35,-.8],.026);
    link(g,black,[side*.18,.6,.22],[side*.14,.35,.8],.035);
    link(g,metal,[side*.14,1.2,-.58],[side*.32,1.18,-.65],.02);link(g,rubber,[side*.31,1.18,-.65],[side*.42,1.17,-.68],.029);
    link(g,black,[side*.22,1.24,-.7],[side*.38,1.37,-.76],.014);mesh(g,sphere,visor,side*.39,1.38,-.76,.075,.04,.025);
    mesh(g,cube,white,side*.13,.91,-.966,.09,.035,.018);
  }
  const frontLight=mesh(g,cube,white,0,.93,-1.002,.23,.035,.02);frontLight.rotation.x=-.22;
  const screen=shell(g,visor,[[-.88,1.05,.001,.001],[-.76,1.25,.2,.11],[-.57,1.43,.15,.04],[-.51,1.43,.001,.001]]);
  link(g,metal,[.18,.48,.15],[.3,.46,.88],.062,.045);const exhaust=link(g,metal,[.3,.46,.5],[.33,.55,1.02],.067,.047);link(g,black,[.33,.55,1.015],[.334,.557,1.06],.04);
  mesh(g,cube,metal,0,.72,1.04,.15,.09,.014).rotation.x=-.25;
  // Tucked elbows, raised knees and a low helmet give the supersport its racing posture.
  mesh(g,sphere,leather,0,1.14,.32,.2,.13,.18);
  const torso=mesh(g,sphere,leather,0,1.43,.02,.25,.31,.18);torso.rotation.x=-.72;
  const back=mesh(g,sphere,black,0,1.46,.17,.17,.22,.06);back.rotation.x=-.72;
  for(const side of [-1,1]){
    const shoulder=[side*.22,1.56,-.18],elbow=[side*.34,1.31,-.34],hand=[side*.36,1.18,-.62];link(g,leather,shoulder,elbow,.08,.063);link(g,leather,elbow,hand,.061,.044);mesh(g,sphere,black,...hand,.052,.05,.07);
    const hip=[side*.16,1.13,.37],knee=[side*.3,.87,-.08],ankle=[side*.27,.53,.28];link(g,leather,hip,knee,.105,.082);link(g,leather,knee,ankle,.077,.054);mesh(g,sphere,black,side*.27,.5,.18,.067,.07,.16);
  }
  mesh(g,sphere,black,0,1.64,-.36,.082,.09,.08);
  const helmet=mesh(g,sphere,helmetPaint,0,1.72,-.49,.215,.235,.245);helmet.rotation.x=-.26;
  const face=mesh(g,sphere,visor,0,1.73,-.62,.195,.105,.14);face.rotation.x=-.26;
  const flame=mesh(g,new THREE.ConeGeometry(.09,.7,7),new THREE.MeshBasicMaterial({color:'#9bf5ff'}),.334,.557,1.34);flame.rotation.x=Math.PI/2;flame.visible=false;
  const scratches=mesh(g,cube,metal,.355,.79,-.24,.008,.021,.2);scratches.visible=false;
  batchParts(g,new Set([fairing,tail,frontLight,exhaust,flame,scratches]));
  root.userData={machineType:'supersport',wheels,paint:fairing,healthyPaint:superSportPaint,tail,frontLight,exhaust,flame,scratches,visual:g,groundShadow,screen};return root;
}

export function createHorse(shadow){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);const groundShadow=shadow(root,.92,2.35);
  const body=shell(g,horseCoat,[[-.66,.96,.001,.001],[-.5,1.02,.32,.31],[.05,1.05,.4,.34],[.53,1.02,.33,.3],[.7,.94,.001,.001]]);
  // The neck rises toward the road while the head, muzzle, mane and ears keep a readable horse profile from behind.
  link(g,horseCoat,[0,1.12,-.45],[0,1.48,-.76],.23,.16);
  const head=mesh(g,sphere,horseCoat,0,1.59,-.84,.22,.28,.3);head.rotation.x=-.18;
  const muzzle=mesh(g,sphere,horseDark,0,1.5,-1.08,.17,.14,.24);muzzle.rotation.x=-.18;
  for(const side of [-1,1]){
    const ear=mesh(g,new THREE.ConeGeometry(.065,.25,7),horseCoat,side*.11,1.91,-.77);ear.rotation.x=-.18;
    mesh(g,sphere,black,side*.13,1.68,-1.01,.032,.038,.025);
  }
  for(let i=0;i<5;i++){const mane=mesh(g,new THREE.ConeGeometry(.075,.28,6),horseDark,0,1.4+i*.09,-.55-i*.055);mane.rotation.x=-.65;}
  mesh(g,sphere,leather,0,1.3,.12,.31,.055,.38);mesh(g,cube,gold,0,1.27,.12,.35,.025,.42);
  const legs=[];
  for(const [index,z] of [-.43,.43].entries())for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.24,.94,z);g.add(leg);
    link(leg,horseCoat,[0,0,0],[0,-.48,index?-.05:.08],.095,.07);link(leg,horseDark,[0,-.46,index?-.05:.08],[0,-.82,index?.06:-.02],.066,.045);
    mesh(leg,cube,black,0,-.84,index?.08:-.04,.075,.055,.13);leg.userData.phase=(index*2+(side>0?1:0))*Math.PI/2;legs.push(leg);
  }
  const tail=new THREE.Group();tail.position.set(0,1.17,.64);g.add(tail);link(tail,horseDark,[0,0,0],[0,-.22,.28],.075,.045);link(tail,horseDark,[0,-.2,.27],[0,-.5,.42],.055,.025);
  // A rider and helmet retain the same player identity while sitting upright in the saddle.
  mesh(g,sphere,leather,0,1.37,.15,.2,.13,.18);
  const torso=mesh(g,sphere,leather,0,1.61,.04,.245,.31,.17);torso.rotation.x=-.18;
  for(const side of [-1,1]){
    link(g,leather,[side*.21,1.73,-.03],[side*.27,1.5,-.38],.078,.06);link(g,leather,[side*.27,1.5,-.38],[side*.17,1.45,-.7],.059,.042);mesh(g,sphere,black,side*.17,1.45,-.7,.05,.05,.065);
    link(g,leather,[side*.15,1.4,.18],[side*.28,1.1,.02],.102,.078);link(g,leather,[side*.28,1.1,.02],[side*.25,.79,.28],.075,.052);mesh(g,sphere,black,side*.25,.76,.2,.065,.06,.15);
  }
  const helmet=mesh(g,sphere,helmetPaint,0,2.03,-.08,.21,.235,.235);helmet.rotation.x=-.06;
  const face=mesh(g,sphere,visor,0,2.04,-.21,.19,.105,.13);face.rotation.x=-.06;
  const frontLight=mesh(g,cube,white,0,1.76,-1.065,.07,.11,.015);frontLight.rotation.x=-.18;
  const exhaust=mesh(g,sphere,horseDark,0,1.02,.69,.08,.08,.08);
  const flame=mesh(g,new THREE.ConeGeometry(.09,.62,7),new THREE.MeshBasicMaterial({color:'#9bf5ff'}),0,1.02,1.05);flame.rotation.x=Math.PI/2;flame.visible=false;
  const scratches=mesh(g,cube,metal,.36,1.05,.08,.008,.02,.2);scratches.visible=false;
  batchParts(g,new Set([body,tail,frontLight,exhaust,flame,scratches]));
  root.userData={machineType:'horse',wheels:[],legs,paint:body,healthyPaint:horseCoat,tail,frontLight,exhaust,flame,scratches,visual:g,groundShadow};return root;
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
