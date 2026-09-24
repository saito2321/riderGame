import { Simulation } from './game/Simulation.js';
import { CONFIG as C, multiplier, clamp } from './game/config.js';
import { Input } from './game/Input.js';
import { AudioSystem } from './game/AudioSystem.js';
import { PlatformAdapter } from './platform/PlatformAdapter.js';
import { MACHINES, isMachineUnlocked } from './machines.js';

const $=s=>document.querySelector(s);
const platform=new PlatformAdapter(),sim=new Simulation();
let save=platform.data,audio;
const canvas=$('#game-canvas'),stage=$('#game-stage'),overlay=$('#game-overlay'),modal=$('#modal'),soundToggle=$('#sound-toggle'),hapticsToggle=$('#haptics-toggle');
const input=new Input(canvas,()=>sim.x);
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
let strings={},language='en',world,machinePreview,state='title',userPaused=false,platformPaused=false,pauseConfirming=false,remaining=0,crashElapsed=0,previousTime=0,accumulator=0,toastTimer=0,impactTimer=0,recordAtStart=0;
const randomSeed=()=>{const values=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(values);else values[0]=Math.floor(Math.random()*4294967296);return values[0];};
let rewardId=0,unlockRequestId=0,pendingRewardResult=null,pendingUnlockResult=null,returnFocus=null,seed=randomSeed();
let machineIndex=0;
let frameRequest=0,resumeWaiters=[],bootReady=false;
const t=key=>strings[key]??key;
const number=n=>Math.floor(n).toLocaleString(language==='ja'?'ja-JP':'en-US');
const isPaused=()=>userPaused||platformPaused;
function stopFrame(){if(frameRequest){cancelAnimationFrame(frameRequest);frameRequest=0;}}
function scheduleFrame(){if(!frameRequest&&!isPaused()&&state!=='reward')frameRequest=requestAnimationFrame(frame);}
function waitForPlatformResume(){return platformPaused?new Promise(resolve=>resumeWaiters.push(resolve)):Promise.resolve();}
function element(tag,text,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
function button(key,callback,secondary=false){const b=element('button',t(key),secondary?'secondary-button':'play-button');b.addEventListener('click',callback);return b;}
function renderMachineSelector(){
  const machine=MACHINES[machineIndex],unlocked=isMachineUnlocked(machine.id,save.bestScore,save.adUnlockedMachines);
  const adPending=platform.isPlayables&&!!platform.pendingMachineReward;
  $('#machine-selector').classList.toggle('locked',!unlocked);$('#machine-name').textContent=t(machine.nameKey);machinePreview?.setMachine(machine.id,!unlocked);
  $('#machine-status').textContent=unlocked?t('machine.selected'):t('machine.unlockAt').replace('{score}',number(machine.unlockScore));
  $('#unlock-machine').hidden=unlocked;$('#unlock-machine').disabled=adPending;$('#unlock-machine').textContent=t(adPending?'machine.adPending':platform.isPlayables?'machine.adOffer':'machine.localOffer');
  $('#machine-index').textContent=`${machineIndex+1} / ${MACHINES.length}`;$('#play').disabled=!unlocked;$('#play').textContent=t(unlocked?'ui.play':'machine.locked');
}
function browseMachine(direction){
  $('#unlock-feedback').hidden=true;
  machineIndex=(machineIndex+direction+MACHINES.length)%MACHINES.length;
  const machine=MACHINES[machineIndex];if(isMachineUnlocked(machine.id,save.bestScore,save.adUnlockedMachines))platform.setMachine(machine.id);renderMachineSelector();
}
function updateBest(){$('#high-score').textContent=number(save.bestScore);renderMachineSelector();}
function showToast(text){$('#toast').textContent=text;toastTimer=1.35;$('#toast').classList.add('visible');}
function clearEffects(){toastTimer=0;impactTimer=0;$('#toast').textContent='';$('#toast').classList.remove('visible');$('#impact').style.opacity=0;}
function saveNow(){platform.record(sim);platform.save(true);updateBest();}
function setActive(){input.setEnabled(state==='playing'&&!isPaused());$('#pause-button').hidden=!['playing','countdown'].includes(state);}
function panel(title){overlay.replaceChildren();overlay.hidden=false;const p=document.createElement('div');p.className='game-panel';p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-labelledby','game-panel-title');const heading=element('h2',title);heading.id='game-panel-title';p.append(heading);overlay.append(p);return p;}
function renderPanel(){
  overlay.hidden=true;
  if(userPaused){
    if(pauseConfirming){const p=panel(t('pause.titleConfirm'));p.append(element('p',t('pause.titleDetail'),'modal-copy'),button('pause.returnTitle',goTitle),button('revive.cancel',()=>{pauseConfirming=false;renderPanel();},true));p.querySelector('button').focus();return;}
    const p=panel(t('ui.paused'));p.append(button('ui.resume',resume),button('ui.title',()=>{pauseConfirming=true;renderPanel();},true));p.querySelector('button').focus();return;
  }
  if(state==='countdown'){
    overlay.hidden=false;overlay.replaceChildren(element('strong',remaining>.45?String(Math.ceil(remaining-.45)):t('ui.go'),'countdown'));return;
  }
  if(state==='reward'){
    const p=panel(t(platform.isPlayables?'revive.adTitle':'revive.title'));p.append(element('p',t(platform.isPlayables?'revive.adDetail':'revive.detail'),'modal-copy'));
    if(!platform.isPlayables){p.append(button('revive.success',()=>platform.resolveRevive(true)),button('revive.cancel',()=>platform.resolveRevive(false),true));p.querySelector('button').focus();}
    return;
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
    if(!sim.revived){p.append(element('p',t('revive.hint'),'revive-hint'),button(platform.isPlayables?'revive.adOffer':'revive.offer',requestRevive));}
    p.append(button('ui.retry',()=>startRun(false),!sim.revived));
    p.append(button('ui.title',goTitle,true));p.querySelector('button').focus();
  }
}
function pause(){
  if(userPaused||platformPaused||!['playing','countdown','reward'].includes(state))return;
  userPaused=true;pauseConfirming=false;input.setEnabled(false);audio.pause();saveNow();platform.setPaused(true);accumulator=0;previousTime=0;stopFrame();renderPanel();
}
function resume(){
  if(!userPaused)return;
  userPaused=false;pauseConfirming=false;previousTime=0;accumulator=0;
  if(platformPaused){setActive();return;}
  platform.setPaused(false);
  if(['playing','countdown'].includes(state))audio.unlock();
  if(pendingRewardResult!==null){const result=pendingRewardResult;pendingRewardResult=null;finishReward(result);}
  if(pendingUnlockResult){const result=pendingUnlockResult;pendingUnlockResult=null;finishMachineUnlock(result.id,result.earned);}
  setActive();renderPanel();scheduleFrame();if(state==='playing')canvas.focus();
}
function platformPause(){
  if(platformPaused)return;
  if(!platform.isPlayables&&!userPaused&&['playing','countdown'].includes(state)){userPaused=true;pauseConfirming=false;}
  platformPaused=true;document.documentElement.classList.add('platform-paused');input.setEnabled(false);audio?.pause();machinePreview?.setActive(false);
  if(bootReady)saveNow();else platform.save(true);
  platform.setPaused(true);accumulator=0;previousTime=0;stopFrame();
}
function platformResume(){
  if(!platformPaused)return;
  platformPaused=false;document.documentElement.classList.remove('platform-paused');previousTime=0;accumulator=0;machinePreview?.setActive(state==='title');platform.setPaused(userPaused);
  const waiters=resumeWaiters;resumeWaiters=[];for(const resolve of waiters)resolve();
  if(!bootReady)return;
  if(state==='title')renderMachineSelector();
  if(userPaused){setActive();renderPanel();return;}
  if(pendingRewardResult!==null){const result=pendingRewardResult;pendingRewardResult=null;finishReward(result);}
  if(pendingUnlockResult){const result=pendingUnlockResult;pendingUnlockResult=null;finishMachineUnlock(result.id,result.earned);}
  if(['playing','countdown'].includes(state))audio.unlock();
  setActive();renderPanel();scheduleFrame();if(state==='playing')canvas.focus();
}
function countdown(){state='countdown';remaining=3.45;accumulator=0;previousTime=0;setActive();renderPanel();scheduleFrame();}
async function requestRevive(){
  if(state!=='result'||sim.revived)return;
  state='reward';setActive();audio.pause();stopFrame();previousTime=0;const token=++rewardId;renderPanel();
  const earned=await platform.requestRevive();
  if(token!==rewardId||state!=='reward')return;
  if(isPaused())pendingRewardResult=earned;else finishReward(earned);
}
function finishReward(earned){
  if(earned===true&&sim.revive()){audio.unlock();clearEffects();countdown();}
  else{state='result';renderPanel();scheduleFrame();}
}
async function requestMachineUnlock(){
  if(state!=='title'||platformPaused||platform.pendingMachineReward)return;
  const machine=MACHINES[machineIndex];
  if(isMachineUnlocked(machine.id,save.bestScore,save.adUnlockedMachines))return;
  const token=++unlockRequestId;
  state='unlocking';machinePreview?.setActive(false);$('#unlock-feedback').hidden=true;
  openModal('machine.adTitle');$('#modal-action').hidden=true;
  $('#modal-content').append(element('p',t(platform.isPlayables?'machine.adDetail':'machine.localDetail'),'modal-copy'));
  if(platform.isPlayables){
    $('#modal-content').append(button('revive.cancel',()=>cancelMachineUnlock(),true));
    $('#modal-content button').focus();
  }else{
    $('#modal-content').append(button('machine.grant',()=>platform.resolveMachineUnlock(true)),button('revive.cancel',()=>platform.resolveMachineUnlock(false),true));
    $('#modal-content button').focus();
  }
  const earned=await platform.requestMachineUnlock(machine.id);
  if(token!==unlockRequestId||state!=='unlocking'){if(!platformPaused&&state==='title')renderMachineSelector();return;}
  if(isPaused())pendingUnlockResult={id:machine.id,earned};else finishMachineUnlock(machine.id,earned);
}
function cancelMachineUnlock(closeModal=true){
  if(state!=='unlocking'||platformPaused)return;
  unlockRequestId++;pendingUnlockResult=null;state='title';platform.resolveMachineUnlock(false);
  $('#unlock-feedback').textContent=t('machine.unearned');$('#unlock-feedback').hidden=false;
  machinePreview?.setActive(true);renderMachineSelector();returnFocus=$('#machine-next');
  if(closeModal&&modal.open)modal.close();
}
function finishMachineUnlock(id,earned){
  if(state!=='unlocking')return;
  state='title';
  if(earned===true){platform.unlockMachine(id);platform.setMachine(id);platform.save(true);returnFocus=$('#play');}
  else returnFocus=$('#unlock-machine');
  $('#unlock-feedback').textContent=t(earned===true?'machine.unlocked':'machine.unearned');$('#unlock-feedback').hidden=false;
  modal.close();machinePreview?.setActive(true);renderMachineSelector();
  returnFocus.focus();
}
function goTitle(){
  rewardId++;platform.resolveRevive(false);pendingRewardResult=null;userPaused=false;pauseConfirming=false;state='title';input.setEnabled(false);audio.pause();saveNow();
  stage.hidden=true;$('.title-screen').hidden=false;$('.game-shell').classList.remove('in-game');overlay.hidden=true;machinePreview?.setActive(true);renderMachineSelector();$('#play').focus();
}
async function startRun(first=true){
  if(platformPaused||state==='loading')return;
  if(state==='title'&&!isMachineUnlocked(MACHINES[machineIndex].id,save.bestScore,save.adUnlockedMachines))return;
  state='loading';$('#play').disabled=true;$('#play').textContent=t('ui.loading');
  await audio.unlock();
  await waitForPlatformResume();
  try{
    if(!world){const {World}=await import('./game/World.js');await waitForPlatformResume();world=new World(canvas);}
    rewardId++;platform.resolveRevive(false);pendingRewardResult=null;userPaused=false;pauseConfirming=false;recordAtStart=save.bestScore;
    seed=randomSeed();sim.reset(seed);input.clear();clearEffects();crashElapsed=0;
    $('.title-screen').hidden=true;stage.hidden=false;$('.game-shell').classList.add('in-game');machinePreview?.setActive(false);world.setMachine(save.selectedMachine);world.resize();world.render(sim,save.settings);updateHUD();
    if(first&&!save.tutorialCompleted){state='tutorial';setActive();showTutorial();}else countdown();
  }catch(error){console.error(error);state='title';openError('error.title','error.detail');}
  finally{if(state==='title')renderMachineSelector();else{$('#play').disabled=false;$('#play').textContent=t('ui.play');}}
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
  for(const key of ['tutorial.move','tutorial.near','tutorial.combo','tutorial.ramp'])list.append(element('li',t(key)));
  $('#modal-content').append(list,element('p',t('tutorial.keyboard'),'modal-copy'));
  $('#modal-action').textContent=t('tutorial.start');$('#modal-action').onclick=()=>{platform.completeTutorial();countdown();modal.close();};$('#modal-action').focus();
}
function openError(title,detail){openModal(title);$('#modal-content').append(element('p',t(detail),'modal-copy'));$('#modal-action').textContent=t('error.reload');$('#modal-action').onclick=()=>location.reload();}
function updateHUD(){
  $('#health').textContent=sim.health>1?'♥':'';$('#health').ariaLabel=`${t('hud.health')} ${sim.health} / ${C.health}`;
  $('#score').textContent=number(sim.score);$('#hud-best').textContent=`${t('hud.best')} ${number(save.bestScore)}`;
  $('#combo').textContent=sim.combo?`×${sim.combo}`:'—';$('#multiplier').textContent=`×${multiplier(sim.combo).toFixed(1)}`;
  $('#combo-timer').style.transform=`scaleX(${sim.combo?clamp(1-(sim.time-sim.lastNear)/C.comboTime,0,1):0})`;
  $('#turbo-label').textContent=sim.turbo>.05?`${t(sim.turbo>=7.99?'hud.maxTurbo':'hud.turbo')} +${sim.turbo.toFixed(1)}`:'';
  $('#speed').textContent=Math.round(sim.speed*3.6);$('#distance').textContent=`${number(sim.distance)} m`;
  stage.classList.toggle('turbo',sim.turbo>.05);
}
function frame(timestamp){
  frameRequest=0;if(isPaused())return;scheduleFrame();
  const dt=previousTime?Math.min((timestamp-previousTime)/1000,.1):0;previousTime=timestamp;
  if(state!=='reward')platform.update(dt);
  if(!world||!['playing','countdown','tutorial','crashing'].includes(state))return;
  if(state==='countdown'){
    const old=Math.ceil(remaining-.45);remaining-=dt;
    if(Math.ceil(remaining-.45)!==old)audio.effect('count');
    renderPanel();if(remaining<=0){state='playing';overlay.hidden=true;setActive();canvas.focus();}
  }else if(state==='playing'){
    accumulator+=dt;
    while(accumulator>=C.step){
      sim.step(C.step,input);accumulator-=C.step;
      for(const event of sim.events){
        if(event.type==='coin'){showToast(`${t('hud.coin')} +${event.points}`);audio.effect('coin');}
        if(event.type==='near'){showToast(`${t(event.tier===300?'hud.veryClose':'hud.near')} +${event.points}`);audio.effect('near');}
        if(event.type==='jump'){showToast(`${t('hud.jump')} +${event.points}`);audio.effect('jump');}
        if(event.type==='speed')showToast(t('hud.speedUp'));
        if(event.type==='hit'){world.burst(sim.x);impactTimer=.3;audio.effect('hit');if(save.settings.haptics&&navigator.vibrate)navigator.vibrate(60);}
        if(event.type==='dead'){saveNow();state='crashing';crashElapsed=0;setActive();audio.pause();overlay.hidden=true;break;}
      }
      if(state!=='playing'){accumulator=0;break;}
    }
    platform.record(sim);platform.save();
    if(state==='playing')audio.update(sim,dt);
  }else if(state==='crashing'){
    sim.advanceCrash(dt);
    crashElapsed+=dt;
    if(crashElapsed>=1.6){state='result';renderPanel();platform.requestInterstitial();}
  }
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('visible');}
  impactTimer=Math.max(0,impactTimer-dt);$('#impact').style.opacity=impactTimer*1.7;
  updateHUD();world.render(sim,save.settings,dt);
}
async function init(){
  platform.onPause(platformPause,platformResume);
  await nextFrame();await nextFrame();platform.firstFrameReady();
  await waitForPlatformResume();
  const [requestedLanguage,loadedSave]=await Promise.all([platform.getLanguage(),platform.load()]);
  await waitForPlatformResume();
  let response=await fetch(`./locales/${requestedLanguage}.json`);
  language=requestedLanguage;
  if(!response.ok&&language==='ja'){response=await fetch('./locales/en.json');language='en';}
  if(!response.ok)throw new Error('Locale load failed');strings=await response.json();save=loadedSave;
  await waitForPlatformResume();
  document.documentElement.lang=language;
  audio=new AudioSystem(save.settings,platform.isAudioEnabled());
  document.querySelectorAll('[data-i18n]').forEach(e=>{e.textContent=t(e.dataset.i18n);});
  $('#loading-screen').ariaLabel=t('ui.loadingGame');stage.ariaLabel=t('ui.game');canvas.ariaLabel=t('input.steer');
  machineIndex=Math.max(0,MACHINES.findIndex(machine=>machine.id===save.selectedMachine));updateBest();soundToggle.checked=save.settings.sfx;hapticsToggle.checked=save.settings.haptics;$('#close-modal').ariaLabel=t('ui.close');
  platform.setRecoveryListener(cloudBestScore=>{recordAtStart=Math.max(recordAtStart,cloudBestScore);machineIndex=Math.max(0,MACHINES.findIndex(machine=>machine.id===save.selectedMachine));updateBest();soundToggle.checked=save.settings.sfx;hapticsToggle.checked=save.settings.haptics;if(!stage.hidden)updateHUD();});
  $('#sound-label').title=t('settings.sfx');$('#haptics-label').title=t('settings.haptics');
  $('#machine-selector').ariaLabel=t('machine.selection');$('#machine-prev').ariaLabel=t('machine.previous');$('#machine-next').ariaLabel=t('machine.next');
  soundToggle.addEventListener('change',()=>platform.setSetting('sfx',soundToggle.checked));
  hapticsToggle.addEventListener('change',()=>{platform.setSetting('haptics',hapticsToggle.checked);if(!hapticsToggle.checked&&navigator.vibrate)navigator.vibrate(0);});
  $('#machine-prev').addEventListener('click',()=>browseMachine(-1));$('#machine-next').addEventListener('click',()=>browseMachine(1));
  $('#unlock-machine').addEventListener('click',requestMachineUnlock);
  $('#play').addEventListener('click',()=>startRun());$('#pause-button').addEventListener('click',pause);
  $('#close-modal').addEventListener('click',()=>{if(state==='unlocking')cancelMachineUnlock();else modal.close();});
  modal.addEventListener('close',()=>{if(state==='tutorial'){goTitle();return;}if(state==='title')returnFocus?.focus();});
  // The close event is asynchronous: tutorial state must change before modal.close().
  modal.addEventListener('cancel',()=>{if(state==='unlocking')cancelMachineUnlock(false);else if(state==='tutorial')goTitle();});
  document.addEventListener('keydown',e=>{
    if(platformPaused)return;
    if(e.key==='Tab'&&!overlay.hidden&&overlay.querySelector('.game-panel')){
      const buttons=[...overlay.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
      if(e.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){e.preventDefault();first?.focus();}
    }
    if(e.key==='Escape'&&!modal.open){if(userPaused&&pauseConfirming){pauseConfirming=false;renderPanel();}else if(userPaused)resume();else pause();}
    if(state==='title'&&!modal.open&&!e.repeat&&(e.key==='Enter'||e.code==='Space')&&(document.activeElement===document.body||document.activeElement===document.documentElement)){e.preventDefault();startRun();}
  });
  canvas.addEventListener('renderer-lost',()=>{pause();saveNow();openError('error.context','error.contextDetail');});
  platform.onAudioEnabledChange(enabled=>{audio.setSystemEnabled(enabled);if(enabled&&state==='playing'&&!isPaused())audio.unlock();});
  let Preview;
  try{({MachinePreview:Preview}=await import('./game/MachinePreview.js'));}catch(error){console.error(error);}
  await waitForPlatformResume();
  const title=$('.title-screen');title.hidden=false;$('#loading-screen').hidden=true;
  if(Preview){try{machinePreview=new Preview($('#machine-preview-canvas'));renderMachineSelector();machinePreview.setActive(!platformPaused);}catch(error){console.error(error);}}
  await nextFrame();await nextFrame();
  await waitForPlatformResume();
  title.inert=false;bootReady=true;platform.gameReady();scheduleFrame();
}
init().catch(error=>{console.error(error);$('#load-error').hidden=false;});
