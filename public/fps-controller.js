import {bindPad,createRimSteering} from './pointer-pad.js';
import {createFpsScene} from './fps-scene.js';
export function createFpsController({send,fullscreen}){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/fps.css';document.head.append(style);
  const root=document.createElement('section');root.id='fps-controller';root.hidden=true;
  root.innerHTML='<canvas id="fps-view" aria-label="깃발 쟁탈전 1인칭 시야"></canvas><div id="fps-look" aria-label="오른손으로 드래그하여 조준"></div><div class="fps-crosshair" aria-label="화면 중앙 조준선"><i></i><b></b></div><header class="fps-hud"><span id="fps-identity"></span><span id="fps-score"></span><span id="fps-health"></span><button id="fps-fullscreen">전체화면</button></header><div id="fps-objective"></div><div id="fps-notice" role="status"></div><div id="fps-move" class="fps-pad"><span>이동 · 바깥 원은 방향 전환</span><div class="fps-rim-ring" aria-hidden="true"></div><div class="knob"></div></div><div class="fps-aim-hint">오른손 드래그 · 조준</div><button id="fps-fire" aria-label="발사">발사</button><div id="fps-hit" hidden>✕</div><div class="fps-portrait">폰을 가로로 돌려주세요</div>';
  document.body.append(root);const $=id=>root.querySelector('#'+id),input={forward:0,strafe:0},aim={yaw:0,pitch:0};
  let scene,state,me,enabled=false,lookPointer=null,lookX=0,lookY=0,firePointer=null,hitSerial=0,hitUntil=0,lastSpawn=null,offline=false;
  const allowed=()=>enabled&&!root.hidden&&!matchMedia('(orientation: portrait)').matches&&document.visibilityState==='visible'&&!offline;
  const steering=createRimSteering();
  const resetPad=bindPad($('fps-move'),(x,y)=>{steering.set(x,y,aim.yaw);if(x===0&&y===0){input.forward=0;input.strafe=0;$('fps-move').dataset.rim='false';}},{enabled:allowed,radius:.46,knobTravel:.30});
  let steeringFrame=performance.now();
  function moveFrame(now){requestAnimationFrame(moveFrame);const dt=Math.min(.05,Math.max(0,(now-steeringFrame)/1000));steeringFrame=now;if(!allowed())return;const next=steering.step(aim.yaw,dt);aim.yaw=next.yaw;input.forward=next.forward;input.strafe=next.strafe;$('fps-move').dataset.rim=String(next.rim>.1);}
  requestAnimationFrame(moveFrame);
  function stop(){resetPad();lookPointer=null;firePointer=null;$('fps-fire').classList.remove('pressed');if(state?.game==='fps'&&!root.hidden)send({type:'input',...input});}
  const look=$('fps-look');look.addEventListener('pointerdown',e=>{if(!allowed()||lookPointer!==null)return;e.preventDefault();lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture(e.pointerId);});
  look.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer||!allowed())return;const turn=-(e.clientX-lookX)*.005;aim.yaw+=turn;steering.rotate(turn);aim.pitch=Math.max(-1.25,Math.min(1.25,aim.pitch-(e.clientY-lookY)*.005));lookX=e.clientX;lookY=e.clientY;send({type:'input',...input,...aim});});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])look.addEventListener(type,e=>{if(e.pointerId===lookPointer)lookPointer=null;});
  function fire(){if(allowed())send({type:'fire',...aim});}
  const button=$('fps-fire');button.addEventListener('pointerdown',e=>{if(!allowed()||firePointer!==null)return;e.preventDefault();firePointer=e.pointerId;button.setPointerCapture(e.pointerId);button.classList.add('pressed');fire();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{if(e.pointerId===firePointer){firePointer=null;button.classList.remove('pressed');}});
  $('fps-fullscreen').onclick=()=>fullscreen(true);
  for(const type of ['blur','pagehide','resize','orientationchange'])window.addEventListener(type,stop);document.addEventListener('visibilitychange',stop);
  setInterval(()=>{if(allowed()){send({type:'input',...input,...aim});if(firePointer!==null)fire();}$('fps-hit').hidden=performance.now()>hitUntil;},50);
  return {stop,hide(){if(!root.hidden)stop();root.hidden=true;enabled=false;state=null;document.body.classList.remove('fps-phone');},offline(){offline=true;enabled=false;stop();$('fps-notice').textContent='연결 끊김 · 재접속 중';},update(m,p){
    const entering=root.hidden;root.hidden=false;document.body.classList.add('fps-phone');state=m;me=p;offline=false;enabled=m.phase==='running'&&p.hp>0;
    if(entering||lastSpawn!==m.phase||!Number.isFinite(aim.yaw)){aim.yaw=p.yaw;aim.pitch=p.pitch;lastSpawn=m.phase;}
    if(!enabled)stop();
    document.title='FLAG STRIKE · 깃발 쟁탈전';
    if(!scene){try{scene=createFpsScene($('fps-view'));}catch{$('fps-notice').textContent='3D 화면을 열 수 없습니다 · WebGL 지원 브라우저가 필요합니다';enabled=false;return;}}scene.update(m,p.id,aim);
    $('fps-identity').textContent=`팀 ${p.team+1} · ${p.name}`;$('fps-identity').style.color=m.teams[p.team].color;
    $('fps-score').textContent=m.teams.map(t=>`팀${t.id+1} ${t.captures}점`).join(' / ')+` · ${Math.ceil(m.remaining)}초`;
    $('fps-health').textContent=`HP ${p.hp} · ${p.kills}킬`;
    const carrier=m.players.find(q=>q.id===m.fps.flag.carrier);
    $('fps-objective').textContent=carrier?.id===p.id?'깃발 운반 중 · 이동속도 20% 감소 · 우리 진영으로 돌아가세요':carrier?`팀 ${carrier.team+1} · ${carrier.name} 깃발 운반 중`:Math.hypot(m.fps.flag.x,m.fps.flag.z)>.1?'떨어진 노란 깃발을 회수해 우리 진영으로 가져오세요':'노란 깃발을 가져와 우리 진영에 놓으세요';
    const results=m.results;
    $('fps-notice').textContent=m.phase==='lobby'?'PC에서 경기 시작 대기 · 왼손 이동 / 오른손 조준 / 발사':m.phase==='finished'?`${results.winnerIds.length?results.winnerIds.map(id=>'팀 '+(id+1)).join(' · ')+' 우승!':'무승부'} · ${m.teams.map(t=>'팀 '+(t.id+1)+' '+t.captures+'점').join(' / ')} · PC에서 다음 경기를 준비하세요`:p.hp<=0?`사망 · ${Math.max(0,p.respawn).toFixed(1)}초 후 이 자리에서 부활`:'';
    root.classList.toggle('fps-dead',p.hp<=0);button.disabled=!enabled;
    if(p.hitSerial!==hitSerial){if(!entering&&p.hitSerial>hitSerial)hitUntil=performance.now()+180;hitSerial=p.hitSerial;}
  }};
}
