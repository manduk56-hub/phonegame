import {bindPad} from './pointer-pad.js';
import {screenControl} from './fps-controls.js';
import {createFpsScene} from './fps-scene.js';
export function createFpsController({send,fullscreen}){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/fps.css';document.head.append(style);
  const root=document.createElement('section');root.id='fps-controller';root.hidden=true;
  root.innerHTML='<canvas id="fps-view" aria-label="캐릭터 1인칭 조준 화면"></canvas><div id="fps-crosshair" aria-hidden="true"></div><header class="fps-hud"><span id="fps-identity"></span><span id="fps-health"></span><button id="fps-fullscreen">전체화면</button></header><div id="fps-score" class="fps-scoreboard"></div><div id="fps-objective"></div><div id="fps-notice" role="status"></div><div id="fps-move" class="fps-pad" aria-label="PC 화면 기준 방향키"><span>이동 · PC 화면 방향</span><i class="pad-up">▲</i><i class="pad-right">▶</i><i class="pad-down">▼</i><i class="pad-left">◀</i><div class="knob"></div></div><button id="fps-fire" aria-label="발사">발사</button><div id="fps-hit" hidden>명중!</div><div class="fps-portrait">폰을 가로로 돌려주세요</div>';
  document.body.append(root);const $=id=>root.querySelector('#'+id),input={forward:0,strafe:0},aim={yaw:0,pitch:0},move={x:0,y:0};
  const scene=createFpsScene($('fps-view'));
  let state,enabled=false,firePointer=null,hitSerial=0,hitUntil=0,lastSpawn=null,offline=false;
  const allowed=()=>enabled&&!root.hidden&&!matchMedia('(orientation: portrait)').matches&&document.visibilityState==='visible'&&!offline;
  const updateMovement=()=>{const control=screenControl(move.x,move.y,aim.yaw);aim.yaw=control.yaw;Object.assign(input,{forward:control.forward,strafe:control.strafe});if(allowed())send({type:'input',...input,...aim});};
  const resetPad=bindPad($('fps-move'),(x,y)=>{move.x=x;move.y=y;updateMovement();},{enabled:allowed,eightWay:true,radius:.40,knobTravel:.30});
  function stop(){resetPad();firePointer=null;$('fps-fire').classList.remove('pressed');if(state?.game==='fps'&&!root.hidden)send({type:'input',...input,...aim});}
  function fire(){if(allowed()){send({type:'input',...input,...aim});send({type:'fire'});}}
  const button=$('fps-fire');button.addEventListener('pointerdown',e=>{if(!allowed()||firePointer!==null)return;e.preventDefault();firePointer=e.pointerId;button.setPointerCapture(e.pointerId);button.classList.add('pressed');fire();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{if(e.pointerId===firePointer){firePointer=null;button.classList.remove('pressed');}});
  $('fps-fullscreen').onclick=()=>fullscreen(true);
  for(const type of ['blur','pagehide','resize','orientationchange'])window.addEventListener(type,stop);document.addEventListener('visibilitychange',stop);
  setInterval(()=>{if(allowed()){send({type:'input',...input,...aim});if(firePointer!==null)fire();}$('fps-hit').hidden=performance.now()>hitUntil;},50);
  return {stop,hide(){if(!root.hidden)stop();root.hidden=true;enabled=false;state=null;document.body.classList.remove('fps-phone');},offline(){offline=true;enabled=false;stop();$('fps-notice').textContent='연결 끊김 · 재접속 중';},update(m,p){
    const entering=root.hidden;root.hidden=false;document.body.classList.add('fps-phone');state=m;offline=false;enabled=m.phase==='running'&&p.hp>0;
    if(entering||lastSpawn!==m.phase||!Number.isFinite(aim.yaw)){aim.yaw=p.yaw;aim.pitch=0;lastSpawn=m.phase;}
    if(!enabled)stop();
    scene.update(m,p.id,aim);
    document.title='FLAG STRIKE · 깃발 쟁탈전';
    $('fps-identity').textContent=`팀 ${p.team+1} · ${p.name}`;$('fps-identity').style.color=m.teams[p.team].color;
    const score=$('fps-score'),seconds=Math.ceil(m.remaining),clock=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');score.classList.toggle('fps-many-teams',m.teams.length>4);
    const scoreKey=JSON.stringify(m.teams.map(t=>[t.id,t.color]));
    if(score.dataset.teams!==scoreKey){score.replaceChildren();for(const t of m.teams){const item=document.createElement('span');item.className='fps-team-score';item.style.setProperty('--team-color',t.color);item.dataset.team=t.id;score.append(item);}const timer=document.createElement('b');timer.className='fps-clock';score.insertBefore(timer,score.children[Math.ceil(m.teams.length/2)]??null);score.dataset.teams=scoreKey;}
    for(const t of m.teams){const item=score.querySelector('[data-team="'+t.id+'"]');item.textContent='⚑ '+t.captures;item.setAttribute('aria-label','팀 '+(t.id+1)+' '+t.captures+'점');}score.querySelector('.fps-clock').textContent=clock;
    $('fps-health').textContent=`✚ ${p.hp}`;
    const carrier=m.players.find(q=>q.id===m.fps.flag.carrier);
    $('fps-objective').textContent=carrier?.id===p.id?'깃발 운반 중 · 이동속도 20% 감소 · 우리 진영으로 돌아가세요':carrier?`팀 ${carrier.team+1} · ${carrier.name} 깃발 운반 중`:Math.hypot(m.fps.flag.x,m.fps.flag.z)>.1?'떨어진 노란 깃발을 회수해 우리 진영으로 가져오세요':'노란 깃발을 가져와 우리 진영에 놓으세요';
    const results=m.results;
    $('fps-notice').textContent=m.phase==='lobby'?'PC에서 경기 시작 대기 · PC 방향키 이동 / 폰 십자가로 조준':m.phase==='finished'?`${results.winnerIds.length?results.winnerIds.map(id=>'팀 '+(id+1)).join(' · ')+' 우승!':'무승부'} · ${m.teams.map(t=>'팀 '+(t.id+1)+' '+t.captures+'점').join(' / ')} · PC에서 다음 경기를 준비하세요`:p.hp<=0?`사망 · ${Math.max(0,p.respawn).toFixed(1)}초 후 이 자리에서 부활`:'';
    root.classList.toggle('fps-dead',p.hp<=0);button.disabled=!enabled;
    if(p.hitSerial!==hitSerial){if(!entering&&p.hitSerial>hitSerial)hitUntil=performance.now()+180;hitSerial=p.hitSerial;}
  }};
}
