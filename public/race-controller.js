import {drawRaceMinimap} from './race-minimap.js';
import {createRaceScene,renderCarPreview} from './race-scene.js';
import {screenTilt} from './race-sensors.js';
export function createRaceController({send,fullscreen}){
  const root=document.createElement('section');root.id='race-controller';root.hidden=true;
  root.innerHTML=`<canvas id="race-view" aria-label="내 스포츠카 운전석 1인칭 화면"></canvas>
    <canvas id="race-minimap" width="180" height="112" aria-label="서킷 미니맵 · 빛나는 점은 내 위치"></canvas><div class="race-hud"><strong id="race-driver"></strong><span id="race-lap"></span><span id="race-rank"></span><div class="race-view-choice" role="group" aria-label="주행 시점"><button id="race-view-first" aria-pressed="true">1인칭</button><button id="race-view-third" aria-pressed="false">2.5D</button></div><button id="race-fullscreen">전체화면</button></div>
    <div class="race-speed"><strong id="race-speed">0</strong><small>km/h</small></div><div class="race-dashboard" aria-hidden="true">POCKET RACING</div>
    <button id="race-brake" class="race-pedal brake" aria-label="브레이크 · 정지 후 계속 누르면 후진"><span class="pedal-metal"><i></i><i></i><i></i><i></i></span><b>브레이크 / 후진</b></button>
    <button id="race-throttle" class="race-pedal accelerator" aria-label="가속 페달"><span class="pedal-metal"><i></i><i></i><i></i><i></i><i></i></span><b>엑셀</b></button>
    <div class="race-wheel-wrap"><svg id="race-wheel" viewBox="0 0 240 240" role="img" aria-label="기울기에 따라 회전하는 핸들"><circle cx="120" cy="120" r="98" fill="none" stroke="#10171c" stroke-width="30"/><circle cx="120" cy="120" r="98" fill="none" stroke="#47535b" stroke-width="3"/><path d="M20 111h67l25 16-15 13H24zm200 0h-67l-25 16 15 13h73zM105 141h30l7 76h-44z" fill="#9aaab3" stroke="#182229" stroke-width="5"/><circle cx="120" cy="120" r="37" fill="#29363f" stroke="#10171c" stroke-width="5"/><path d="m109 126 11-20 11 20" fill="none" stroke="#eac371" stroke-width="5"/><path d="M116 12h8v21h-8z" fill="#eac371"/></svg></div>
    <div class="race-sensor"><button id="race-sensor">기울기 조작 시작</button><button id="race-calibrate">중립 보정</button><span id="race-sensor-status">폰을 가로로 잡고 센서를 켜주세요</span></div>
    <div class="race-touch-steer" hidden><button id="race-left" aria-label="왼쪽 조향">◀</button><button id="race-right" aria-label="오른쪽 조향">▶</button></div><div id="race-countdown" role="status"></div>
    <section id="race-garage"><span class="eyebrow">POCKET RACING / GARAGE</span><h1>오늘의 차를 고르세요</h1><p>여섯 차종의 성능은 같습니다. 브레이크를 정지 후 계속 누르면 후진, 후진 중 엑셀은 제동 후 전진합니다.</p><div class="race-view-choice garage-view-choice" role="group" aria-label="주행 시점 선택"><span>주행 시점</span><button id="race-garage-view-first" aria-pressed="true">1인칭 · 운전석</button><button id="race-garage-view-third" aria-pressed="false">2.5D · 사선 시점</button></div><div id="race-car-list"></div><p id="race-garage-status"></p><button id="race-garage-sensor">기울기 조작 시작</button><span id="race-garage-sensor-status"></span></section><section id="race-finish" hidden role="status"></section>`;
  document.body.append(root);let scene,state,enabled=false,baseline=null,angle=0,lastSensor=0,sensorReady=false,sensorTimer,touchSteer=0;
  const input={steer:0,throttle:0,brake:0},resets=[],$=id=>root.querySelector('#'+id);
  let viewMode='third';
  try{if(localStorage.getItem('race-view-mode')==='first')viewMode='first';}catch{}
  function selectView(mode){
    viewMode=mode;root.classList.toggle('race-third-person',mode==='third');
    $('race-view').setAttribute('aria-label',mode==='third'?'내 스포츠카 2.5D 사선 화면':'내 스포츠카 운전석 1인칭 화면');
    for(const prefix of ['race-view-','race-garage-view-'])for(const choice of ['first','third'])$(prefix+choice).setAttribute('aria-pressed',String(choice===mode));
    scene?.setViewMode(mode);if(state)send({type:'race-view',viewMode:mode});
    try{localStorage.setItem('race-view-mode',mode);}catch{}
  }
  for(const prefix of ['race-view-','race-garage-view-'])for(const mode of ['first','third'])$(prefix+mode).onclick=()=>selectView(mode);
  selectView(viewMode);
  const allowed=()=>enabled&&!matchMedia('(orientation: portrait)').matches&&document.visibilityState==='visible';
  function stop(){for(const reset of resets)reset();Object.assign(input,{steer:0,throttle:0,brake:0});touchSteer=0;for(const pedal of root.querySelectorAll('.race-pedal'))pedal.classList.remove('pressed');if(state?.game==='racing'&&!root.hidden)send({type:'input',...input});}
  function sensorText(text){$('race-sensor-status').textContent=text;$('race-garage-sensor-status').textContent=text;}
  window.addEventListener('deviceorientation',event=>{
    if(root.hidden||!sensorReady||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
    const next=screenTilt(event.beta,event.gamma,screen.orientation?.angle??window.orientation??90);
    if(next===null)return;angle=next;lastSensor=performance.now();
    if(baseline===null){baseline=angle;sensorText('기울기 조작 켜짐 · 현재 자세가 중립입니다');}
  });
  async function enableSensor(){
    if(!window.isSecureContext||!window.DeviceOrientationEvent){sensorText('HTTPS 터널 QR로 접속하거나 터치 조향을 사용하세요');root.querySelector('.race-touch-steer').hidden=false;return;}
    try{
      if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw Error('센서 권한이 허용되지 않았습니다');
      sensorReady=true;baseline=null;lastSensor=0;sensorText('폰을 가로로 잡고 움직여주세요…');clearTimeout(sensorTimer);
      sensorTimer=setTimeout(()=>{if(!lastSensor){sensorText('센서 데이터가 없습니다 · 터치 조향 사용 가능');root.querySelector('.race-touch-steer').hidden=false;}},2500);
    }catch(error){sensorReady=false;sensorText(error.message+' · 터치 조향 사용 가능');root.querySelector('.race-touch-steer').hidden=false;}
  }
  $('race-sensor').onclick=enableSensor;$('race-garage-sensor').onclick=enableSensor;
  $('race-calibrate').onclick=()=>{if(sensorReady&&performance.now()-lastSensor<1000){baseline=angle;sensorText('현재 자세를 중립으로 보정했습니다');}else void enableSensor();};
  const orientationReset=()=>{baseline=null;stop();};screen.orientation?.addEventListener('change',orientationReset);window.addEventListener('orientationchange',orientationReset);
  $('race-fullscreen').onclick=()=>fullscreen(true);
  function hold(element,on,off){let pointer=null;element.addEventListener('pointerdown',e=>{if(!allowed()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;element.setPointerCapture(pointer);on();});const release=e=>{if(e.pointerId!==pointer)return;pointer=null;off();};for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,release);resets.push(()=>{const previous=pointer;pointer=null;if(previous!==null&&element.hasPointerCapture?.(previous))element.releasePointerCapture(previous);off();});}
  for(const key of ['brake','throttle']){const button=$('race-'+key);hold(button,()=>{input[key]=1;button.classList.add('pressed');},()=>{input[key]=0;button.classList.remove('pressed');});}
  hold($('race-left'),()=>touchSteer=-1,()=>touchSteer=0);hold($('race-right'),()=>touchSteer=1,()=>touchSteer=0);
  setInterval(()=>{
    if(root.hidden)return;const value=sensorReady&&lastSensor&&performance.now()-lastSensor<750&&baseline!==null?Math.max(-1,Math.min(1,(angle-baseline)/(state?.race.steeringRange||50))):0;
    input.steer=touchSteer||(Math.abs(value)<.035?0:value);$('race-wheel').style.transform=`rotate(${input.steer*115}deg)`;
    if(allowed())send({type:'input',...input});
  },50);
  return {stop,offline(){enabled=false;stop();sensorText('연결 끊김 · 재접속 중');},hide(){if(!root.hidden)stop();enabled=false;root.hidden=true;state=null;document.body.classList.remove('racing-phone');},update(m,p){
    document.title='POCKET RACING · 운전석';
    state=m;if(p.viewMode!==viewMode)send({type:'race-view',viewMode});root.hidden=false;document.body.classList.add('racing-phone');enabled=m.phase==='running'&&m.race.countdown===0&&p.finishedAt===null;if(!enabled)stop();
    if(!scene){try{scene=createRaceScene($('race-view'),{viewMode});}catch{sensorText('3D 화면을 열지 못했습니다. WebGL 지원 브라우저로 접속하세요.');}}scene?.update(m,p.id);drawRaceMinimap($('race-minimap'),m,p.id);
    $('race-driver').textContent=`${m.players.findIndex(q=>q.id===p.id)+1} · ${p.name}`;$('race-driver').style.color=p.color;
    $('race-lap').textContent=`LAP ${Math.min(p.lap+1,m.race.laps)} / ${m.race.laps}`;$('race-rank').textContent=`${p.rank} / ${m.players.length}위`;$('race-speed').textContent=(p.speed<0?'R ':'')+Math.round(Math.abs(p.speed)*3.6);
    $('race-countdown').textContent=m.phase==='running'&&m.race.countdown>0?Math.ceil(m.race.countdown):p.offroad?'코스 밖 · 감속':p.finishedAt!==null?'완주!':'';
    $('race-garage').hidden=m.phase!=='lobby';$('race-finish').hidden=m.phase!=='finished';
    if(m.phase==='lobby'){
      if(!$('race-car-list').children.length)for(const [index,car]of m.race.cars.entries()){
        const button=document.createElement('button');button.className='race-car-choice';button.dataset.car=car.id;
        const art=document.createElement('canvas');art.className='race-car-art';art.setAttribute('aria-label',car.name+' 입체 모델 미리보기');renderCarPreview(art,car.id,p.color);
        const title=document.createElement('strong');title.textContent=`${index+1} · ${car.name}`;const info=document.createElement('small');info.textContent=car.description;
        button.append(art,title,info);button.onclick=()=>send({type:'car',car:car.id});$('race-car-list').append(button);
      }
      for(const button of $('race-car-list').children){button.setAttribute('aria-pressed',String(button.dataset.car===p.car));button.style.setProperty('--car-color',p.color);if(button.dataset.color!==p.color){renderCarPreview(button.querySelector('canvas'),button.dataset.car,p.color);button.dataset.color=p.color;}}
      $('race-garage-status').textContent=`${m.circuit.name} · ${(m.circuit.length/1000).toFixed(2)} km · 내 색상 ${m.players.findIndex(q=>q.id===p.id)+1}번 · ${m.race.laps}바퀴 · 충돌 사용 · PC에서 시작을 기다리는 중`;$('race-garage-status').style.color=p.color;
    }
    if(m.phase==='finished'){
      const results=$('race-finish');results.replaceChildren();const heading=document.createElement('h1');heading.textContent='체커기!';results.append(heading);
      for(const r of m.results.players){const row=document.createElement('p');row.style.color=r.color;row.textContent=`${r.rank}위 · ${r.name} · ${r.time===null?`${r.lap}바퀴 · 미완주`:`${r.time.toFixed(2)}초`}`;results.append(row);}
      const note=document.createElement('p');note.textContent='PC에서 대기실로 돌아가면 다시 차량을 선택할 수 있어요.';results.append(note);
    }
  }};
}
