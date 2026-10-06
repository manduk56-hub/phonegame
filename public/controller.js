import {createBullController} from './bull-controller.js';
import {createFpsController} from './fps-controller.js';
import {bindPad} from './pointer-pad.js';
import {createCabView} from './cab-view.js';
import {createRaceController} from './race-controller.js';
// Keep results bundled: deployed servers may not expose a /results.js route.
function renderResults(container,state,playerId) {
  container.hidden=state.phase!=='finished'||!state.results;
  if(container.hidden){container.replaceChildren();delete container.dataset.signature;return;}
  const r=state.results,signature=JSON.stringify([r,playerId]);
  if(container.dataset.signature===signature)return;
  container.dataset.signature=signature;
  const element=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
  const water=r.mode==='water',fps=r.mode==='fps';
  const winners=r.winnerIds.map(id=>`팀 ${id+1}`).join(' · ');
  const title=winners?`${winners} ${r.winnerIds.length>1?'공동 우승!':'우승!'}`:'이번 경기는 무승부';
  const heading=element('h2',title,'result-winner');
  const summary=element('p',water?(r.timedOut?'시간 종료 · 목표선에 도달한 팀이 없어 무승부입니다.':'목표선에 물이 도달했습니다!'):fps?`깃발 쟁탈전 종료 · 운반 ${r.total}회`:`작업 완료! 최종 확보 모래 ${r.total}점`);
  const sections=element('div','','result-columns');
  function standings(title,entries,personal=false){
    const section=element('section','');section.append(element('h3',title));
    const list=element('ol','','result-ranking');
    for(const item of entries){
      const row=element('li','','result-row');
      if(personal)row.classList.add('personal');
      if(personal&&item.id===playerId)row.classList.add('is-me');
      const name=personal?`${item.name} · 팀 ${item.team+1}${item.id===playerId?' (나)':''}`:`팀 ${item.id+1}`;
      row.style.setProperty('--team',state.teams[personal?item.team:item.id].color);
      row.append(element('span',`${item.rank}위`),element('strong',name),element('span',water?(personal?`굴착 ${item.score}`:`물길 ${item.score}%${item.time!==null?' · '+item.time.toFixed(2)+'초':''}`):fps?(personal?`깃발 ${item.score} · ${item.kills}킬 · ${item.deaths}데스`:`깃발 ${item.score}점`):personal?`운반 ${item.score} · 방해 ${item.disrupted??0}`:`${item.score}점`,personal?'result-metrics':undefined));list.append(row);
    }
    section.append(list);return section;
  }
  sections.append(standings('팀 최종 순위',r.teams),standings(water?'개인 굴착 기록':fps?'개인 전투 기록':'개인 운반 기록',r.players,true));
  const note=element('p','팀 점수는 최종 모래량입니다. 개인 운반량은 자기 팀에 내려놓은 누적량, 방해량은 상대 팀 구역에서 퍼낸 누적량입니다. 반복한 작업도 포함하며 개인 순위는 운반량 기준입니다.','result-note');
  if(water)note.textContent='폭포와 연결된 물이 목표선에 먼저 도착한 팀이 우승합니다. 개인 기록은 파낸 흙의 양입니다.';
  if(fps)note.textContent='팀 순위는 깃발 운반 횟수 기준입니다. 처치 횟수는 팀 점수에 포함되지 않습니다.';
  if(!water&&!fps&&playerId){const me=r.players.find(p=>p.id===playerId);if(me)summary.textContent+=` · 내 기록 ${me.rank}위 / 운반 ${me.score} · 방해 ${me.disrupted??0}`;}
  container.replaceChildren(element('span','FINAL RESULTS','eyebrow'),heading,summary,sections,note,element('p','진행자가 대기실로 돌아가면 다음 경기를 준비합니다.','result-note'));
  if(playerId){
    container.classList.remove('expanded');
    const toggle=element('button','전체 순위 보기');toggle.type='button';toggle.setAttribute('aria-expanded','false');
    toggle.onclick=()=>{const open=container.classList.toggle('expanded');toggle.textContent=open?'순위 접고 조작하기':'전체 순위 보기';toggle.setAttribute('aria-expanded',String(open));};
    container.prepend(toggle);
  }
}
const $=id=>document.getElementById(id), room=new URLSearchParams(location.search).get('room');
const storageKey=`dirt-rally:${location.host}:${room}`;
let saved;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
let ws,id,removed=false,active=false,retry,connectedGame;
const pads=[];
const input={travelL:0,travelR:0,swing:0,boom:0,stick:0,curl:0};
const cab=createCabView($('cab-view'),$('cab-status'));
const partGuides=[...document.querySelectorAll('[data-part]')];
function showParts(){for(const part of partGuides)part.classList.toggle('moving',Math.abs(input[part.dataset.part]||0)>.05);}
const portrait=window.matchMedia('(orientation: portrait)');
const canControl=()=>active&&!portrait.matches&&document.activeElement!==$('chat-input')&&$('browser-choice').classList.contains('hidden');
// iOS cannot expose installed apps to a web page. Offer explicit app links;
// the OS opens them only when the chosen browser is installed.
const iosSafari=/iPhone|iPod/.test(navigator.userAgent)&&/Safari/.test(navigator.userAgent)&&!/CriOS|EdgiOS|FxiOS|OPiOS/.test(navigator.userAgent);
const standalone=navigator.standalone||window.matchMedia('(display-mode: standalone)').matches;
let browserChosen=false;try{browserChosen=sessionStorage.getItem('dirt-rally:browser-chosen')==='yes';}catch{}
if(iosSafari&&!standalone&&!browserChosen){
  const url=location.href;
  $('open-chrome').href=url.replace(/^https?:/,location.protocol==='https:'?'googlechromes:':'googlechrome:');
  $('browser-choice').classList.remove('hidden');
  $('join').inert=true;
  $('controller').inert=true;
  document.querySelector('.rotate-screen').inert=true;
  $('open-chrome').focus();
}
$('browser-continue').onclick=()=>{
  $('browser-choice').classList.add('hidden');$('join').inert=false;$('controller').inert=false;
  document.querySelector('.rotate-screen').inert=false;
  try{sessionStorage.setItem('dirt-rally:browser-chosen','yes');}catch{}
  if(!portrait.matches)$($('join').classList.contains('hidden')?'fullscreen':'name').focus();
};
function chatConnected(connected){$('chat-input').disabled=!connected;$('chat-send').disabled=!connected;}
function appendChat(message){
  const line=document.createElement('div');line.className='chat-line';
  const name=document.createElement('strong');name.textContent=`${message.name}: `;
  line.append(name,document.createTextNode(message.text));$('chat-history').append(line);
  while($('chat-history').children.length>50)$('chat-history').firstElementChild.remove();
  $('chat-latest').textContent=`${message.name}: ${message.text}`;
  $('chat-history').scrollTop=$('chat-history').scrollHeight;
}
$('chat-toggle').onclick=()=>{const open=$('chat-toggle').getAttribute('aria-expanded')!=='true';$('chat-toggle').setAttribute('aria-expanded',String(open));$('chat-history').classList.toggle('hidden',!open);$('chat-history').scrollTop=$('chat-history').scrollHeight;};
$('chat-input').addEventListener('focus',stop);
$('chat-form').addEventListener('submit',event=>{
  event.preventDefault();const text=$('chat-input').value.trim();
  if(!text||!id||ws?.readyState!==1||ws.bufferedAmount>=4096)return;
  send({type:'chat',text});$('chat-input').value='';$('chat-input').blur();$('chat-error').classList.add('hidden');
});
const root=document.documentElement;
const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fullscreenRequest=()=>{
  if(typeof root.requestFullscreen==='function'&&document.fullscreenEnabled!==false)return root.requestFullscreen.bind(root);
  if(typeof root.webkitRequestFullscreen==='function'&&document.webkitFullscreenEnabled!==false)return root.webkitRequestFullscreen.bind(root);
  return null;
};
// Older Samsung/WebKit implementations return void before entering fullscreen.
// Register events before invoking the API, and bound the wait if it never settles.
function enterFullscreen(request){
  return new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{clearTimeout(timer);for(const event of ['fullscreenchange','webkitfullscreenchange'])document.removeEventListener(event,changed);for(const event of ['fullscreenerror','webkitfullscreenerror'])document.removeEventListener(event,failed);};
    const finish=(error)=>{cleanup();error?reject(error):resolve();};
    const changed=()=>{if(fullscreenElement())finish();};
    const failed=()=>finish(new Error('Fullscreen rejected'));
    for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,changed);
    for(const event of ['fullscreenerror','webkitfullscreenerror'])document.addEventListener(event,failed);
    timer=setTimeout(failed,2500);
    try{Promise.resolve(request({navigationUI:'hide'})).then(changed,failed);}catch{failed();}
  });
}
let fullscreenPending=false;
const manualRotationHelp=/iPhone|iPod/.test(navigator.userAgent)
  ?'제어 센터의 세로 방향 잠금을 해제하고 아이폰을 가로로 돌려주세요.'
  :'휴대폰의 자동 회전을 켜고 가로로 돌려주세요.';
function updateFullscreenButtons(){
  const supported=Boolean(fullscreenRequest());
  $('fullscreen').textContent=supported?'전체화면':'화면 안내';
  $('landscape-button').textContent=supported?'가로 전체화면':'가로 사용 안내';
  if(!supported)$('rotation-help').textContent=`이 브라우저에서는 버튼으로 전체화면을 켤 수 없습니다. ${manualRotationHelp}`;
}
function fullscreenFeedback(message){
  $('rotation-help').textContent=message;
  $('fullscreen-notice-text').textContent=message;$('fullscreen-notice').classList.remove('hidden');
}
$('fullscreen-notice-close').onclick=()=>$('fullscreen-notice').classList.add('hidden');
async function landscapeFullscreen(showFeedback=false){
  if(fullscreenPending)return;
  fullscreenPending=true;
  for(const id of ['fullscreen','landscape-button'])$(id).disabled=true;
  stop();
  let full=Boolean(fullscreenElement()),locked=false,requestFailed=false;
  const request=fullscreenRequest();
  try{if(!full&&request){await enterFullscreen(request);full=Boolean(fullscreenElement());}}catch{requestFailed=true;}
  try{
    if(full||standalone){
      if(typeof screen.orientation?.lock==='function'){
        let timer;
        try{await Promise.race([screen.orientation.lock('landscape'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Orientation timeout')),2500);})]);locked=true;}finally{clearTimeout(timer);}
      }else{
        const lock=screen.lockOrientation||screen.webkitLockOrientation||screen.mozLockOrientation;
        if(typeof lock==='function')locked=lock.call(screen,'landscape')===true;
      }
    }
  }catch{}
  fullscreenPending=false;
  for(const id of ['fullscreen','landscape-button'])$(id).disabled=false;
  $('rotation-help').textContent=manualRotationHelp;
  updateFullscreenButtons();
  if(showFeedback){
    if(!full&&!standalone){
      const reason=requestFailed?'브라우저가 전체화면 요청을 거절했습니다.':'이 접속 화면에서는 전체화면을 켤 수 없습니다.';
      const alternative=/iPhone|iPod/.test(navigator.userAgent)
        ?'주소창 없이 사용하려면 Safari 공유 → 홈 화면에 추가 후 아이콘으로 실행하세요.'
        :'QR 앱 안에서 열렸다면 메뉴의 ‘브라우저에서 열기’로 Chrome 또는 삼성 인터넷에서 다시 접속해주세요.';
      fullscreenFeedback(`${reason} ${manualRotationHelp} ${alternative}`);
    }
    else if(portrait.matches&&!locked)fullscreenFeedback(`가로 방향은 직접 변경해야 합니다. ${manualRotationHelp}`);
    else $('fullscreen-notice').classList.add('hidden');
  }
}
const send=m=>{if(ws?.readyState===1&&ws.bufferedAmount<4096)ws.send(JSON.stringify(m));};
const race=createRaceController({send,fullscreen:landscapeFullscreen});
const bull=createBullController({send,fullscreen:landscapeFullscreen});
const fps=createFpsController({send,fullscreen:landscapeFullscreen});
function remember(value){try{if(value)localStorage.setItem(storageKey,JSON.stringify(value));else localStorage.removeItem(storageKey);}catch{}}
function stop(){for(const reset of pads)reset();for(const k of Object.keys(input))input[k]=0;showParts();race.stop();fps.stop();bull.stop();send({type:'input',...input});}
function connect(){clearTimeout(retry);id=null;active=false;chatConnected(false);stop();ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);ws.onopen=()=>send({type:'join',room,name:$('name').value,token:saved?.token});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='joined'){id=m.id;chatConnected(true);saved={token:m.token};remember(saved);$('join').classList.add('hidden');$('controller').classList.remove('hidden');$('join-button').disabled=false;return;}
if(m.type==='chat-history'){
  $('chat-history').replaceChildren();$('chat-latest').textContent='아직 메시지가 없습니다.';
  for(const message of m.messages)appendChat(message);return;
}
if(m.type==='chat'){appendChat(m.message);return;}
if(m.type==='chat-error'){$('chat-error').textContent=m.message;$('chat-error').classList.remove('hidden');return;}
if(m.type==='removed'){removed=true;remember(null);saved=null;$('join').classList.remove('hidden');$('controller').classList.add('hidden');$('join-error').textContent='진행자가 참가자를 제외했습니다.';return;}
if(m.type==='error'){if(!id){removed=true;$('join').classList.remove('hidden');$('controller').classList.add('hidden');$('join-error').textContent=m.message;$('join-button').disabled=false;ws.close();}else $('message').textContent=m.message;return;}
if(m.type==='state'){const p=m.players.find(p=>p.id===id);if(!p)return;if(connectedGame!==m.game){active=false;stop();connectedGame=m.game;$('results').hidden=true;document.title=m.game==='racing'?'POCKET RACING · 운전석':'플레이룸 · 포크레인 운전석';}if(m.game==='bull'){active=false;race.hide();fps.hide();bull.update(m,p);return;}bull.hide();if(m.game==='fps'){active=false;race.hide();fps.update(m,p);return;}fps.hide();if(m.game==='racing'){active=false;race.update(m,p);return;}race.hide();const ceremony=m.phase==='finished'&&m.results?.winnerIds.includes(p.team);active=(m.phase==='running'||ceremony)&&m.game==='excavator';if(!active)stop();
renderResults($('results'),m,id);
if(m.game==='excavator')cab.update(m,id);
for(const view of document.querySelectorAll('[data-game]'))view.classList.toggle('hidden',view.dataset.game!==m.game);
$('controller').dataset.state=active?'running':m.phase;
$('control-status').textContent=m.game!=='excavator'?'이 게임의 컨트롤러를 준비 중입니다.':m.phase==='lobby'?'PC에서 경기를 시작하면 조작할 수 있습니다.':ceremony?'우승 세리머니! 상부·붐·암·버킷을 움직여 보세요.':m.phase==='finished'?'경기가 끝났습니다. PC에서 다음 경기를 준비하세요.':'조작 중 · 공유 화면에서 내 번호와 팀 색상을 확인하세요.';
document.documentElement.style.setProperty('--accent',m.teams[p.team].color);$('identity').textContent=`${m.players.findIndex(q=>q.id===id)+1}번 · 팀 ${p.team+1} · ${p.name}`;$('cargo').textContent=`버킷 ${Math.round(p.cargo)} / 40`;$('phase').textContent=m.phase==='lobby'?'대기실':m.phase==='finished'?'경기 종료':`${Math.ceil(m.remaining)}초`;$('message').textContent=(m.water?p.message:p.message?.replaceAll('흙','모래'))||(m.water?`우리 팀 물길 ${Math.floor(m.water.lanes[p.team].progress)}% · 버킷을 내리며 이어 파고 흙은 물길 밖에 버리세요`:'모래더미 가까이 버킷을 내린 뒤 닫으세요');}};
ws.onclose=e=>{chatConnected(false);stop();race.offline();fps.offline();bull.offline();cab.offline();active=false;$('controller').dataset.state='offline';$('control-status').textContent='연결이 끊겼습니다. 재접속하는 동안 조작이 멈춥니다.';if(e.code===4001){removed=true;$('message').textContent='다른 탭에서 운전석에 접속했습니다.';}if(!removed){$('phase').textContent='재접속 중';retry=setTimeout(connect,1200);}};}
$('join-button').onclick=()=>{void landscapeFullscreen();removed=false;$('join-error').textContent='';$('join-button').disabled=true;connect();};if(saved)connect();
// Models face +Z: positive Y rotation turns left from the driver's seat.
pads.push(bindPad($('left'),(x,y)=>{input.swing=-x;input.stick=-y;showParts();},{eightWay:true,enabled:canControl}));
pads.push(bindPad($('right'),(x,y)=>{input.curl=-x;input.boom=-y;showParts();},{eightWay:true,enabled:canControl}));
for(const key of ['travelL','travelR'])pads.push(bindPad($(key),(_,y)=>{input[key]=-y;showParts();},{vertical:true,enabled:canControl}));
setInterval(()=>{if(canControl()&&document.visibilityState==='visible')send({type:'input',...input});},50);
portrait.addEventListener('change',stop);
// Request orientation once, after fullscreen resolves. A second request from
// fullscreenchange can abort the in-flight lock in mobile browsers.
document.addEventListener('fullscreenchange',()=>{stop();updateFullscreenButtons();});
document.addEventListener('webkitfullscreenchange',()=>{stop();updateFullscreenButtons();fitViewport();});
document.addEventListener('visibilitychange',stop);window.addEventListener('blur',stop);window.addEventListener('pagehide',stop);
$('fullscreen').onclick=()=>landscapeFullscreen(true);
$('landscape-button').onclick=()=>landscapeFullscreen(true);
updateFullscreenButtons();

// Safari's browser chrome and keyboard can resize the visible viewport without
// resizing the layout viewport. Reserve only the space actually on screen.
const shell=$('controller'), controls=shell.querySelector('.controls');
let viewportFrame;
function setTopHidden(hidden){
  shell.dataset.topHidden=String(hidden);
  $('top-toggle').textContent=hidden?'상단 보이기':'상단 숨기기';
  $('top-toggle').setAttribute('aria-expanded',String(!hidden));
}
try{setTopHidden(localStorage.getItem('dirt-rally:top-hidden')==='yes');}catch{setTopHidden(false);}
$('top-toggle').onclick=()=>{
  stop();
  if(document.activeElement===$('chat-input'))$('chat-input').blur();
  const hidden=shell.dataset.topHidden!=='true';
  setTopHidden(hidden);
  if(hidden){$('chat-history').classList.add('hidden');$('chat-toggle').setAttribute('aria-expanded','false');}
  try{localStorage.setItem('dirt-rally:top-hidden',hidden?'yes':'no');}catch{}
  fitViewport();
};
function fitControls(){
  const height=controls.getBoundingClientRect().height;
  if(!height)return;
  const armLabels=Math.max(...[...shell.querySelectorAll('.arm-controls')].map(arm=>
    [...arm.children].filter(child=>!child.classList.contains('pad')).reduce((sum,child)=>sum+child.getBoundingClientRect().height,0)));
  const padHeight=Math.max(0,height-armLabels-14);
  const driveLabels=Math.max(...[...shell.querySelectorAll('.side-drive')].map(drive=>
    [...drive.querySelectorAll('.track-label')].reduce((sum,child)=>sum+child.getBoundingClientRect().height,0)));
  const trackHeight=Math.max(0,height-driveLabels-14);
  shell.style.setProperty('--control-height',`${height}px`);
  shell.style.setProperty('--available-pad-height',`${padHeight}px`);
  shell.style.setProperty('--available-track-height',`${trackHeight}px`);
  // Align the surfaces without changing their sizes. Leave asymmetric room
  // for the taller labels above them and the shorter labels below them.
  const groups=[...shell.querySelectorAll('.arm-controls,.side-drive')];
  const extents=groups.map(group=>{
    const children=[...group.children],surface=children[1];
    const half=surface.getBoundingClientRect().height/2;
    return {top:children[0].getBoundingClientRect().height+half,bottom:children[2].getBoundingClientRect().height+half};
  });
  const offset=(Math.max(...extents.map(e=>e.top))-Math.max(...extents.map(e=>e.bottom)))/2;
  shell.style.setProperty('--control-center-offset',`${offset}px`);
}
function fitViewport(){
  cancelAnimationFrame(viewportFrame);
  viewportFrame=requestAnimationFrame(()=>{
    const viewport=window.visualViewport;
    const height=viewport?.height||window.innerHeight;
    shell.style.setProperty('--visible-height',`${height}px`);
    shell.style.setProperty('--visible-top',`${viewport?.offsetTop||0}px`);
    shell.dataset.compact=String(height<=360);
    fitControls();
  });
}
new ResizeObserver(fitControls).observe(controls);
window.addEventListener('resize',()=>{stop();fitViewport();});
window.visualViewport?.addEventListener('resize',()=>{stop();fitViewport();});
window.visualViewport?.addEventListener('scroll',fitViewport);
portrait.addEventListener('change',fitViewport);
document.addEventListener('fullscreenchange',fitViewport);
fitViewport();


