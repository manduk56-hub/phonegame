import {ceremonyMessage} from './fishing-effects.js';
import {landscapeFrame,angleDelta,reelDelta,createHookDetector} from './fishing-controls.js';
export function createFishingController({send,fullscreen}){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/fishing.css';document.head.append(style);
 const root=document.createElement('section');root.id='fishing-controller';root.hidden=true;
 root.innerHTML='<canvas class="fishing-camera" aria-label="낚시 찌와 다가오는 물고기의 1인칭 화면"></canvas><header><span class="fishing-identity"></span><button class="fishing-sensor">센서 시작 · 보정</button><button class="fishing-full">전체화면</button></header><button class="fishing-cast">던지기<span>CAST</span></button><div class="fishing-float-view"><div class="fishing-ripple"></div><div class="fishing-float"><i></i></div></div><div class="fishing-reel" role="slider" tabindex="0" aria-label="시계 방향으로 돌려 릴 감기" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span>↻</span><b>릴 감기</b><i></i></div><section class="fishing-final" hidden><h2></h2><p></p><button class="fishing-scores-toggle">전체 순위</button><ol hidden></ol></section><p class="fishing-status" role="status"></p><div class="fishing-rotate">휴대폰을 가로로 잡아주세요</div>';
 document.body.append(root);const q=s=>root.querySelector(s),detector=createHookDetector();
 let state,player,enabled=false,sensorReady=false,baseline=null,frame=null,lastOrientation=0,lastMotion=0,pointer=null,previous=null,reel=0,reelAt=0,turn=0,sensorMessage='대기실에서 센서 시작을 눌러주세요',watchdog;
 let view,viewLoading=false,viewFailed=false;
 function showView(){if(view){view.update(player,state);return;}if(viewLoading||viewFailed)return;viewLoading=true;
  import('./fishing-view.js').then(m=>m.createFishingView(q('.fishing-camera'))).then(v=>{view=v;root.classList.add('has-camera');if(!root.hidden&&player)view.update(player,state);}).catch(e=>{viewFailed=true;q('.fishing-camera').hidden=true;console.warn('낚시 1인칭 화면 초기화 실패',e);});
 }
 const winner=()=>state?.phase==='finished'&&state.results?.winnerIds.includes(player?.id);
 const celebration=()=>state?.phase==='finished'?state.fishing.ceremony:null;
 const stage=()=>state?.phase==='finished'?(celebration()?.id===player?.id?celebration().stage:'ready'):player?.fishing.stage;
 const canCast=()=>state?.phase==='finished'?winner()&&(['ready','close'].includes(celebration()?.stage)||!state.players.find(p=>p.id===celebration()?.id)?.connected):player?.fishing.stage==='ready';
 q('.fishing-scores-toggle').onclick=()=>{const list=q('.fishing-final ol');list.hidden=!list.hidden;q('.fishing-scores-toggle').textContent=list.hidden?'전체 순위':'순위 접기';};
 const rotation=()=>screen.orientation?.angle??window.orientation??0;
 const allowed=()=>!root.hidden&&enabled&&document.visibilityState==='visible'&&!matchMedia('(orientation: portrait)').matches;
 function stop(){reel=0;previous=null;const old=pointer;pointer=null;if(old!==null&&q('.fishing-reel').hasPointerCapture?.(old))q('.fishing-reel').releasePointerCapture(old);detector.reset();send({type:'input',tilt:0,reel:0});}
 function hook(){if(allowed()){send({type:'action',action:'hook'});if(stage()==='bite')navigator.vibrate?.(40);}}
 window.addEventListener('deviceorientation',e=>{
  if(!sensorReady||root.hidden||document.hidden)return;const now=performance.now(),value=landscapeFrame(e.beta,e.gamma,rotation());if(!value)return;
  frame=value;lastOrientation=now;if(baseline===null)baseline=value.roll;
  if(allowed()&&detector.sample(value,now))hook();
 });
 window.addEventListener('devicemotion',e=>{
  if(!sensorReady||root.hidden||document.hidden)return;const rate=e.rotationRate,r=rotation()*Math.PI/180;
  // Native X/Y angular velocities projected onto the screen horizontal axis.
  const speed=Number.isFinite(rate?.beta)&&Number.isFinite(rate?.gamma)?rate.beta*Math.cos(r)+rate.gamma*Math.sin(r):null;
  const now=performance.now();if(speed!==null){lastMotion=now;if(allowed()&&speed>160){
   // Orientation detector is primary when available; gyro covers devices without orientation samples.
   if(now-lastOrientation>250&&now-lastHook>850){lastHook=now;hook();}
  }}
 });
 let lastHook=0;
 async function enableSensor(){
  if(!window.isSecureContext||!window.DeviceOrientationEvent){sensorMessage='센서는 HTTPS 참가 QR이 필요합니다';q('.fishing-status').textContent=sensorMessage;return;}
  try{
   // Start both iOS requests from the same button gesture before awaiting either.
   const asks=[window.DeviceOrientationEvent,window.DeviceMotionEvent].filter(Boolean).map(api=>typeof api.requestPermission==='function'?api.requestPermission():Promise.resolve('granted'));
   const permissions=await Promise.all(asks);if(permissions.some(p=>p!=='granted'))throw Error('모션 센서 권한을 허용해주세요');
   sensorReady=true;baseline=null;frame=null;detector.reset();lastOrientation=0;lastMotion=0;sensorMessage='폰을 가로로 잡고 잠깐 멈추세요';
   clearTimeout(watchdog);watchdog=setTimeout(()=>{if(!lastOrientation&&!lastMotion)sensorMessage='센서 데이터가 없습니다 · 센서 시작을 다시 눌러주세요';},2500);
  }catch(e){sensorReady=false;sensorMessage=e.message;}
  q('.fishing-status').textContent=sensorMessage;
 }
 q('.fishing-sensor').onclick=enableSensor;q('.fishing-full').onclick=()=>fullscreen(true);
 q('.fishing-cast').onclick=()=>{if(allowed())send({type:'action',action:'cast'});};
 const wheel=q('.fishing-reel');function angle(e){const r=wheel.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;return Math.hypot(x,y)<r.width*.20?null:Math.atan2(y,x);}
 wheel.addEventListener('pointerdown',e=>{if(!allowed()||!['fighting','reeling'].includes(stage())||pointer!==null)return;e.preventDefault();pointer=e.pointerId;previous=angle(e);reel=0;wheel.setPointerCapture(pointer);});
 wheel.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;e.preventDefault();const next=angle(e);if(next===null){previous=null;return;}if(previous!==null){const d=reelDelta(previous,next);reel=d>0?Math.min(1,d*5):0;reelAt=performance.now();turn+=d;wheel.querySelector('i').style.transform=`rotate(${turn}rad)`;}previous=next;});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])wheel.addEventListener(type,e=>{if(e.pointerId!==pointer)return;pointer=null;previous=null;reel=0;sendInput();});
 function sendInput(){const fresh=sensorReady&&frame&&performance.now()-lastOrientation<500&&baseline!==null;const tilt=fresh?Math.max(-1,Math.min(1,angleDelta(frame.roll,baseline)/35)):0;const winding=performance.now()-reelAt<140?reel:0;wheel.setAttribute('aria-valuenow',String(Math.round(winding*100)));if(allowed())send({type:'input',tilt:Math.abs(tilt)>.05?tilt:0,reel:winding});}
 setInterval(()=>{if(root.hidden)return;sendInput();const fresh=sensorReady&&lastOrientation&&performance.now()-lastOrientation<1000;
 q('.fishing-status').textContent=(viewFailed?'3D 화면을 열 수 없습니다 · 찌 표시로 진행합니다. ':'')+(state?.phase==='finished'?ceremonyMessage(celebration(),player,winner())+(winner()&&!fresh?' · 센서 시작으로 챔질 준비':''):!sensorReady||!fresh?sensorMessage:state?.phase==='lobby'?'준비 완료 · PC에서 시작을 기다립니다':player?.fishing.message);
 },50);
 const reset=()=>{baseline=null;frame=null;stop();};screen.orientation?.addEventListener('change',reset);window.addEventListener('orientationchange',reset);
 for(const e of ['blur','pagehide'])window.addEventListener(e,stop);document.addEventListener('visibilitychange',stop);
 return {stop,hide(){if(!root.hidden)stop();root.hidden=true;view?.hide();enabled=false;state=null;document.body.classList.remove('fishing-phone');},offline(){enabled=false;view?.hide();stop();sensorMessage='연결 끊김 · 재접속 중';},update(m,p){
  state=m;player=p;root.hidden=false;showView();document.body.classList.add('fishing-phone');document.title='TIDELINE · 낚시 컨트롤러';enabled=(m.phase==='running'&&p.participating||winner())&&p.connected;if(!enabled)stop();
  root.style.setProperty('--angler',p.color);q('.fishing-identity').textContent=`${m.players.findIndex(v=>v.id===p.id)+1} · ${p.name}`;
  q('.fishing-cast').disabled=!allowed()||!canCast();wheel.classList.toggle('active',enabled&&['fighting','reeling'].includes(stage()));
  q('.fishing-final').hidden=m.phase!=='finished';
  if(m.phase==='finished'){
   const result=m.results.players.find(v=>v.id===p.id),names=m.results.players.filter(v=>m.results.winnerIds.includes(v.id)).map(v=>v.name).join(' · ');
   q('.fishing-final h2').textContent=names?names+' 우승!':'무승부';q('.fishing-final p').textContent=result?result.rank+'위 · '+result.score+'마리':'';
   const signature=JSON.stringify(m.results);if(q('.fishing-final').dataset.signature!==signature){q('.fishing-final').dataset.signature=signature;const list=q('.fishing-final ol');list.replaceChildren();for(const row of m.results.players){const item=document.createElement('li');item.textContent=row.rank+'위 · '+row.name+' · '+row.score+'마리';list.append(item);}}
  }
  const float=q('.fishing-float');float.style.transform=`translate(-50%,-50%) translateY(${p.fishing.bob*64}px) rotate(${p.fishing.stage==='bite'?Math.sin(p.fishing.age*18)*14:Math.sin(p.fishing.age*2)*3}deg)`;
  q('.fishing-float-view').dataset.stage=p.fishing.stage;float.style.opacity=['ready','cooldown'].includes(p.fishing.stage)?'.25':'1';
  if(sensorReady&&lastOrientation&&performance.now()-lastOrientation<1000)sensorMessage='센서 준비 완료';
 }};
}
