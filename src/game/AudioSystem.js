export class AudioSystem {
  constructor(settings, systemEnabled = true) { this.settings=settings; this.systemEnabled=systemEnabled; this.context=null; }
  async unlock() {
    try {
      if(!this.context){
        this.context=new (window.AudioContext||window.webkitAudioContext)();
        this.master=this.context.createGain();this.master.gain.value=.18;this.master.connect(this.context.destination);
        this.engine=this.context.createOscillator();this.engine.type='sawtooth';
        this.engineGain=this.context.createGain();this.engineGain.gain.value=0;
        const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=280;
        this.engine.connect(filter);filter.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
      }
      if(this.systemEnabled)await this.context.resume();
    } catch { /* Audio is optional; gameplay stays available. */ }
  }
  tone(frequency,duration=.1,type='sine',gain=.3) {
    if(!this.systemEnabled||!this.context||this.context.state!=='running')return;
    const o=this.context.createOscillator(),g=this.context.createGain(),t=this.context.currentTime;
    o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(this.master);o.start();o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  effect(type) { if(!this.settings.sfx)return;this.tone(type==='hit'?65:type==='jump'?920:type==='near'?740:type==='coin'?1100:440,type==='hit'?.25:type==='jump'?.3:.12,type==='hit'?'sawtooth':'sine',.4); }
  update(sim,dt) {
    if(!this.systemEnabled||!this.context)return;
    this.engine.frequency.setTargetAtTime(40+sim.speed*2.2+sim.turbo*3,this.context.currentTime,.08);
    this.engineGain.gain.setTargetAtTime(this.settings.sfx ? .22 : 0,this.context.currentTime,.06);
  }
  pause() { if(this.context){this.engineGain.gain.setValueAtTime(0,this.context.currentTime);this.context.suspend().catch(()=>{});} }
  setSystemEnabled(enabled) { this.systemEnabled=enabled===true; if(!this.systemEnabled)this.pause(); }
}
