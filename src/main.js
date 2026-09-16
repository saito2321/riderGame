import { Simulation } from './game/Simulation.js';
import { CONFIG as C, multiplier, clamp } from './game/config.js';
import { Input } from './game/Input.js';
import { AudioSystem } from './game/AudioSystem.js';
import { LocalAdapter } from './platform/LocalAdapter.js';

const $=s=>document.querySelector(s);
const platform=new LocalAdapter(),save=platform.load(),sim=new Simulation();
const audio=new AudioSystem(save.settings);
const canvas=$('#game-canvas'),stage=$('#game-stage'),overlay=$('#game-overlay'),modal=$('#modal');
const input=new Input(canvas,()=>sim.x);
let strings={},world,state='title',paused=false,remaining=0,previousTime=0,accumulator=0,toastTimer=0,impactTimer=0,recordAtStart=0;
let rewardId=0,pendingRewardResult=null,returnFocus=null,seed=Number(new URLSearchParams(location.search).get('seed')||12345)>>>0;
const t=key=>strings[key]??key;
const number=n=>Math.floor(n).toLocaleString('en-US');
function element(tag,text,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
function button(key,callback,secondary=false){const b=element('button',t(key),secondary?'option-button':'play-button');b.addEventListener('click',callback);return b;}
function motion(){document.documentElement.classList.toggle('reduce-motion',save.settings.reduceMotion);}
function updateBest(){$('#high-score').textContent=number(save.bestScore);}
function showToast(text){$('#toast').textContent=text;toastTimer=1.35;$('#toast').classList.add('visible');}
function clearEffects(){toastTimer=0;impactTimer=0;$('#toast').textContent='';$('#toast').classList.remove('visible');$('#impact').style.opacity=0;}
function saveNow(){platform.record(sim);platform.save(true);updateBest();}
function setActive(){input.setEnabled(state==='playing'&&!paused);$('#pause-button').hidden=!['playing','countdown'].includes(state);}
function panel(title){overlay.replaceChildren();overlay.hidden=false;const p=document.createElement('div');p.className='game-panel';p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-labelledby','game-panel-title');const heading=element('h2',title);heading.id='game-panel-title';p.append(heading);overlay.append(p);return p;}
function renderPanel(){
  overlay.hidden=true;
  if(paused){const p=panel(t('ui.paused'));p.append(button('ui.resume',resume));p.querySelector('button').focus();return;}
  if(state==='countdown'){
    overlay.hidden=false;overlay.replaceChildren(element('strong',remaining>.45?String(Math.ceil(remaining-.45)):t('ui.go'),'countdown'));return;
  }
  if(state==='reward'){
    const p=panel(t('revive.title'));p.append(element('p',t('revive.detail'),'modal-copy'));
    p.append(button('revive.success',()=>platform.resolveRevive(true)),button('revive.cancel',()=>platform.resolveRevive(false),true));
    p.querySelector('button').focus();return;
  }
  if(state==='result'){
    const p=panel(t('result.title'));
    if(Math.floor(sim.score)>recordAtStart)p.append(element('p',t('result.newBest'),'new-best'));
    const stats=document.createElement('dl');stats.className='result-stats';
    for(const [key,value] of [['score',number(sim.score)],['best',number(save.bestScore)],['distance',`${number(sim.distance)} m`],['combo',number(sim.bestCombo)],['near',number(sim.nearMisses)]]){
      stats.append(element('dt',t(`result.${key}`)),element('dd',value));
    }
    p.append(stats);
    if(!platform.writable||platform.saveFailed)p.append(element('p',t(platform.writable?'save.failed':'save.unavailable'),'save-note'));
    p.append(button('ui.retry',()=>startRun(false)));
    if(!sim.revived){p.append(button('revive.offer',requestRevive,true),element('p',t('revive.hint'),'revive-hint'));}
    p.append(button('ui.title',goTitle,true));p.querySelector('button').focus();
  }
}
function pause(){
  if(paused||!['playing','countdown','reward'].includes(state))return;
  paused=true;input.setEnabled(false);audio.pause();saveNow();accumulator=0;renderPanel();
}
function resume(){
  paused=false;previousTime=0;accumulator=0;if(['playing','countdown'].includes(state))audio.unlock();
  if(pendingRewardResult!==null){const result=pendingRewardResult;pendingRewardResult=null;finishReward(result);}
  setActive();renderPanel();if(state==='playing')canvas.focus();
}
function countdown(){state='countdown';remaining=3.45;accumulator=0;previousTime=0;setActive();renderPanel();}
async function requestRevive(){
  if(state!=='result'||sim.revived)return;
  state='reward';setActive();audio.pause();const token=++rewardId;renderPanel();
  const earned=await platform.requestRevive();
  if(token!==rewardId||state!=='reward')return;
  if(paused)pendingRewardResult=earned;else finishReward(earned);
}
function finishReward(earned){
  if(earned===true&&sim.revive()){audio.unlock();clearEffects();countdown();}
  else{state='result';renderPanel();}
}
function goTitle(){
  rewardId++;platform.resolveRevive(false);pendingRewardResult=null;paused=false;state='title';input.setEnabled(false);audio.pause();saveNow();
  stage.hidden=true;$('.title-screen').hidden=false;$('.game-shell').classList.remove('in-game');overlay.hidden=true;$('#play').focus();
}
async function startRun(first=true){
  if(state==='loading')return;
  state='loading';$('#play').disabled=true;$('#play').textContent=t('ui.loading');
  await audio.unlock();
  try{
    if(!world){const {World}=await import('./game/World.js');world=new World(canvas);}
    rewardId++;platform.resolveRevive(false);pendingRewardResult=null;paused=false;recordAtStart=save.bestScore;
    sim.reset(seed);input.clear();clearEffects();
    $('.title-screen').hidden=true;stage.hidden=false;$('.game-shell').classList.add('in-game');world.resize();world.render(sim,save.settings);updateHUD();
    if(first&&!save.tutorialCompleted){state='tutorial';setActive();showTutorial();}else countdown();
  }catch(error){console.error(error);state='title';openError('error.title','error.detail');}
  finally{$('#play').disabled=false;$('#play').textContent=t('ui.play');}
}
function openModal(title){
  returnFocus=document.activeElement;$('#modal-title').textContent=t(title);$('#modal-kicker').textContent='';$('#modal-content').replaceChildren();
  $('#modal-action').hidden=false;$('#close-modal').hidden=false;
  if(!modal.open)modal.showModal();
}
function showTutorial(){
  openModal('tutorial.title');$('#close-modal').hidden=true;
  const demo=element('div','← ◇ →','swipe-demo');demo.setAttribute('aria-hidden','true');$('#modal-content').append(demo);
  const list=document.createElement('ol');list.className='steps';
  for(const key of ['tutorial.move','tutorial.near','tutorial.combo'])list.append(element('li',t(key)));
  $('#modal-content').append(list,element('p',t('tutorial.keyboard'),'modal-copy'));
  $('#modal-action').textContent=t('tutorial.start');$('#modal-action').onclick=()=>{platform.completeTutorial();countdown();modal.close();};$('#modal-action').focus();
}
function showSettings(){
  openModal('ui.settings');$('#modal-kicker').textContent=t('settings.kicker');
  for(const key of Object.keys(save.settings)){
    const label=document.createElement('label');label.className='setting-row';const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=save.settings[key];
    toggle.addEventListener('change',()=>{platform.setSetting(key,toggle.checked);motion();});label.append(element('span',t(`settings.${key}`)),toggle);$('#modal-content').append(label);
  }
  const label=document.createElement('label');label.className='seed-row';const field=document.createElement('input');field.type='number';field.min=0;field.max=4294967295;field.step=1;field.value=seed;
  field.addEventListener('change',()=>{if(field.validity.valid&&field.value!=='')seed=Number(field.value)>>>0;else field.value=seed;});
  label.append(element('span',t('settings.seed')),field);$('#modal-content').append(label,element('p',t('settings.seedHint'),'modal-copy'));
  if(!platform.writable||platform.saveFailed)$('#modal-content').append(element('p',t(platform.writable?'save.failed':'save.unavailable'),'save-note'));
  $('#modal-action').textContent=t('ui.done');$('#modal-action').onclick=()=>modal.close();$('#modal-action').focus();
}
function openError(title,detail){openModal(title);$('#modal-content').append(element('p',t(detail),'modal-copy'));$('#modal-action').textContent=t('error.reload');$('#modal-action').onclick=()=>location.reload();}
function updateHUD(){
  $('#health').textContent=sim.health>1?'♥':'';$('#health').ariaLabel=`${t('hud.health')} ${sim.health} / ${C.health}`;
  $('#score').textContent=number(sim.score);$('#hud-best').textContent=`${t('hud.best')} ${number(save.bestScore)}`;
  $('#combo').textContent=sim.combo?`×${sim.combo}`:'—';$('#multiplier').textContent=`×${multiplier(sim.combo).toFixed(1)}`;
  $('#combo-timer').style.transform=`scaleX(${sim.combo?clamp(1-(sim.time-sim.lastNear)/3,0,1):0})`;
  $('#turbo-label').textContent=sim.turbo>.05?`${t(sim.turbo>=7.99?'hud.maxTurbo':'hud.turbo')} +${sim.turbo.toFixed(1)}`:'';
  $('#speed').textContent=Math.round(sim.speed*3.6);$('#distance').textContent=`${number(sim.distance)} m`;
  stage.classList.toggle('turbo',sim.turbo>.05);
}
function frame(timestamp){
  requestAnimationFrame(frame);
  const dt=previousTime?Math.min((timestamp-previousTime)/1000,.1):0;previousTime=timestamp;
  if(paused||!world||!['playing','countdown','tutorial'].includes(state))return;
  if(state==='countdown'){
    const old=Math.ceil(remaining-.45);remaining-=dt;
    if(Math.ceil(remaining-.45)!==old)audio.effect('count');
    renderPanel();if(remaining<=0){state='playing';overlay.hidden=true;setActive();canvas.focus();}
  }else if(state==='playing'){
    accumulator+=dt;
    while(accumulator>=C.step){
      sim.step(C.step,input);accumulator-=C.step;
      for(const event of sim.events){
        if(event.type==='near'){showToast(`${t(event.tier===300?'hud.veryClose':'hud.near')} +${event.points}`);audio.effect('near');}
        if(event.type==='speed')showToast(t('hud.speedUp'));
        if(event.type==='hit'){world.burst(sim.x);impactTimer=.3;audio.effect('hit');if(save.settings.haptics&&navigator.vibrate)navigator.vibrate(60);}
        if(event.type==='dead'){saveNow();state='result';setActive();audio.pause();renderPanel();break;}
      }
      if(state!=='playing'){accumulator=0;break;}
    }
    platform.record(sim);platform.save();
    if(state==='playing')audio.update(sim,dt);
  }
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('visible');}
  impactTimer=Math.max(0,impactTimer-dt);$('#impact').style.opacity=save.settings.reduceMotion?0:impactTimer*1.7;
  updateHUD();world.render(sim,save.settings,dt);
}
async function init(){
  const response=await fetch('./locales/en.json');if(!response.ok)throw new Error('Locale load failed');strings=await response.json();
  document.querySelectorAll('[data-i18n]').forEach(e=>{e.textContent=t(e.dataset.i18n);});
  updateBest();motion();$('#close-modal').ariaLabel=t('ui.close');
  $('#play').addEventListener('click',()=>startRun());$('#settings').addEventListener('click',showSettings);$('#pause-button').addEventListener('click',pause);
  $('#close-modal').addEventListener('click',()=>modal.close());
  modal.addEventListener('close',()=>{if(state==='tutorial'){goTitle();return;}if(state==='title')returnFocus?.focus();});
  // The close event is asynchronous: tutorial state must change before modal.close().
  modal.addEventListener('cancel',()=>{if(state==='tutorial')goTitle();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&!overlay.hidden&&overlay.querySelector('.game-panel')){
      const buttons=[...overlay.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
      if(e.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){e.preventDefault();first?.focus();}
    }
    if(e.key==='Escape'&&!modal.open){if(paused)resume();else pause();}
    if(state==='title'&&!modal.open&&!e.repeat&&(e.key==='Enter'||e.code==='Space')&&(document.activeElement===document.body||document.activeElement===document.documentElement)){e.preventDefault();startRun();}
  });
  canvas.addEventListener('renderer-lost',()=>{pause();saveNow();openError('error.context','error.contextDetail');});
  platform.onPause(pause);requestAnimationFrame(frame);
}
init().catch(error=>{console.error(error);$('#load-error').hidden=false;});
