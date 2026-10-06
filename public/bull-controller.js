import {bindPad} from './pointer-pad.js';
import {createBullScene} from './bull-scene.js';
export function createBullController({send,fullscreen}){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/bull.css';document.head.append(style);
  const root=document.createElement('section');root.id='bull-controller';root.hidden=true;
  root.innerHTML='<canvas aria-label="투우 경기장 1인칭 시야"></canvas><header><span class="bull-identity"></span><b class="bull-clock"></b><button class="bull-fullscreen">전체화면</button></header><p class="bull-status" role="status"></p><div class="bull-reticle">+</div><div class="bull-joystick" role="group" aria-label="이동과 회전 조이스틱"><span>이동 · 회전</span><i class="up">▲</i><i class="down">▼</i><i class="left">◀</i><i class="right">▶</i><div class="knob"></div></div><div class="bull-keys"><button data-key="left" aria-label="왼쪽 회전">◀</button><button data-key="right" aria-label="오른쪽 회전">▶</button></div><aside class="bull-phone-results"></aside><div class="bull-rotate">폰을 가로로 돌려주세요</div>';
  document.body.append(root);const scene=createBullScene(root.querySelector('canvas')),held=new Map(),movement={forward:0,steer:0};let m,p,offline=false;
  const allowed=()=>!root.hidden&&!offline&&m?.phase==='running'&&p?.alive&&p.participating&&!matchMedia('(orientation: portrait)').matches&&document.visibilityState==='visible';
  function input(){const keys=[...held.values()];send({type:'input',forward:p?.role==='bull'?0:movement.forward,steer:p?.role==='bull'?Number(keys.includes('left'))-Number(keys.includes('right')):movement.steer});}
  const joystick=root.querySelector('.bull-joystick');
  const resetJoystick=bindPad(joystick,(x,y)=>{movement.forward=-y;movement.steer=-x;if(allowed()&&p.role==='human')input();},{radius:.38,knobTravel:.28,enabled:()=>allowed()&&p.role==='human'});
  function stop(){resetJoystick();held.clear();for(const b of root.querySelectorAll('[data-key]'))b.classList.remove('pressed');if(!root.hidden)input();}
  for(const b of root.querySelectorAll('[data-key]')){
    b.addEventListener('pointerdown',e=>{if(!allowed())return;e.preventDefault();b.setPointerCapture(e.pointerId);held.set(e.pointerId,b.dataset.key);b.classList.add('pressed');input();});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{held.delete(e.pointerId);if(![...held.values()].includes(b.dataset.key))b.classList.remove('pressed');if(!root.hidden)input();});
  }
  for(const e of ['blur','pagehide','orientationchange','resize'])window.addEventListener(e,stop);document.addEventListener('visibilitychange',stop);
  root.querySelector('.bull-fullscreen').onclick=()=>fullscreen(true);
  setInterval(()=>{if(allowed())input();},50);
  return {stop,hide(){stop();root.hidden=true;document.body.classList.remove('bull-phone');},offline(){offline=true;stop();root.querySelector('.bull-status').textContent='연결 끊김 · 재접속 중';},update(state,player){if(p&&p.role!==player.role)stop();m=state;p=player;offline=false;root.hidden=false;document.body.classList.add('bull-phone');root.dataset.role=p.role;scene.update(m,p.id);if(!allowed())stop();
    document.title='BULL RUN · 투우';root.querySelector('.bull-identity').textContent=`${p.role==='bull'?'황소':'사람'} · ${p.name}`;root.querySelector('.bull-clock').textContent=`${Math.ceil(m.remaining)}초`;
    joystick.hidden=p.role!=='human';joystick.setAttribute('aria-disabled',String(!allowed()));root.querySelector('.bull-keys').hidden=p.role!=='bull';
    for(const b of root.querySelectorAll('[data-key]'))b.disabled=!allowed();
    root.querySelector('.bull-status').textContent=m.phase==='lobby'?'PC에서 황소를 정하고 시작하세요':m.phase==='finished'?(m.results.winner==='bull'?'황소 승리!':'사람 승리!'):!p.alive?`게임 오버 · 생존 ${p.survival.toFixed(2)}초`:p.role==='bull'?(p.stun>0?'벽 충돌! 잠시 스턴':`자동 전진 · 속도 ${p.speed.toFixed(1)} · 남은 사람 ${m.players.filter(q=>q.participating&&q.role==='human'&&q.alive).length}명`):`생존 ${p.survival.toFixed(1)}초 · 왼쪽 조이스틱 · 위아래 이동 / 좌우 회전`;
    const result=root.querySelector('.bull-phone-results');result.hidden=m.phase!=='finished';
    if(!result.hidden){const signature=JSON.stringify(m.results);if(result.dataset.signature!==signature){result.dataset.signature=signature;result.replaceChildren();for(const q of m.results.players){const row=document.createElement('p');row.textContent=`${q.name}${q.id===p.id?' (나)':''} · ${q.role==='bull'?'황소':`${q.survival.toFixed(2)}초 · ${q.alive?'생존':'아웃'}`}`;result.append(row);}}}
  }};
}
