import { CONFIG as C, randomGenerator, steer } from './config.js';

export class CoinSystem {
  constructor(seed){this.items=Array.from({length:30},()=>({active:false,x:0,z:0}));this.reset(seed);}
  reset(seed){this.random=randomGenerator(seed^0x43a91);this.collected=0;this.clear();}
  clear(){for(const coin of this.items)coin.active=false;this.travel=0;}
  // Predict traffic at the pickup, including the full width of any lane change.
  safe(sim,x,z){
    const time=Math.max(0,-z/sim.speed);
    return !sim.vehicles.some(v=>{
      if(!v.active)return false;
      const min=Math.min(v.x,v.change!=='straight'?v.toX:v.x)-(v.width+C.bikeWidth)/2-.3;
      const max=Math.max(v.x,v.change!=='straight'?v.toX:v.x)+(v.width+C.bikeWidth)/2+.3;
      const future=v.z+(sim.speed-v.trafficSpeed)*time;
      return x>=min&&x<=max&&Math.abs(future)<(v.length+C.bikeLength)/2+sim.speed*.65;
    });
  }
  reachable(sim,x,z){
    const duration=-z/sim.speed;let position=sim.x;
    for(let t=.1;t<=duration;t+=.1){
      if(t>1)position=steer(position,x,.1);
      for(const v of sim.vehicles){if(!v.active)continue;
        const future=v.z+(sim.speed-v.trafficSpeed)*t;
        const min=Math.min(v.x,v.change!=='straight'?v.toX:v.x)-(v.width+C.bikeWidth)/2-.2;
        const max=Math.max(v.x,v.change!=='straight'?v.toX:v.x)+(v.width+C.bikeWidth)/2+.2;
        if(Math.abs(future)<(v.length+C.bikeLength)/2+2&&position>=min&&position<=max)return false;
      }
    }
    return Math.abs(position-x)<.45;
  }
  spawn(sim){
    const count=3+Math.floor(this.random()*3),first=Math.floor(this.random()*3),lanes=[-3.5,0,3.5];
    const slots=this.items.filter(c=>!c.active);if(slots.length<count)return false;
    for(let offset=0;offset<3;offset++){
      const x=lanes[(first+offset)%3],near=-Math.max(65,sim.speed*2.8);
      if(!this.reachable(sim,x,near))continue;
      if(!Array.from({length:count},(_,i)=>near-i*4).every(z=>this.safe(sim,x,z)))continue;
      for(let i=0;i<count;i++)Object.assign(slots[i],{active:true,x,z:near-i*4});return true;
    }
    return false;
  }
  update(sim,dt,oldX){
    for(const coin of this.items){
      if(!coin.active)continue;
      if(!this.safe(sim,coin.x,coin.z)){coin.active=false;continue;}
      const oldZ=coin.z;coin.z+=sim.speed*dt;
      if(oldZ<=0&&coin.z>0){
        const at=-oldZ/(coin.z-oldZ),x=oldX+(sim.x-oldX)*at;
        if(Math.abs(x-coin.x)<=.55){sim.score=Math.min(Number.MAX_SAFE_INTEGER,sim.score+20);sim.turbo=Math.min(C.maxTurbo,sim.turbo+C.coinBoost);this.collected++;sim.events.push({type:'coin',points:20});coin.active=false;}
      }
      if(coin.z>8)coin.active=false;
    }
    this.travel+=sim.speed*dt;
    if(this.travel>=100){this.travel=0;this.spawn(sim);}
  }
}
