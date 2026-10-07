import {bindPad} from './pointer-pad.js';
import {createBullScene} from './bull-scene.js';
export function createBullController({send,fullscreen}){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/bull.css';document.head.append(style);
  const root=document.createElement('section');root.id='bull-controller';root.hidden=true;
  root.innerHTML='<canvas aria-label="투우 경기장 1인칭 시야"></canvas><header><span class="bull-identity"></span><b class="bull-clock"></b><button class="bull-fullscreen">전체화면</button></header><p class="bull-status" role="status"></p><div class="bull-reticle">+</div><div class="bull-joystick" role="group" aria-label="이동과 회전 조이스틱"><span>이동 · 회전</span><i class="up">▲</i><i class="down">▼</i><i class="left">◀</i><i class="right">▶</i><div class="knob"></div></div><div class="bull-keys"><button class="bull-forward" data-key="forward" aria-label="전진">▲<span>전진</span></button><div class="bull-direction" role="group" aria-label="황소 방향 회전"><button data-key="left" aria-label="왼쪽 회전">◀</button><button data-key="right" aria-label="오른쪽 회전">▶</button></div></div><button class="bull-cape" data-key="wave" aria-label="빨간 천 흔들기">빨간 천<br>흔들기</button><aside class="bull-phone-results"></aside><div class="bull-rotate">폰을 가로로 돌려주세요</div>';
  document.body.append(root);const scene=createBullScene(root.querySelector('canvas')),held=new Map(),movement={forward:0,steer:0};let m,p,offline=false;
  const celebration=()=>m?.phase==='finished'&&m.bull.celebration?.ready;
  const allowed=()=>!root.hidden&&!offline&&p?.participating&&(m?.phase==='running'&&p.alive||celebration()&&(p.role==='bull'&&m.results.winner==='bull'||p.celebrationPose==='cape'))&&!matchMedia('(orientation: portrait)').matches&&document.visibilityState==='visible';
  function input(){const keys=[...held.values()];send({type:'input',forward:p?.role==='bull'?Number(keys.includes('forward')):m?.phase==='running'?movement.forward:0,steer:p?.role==='bull'?Number(keys.includes('left'))-Number(keys.includes('right')):m?.phase==='running'?movement.steer:0,wave:Number(keys.includes('wave'))});}
  const joystick=root.querySelector('.bull-joystick');
  const resetJoystick=bindPad(joystick,(x,y)=>{movement.forward=-y;movement.steer=-x*Math.abs(x);if(allowed()&&p.role==='human')input();},{radius:.38,knobTravel:.28,deadZone:.16,enabled:()=>allowed()&&m.phase==='running'&&p.role==='human'});
  function stop(){resetJoystick();held.clear();for(const b of root.querySelectorAll('[data-key]'))b.classList.remove('pressed');if(!root.hidden)input();}
  for(const b of root.querySelectorAll('[data-key]')){
    b.addEventListener('pointerdown',e=>{if(!allowed())return;e.preventDefault();b.setPointerCapture(e.pointerId);held.set(e.pointerId,b.dataset.key);b.classList.add('pressed');input();});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{held.delete(e.pointerId);if(![...held.values()].includes(b.dataset.key))b.classList.remove('pressed');if(!root.hidden)input();});
  }
  for(const e of ['blur','pagehide','orientationchange','resize'])window.addEventListener(e,stop);document.addEventListener('visibilitychange',stop);
  root.querySelector('.bull-fullscreen').onclick=()=>fullscreen(true);
  setInterval(()=>{if(allowed())input();},50);
  return {stop,hide(){stop();root.hidden=true;document.body.classList.remove('bull-phone');},offline(){offline=true;stop();root.querySelector('.bull-status').textContent='연결 끊김 · 재접속 중';},update(state,player){if(p&&(p.role!==player.role||m.phase!==state.phase))stop();m=state;p=player;offline=false;root.hidden=false;document.body.classList.add('bull-phone');root.dataset.role=p.role;root.dataset.phase=m.phase;scene.update(m,p.id);if(!allowed())stop();
    document.title='BULL RUN · 투우';root.querySelector('.bull-identity').textContent=`${p.role==='bull'?'황소':'사람'} · ${p.name}`;root.querySelector('.bull-clock').textContent=m.phase==='finished'?'종료':`${Math.ceil(m.remaining)}초`;
    joystick.hidden=p.role!=='human'||m.phase==='finished';root.querySelector('.bull-cape').hidden=p.celebrationPose!=='cape'||!celebration();joystick.setAttribute('aria-disabled',String(!allowed()));root.querySelector('.bull-keys').hidden=p.role!=='bull';
    for(const b of root.querySelectorAll('[data-key]'))b.disabled=!allowed();
    root.querySelector('.bull-status').textContent=m.phase==='lobby'?(m.bull.map==='gates'?'문 돌진 · 모두 사람 · 열리는 문을 살피세요':'PC에서 황소를 정하고 시작하세요'):m.phase==='finished'?(m.results.winner==='bull'?(m.bull.map==='classic'?'황소 승리! · 전진 버튼으로 뒤에서 돌진하세요':'황소 승리! · 사람들이 벌벌 떨고 있어요'):'사람 승리! · 빨간 천 버튼을 눌러 흔드세요'):!p.alive?`게임 오버 · 생존 ${p.survival.toFixed(2)}초`:m.bull.map==='gates'?`문 돌진 · 황소 속도 ${m.bull.gates.speed} 고정 · 생존 ${p.survival.toFixed(1)}초`:p.role==='bull'?(p.stun>0?'벽 충돌! 잠시 스턴':`왼쪽 전진 · 오른쪽 ◀▶ 회전 · 속도 ${p.speed.toFixed(1)} · 남은 사람 ${m.players.filter(q=>q.participating&&q.role==='human'&&q.alive).length}명`):`생존 ${p.survival.toFixed(1)}초 · 왼쪽 조이스틱 · 위아래 이동 / 좌우 회전`;
    const result=root.querySelector('.bull-phone-results');result.hidden=m.phase!=='finished';
    if(!result.hidden){const signature=JSON.stringify(m.results);if(result.dataset.signature!==signature){result.dataset.signature=signature;result.replaceChildren();for(const q of m.results.players){const row=document.createElement('p');row.textContent=`${q.name}${q.id===p.id?' (나)':''} · ${q.role==='bull'?'황소':`${q.survival.toFixed(2)}초 · ${q.alive?'생존':'아웃'}`}`;result.append(row);}}}
  }};
}
