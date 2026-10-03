import {bindPad} from './pointer-pad.js';
import {createCabView} from './cab-view.js';
import {renderResults} from './results.js';
const $=id=>document.getElementById(id), room=new URLSearchParams(location.search).get('room');
const storageKey=`dirt-rally:${location.host}:${room}`;
let saved;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
let ws,id,removed=false,active=false,retry;
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
  $('open-edge').href=url.replace(/^https?:/,location.protocol==='https:'?'microsoft-edge-https:':'microsoft-edge-http:');
  $('open-firefox').href=`firefox://open-url?url=${encodeURIComponent(url)}`;
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
  if(portrait.matches)$('rotation-help').textContent=message;
  else{$('fullscreen-notice-text').textContent=message;$('fullscreen-notice').classList.remove('hidden');}
}
$('fullscreen-notice-close').onclick=()=>$('fullscreen-notice').classList.add('hidden');
async function landscapeFullscreen(showFeedback=false){
  stop();
  let full=Boolean(fullscreenElement()),locked=false,requestFailed=false;
  const request=fullscreenRequest();
  try{if(!full&&request){await request({navigationUI:'hide'});full=Boolean(fullscreenElement());}}catch{requestFailed=true;}
  try{if(typeof screen.orientation?.lock==='function'){await screen.orientation.lock('landscape');locked=true;}}catch{}
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
function remember(value){try{if(value)localStorage.setItem(storageKey,JSON.stringify(value));else localStorage.removeItem(storageKey);}catch{}}
function stop(){for(const reset of pads)reset();for(const k of Object.keys(input))input[k]=0;showParts();send({type:'input',...input});}
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
if(m.type==='state'){const p=m.players.find(p=>p.id===id);if(!p)return;const ceremony=m.phase==='finished'&&m.results?.winnerIds.includes(p.team);active=(m.phase==='running'||ceremony)&&m.game==='excavator';if(!active)stop();
renderResults($('results'),m,id);
if(m.game==='excavator')cab.update(m,id);
for(const view of document.querySelectorAll('[data-game]'))view.classList.toggle('hidden',view.dataset.game!==m.game);
$('controller').dataset.state=active?'running':m.phase;
$('control-status').textContent=m.game!=='excavator'?'이 게임의 컨트롤러를 준비 중입니다.':m.phase==='lobby'?'PC에서 경기를 시작하면 조작할 수 있습니다.':ceremony?'우승 세리머니! 상부·붐·암·버킷을 움직여 보세요.':m.phase==='finished'?'경기가 끝났습니다. PC에서 다음 경기를 준비하세요.':'조작 중 · 공유 화면에서 내 번호와 팀 색상을 확인하세요.';
document.documentElement.style.setProperty('--accent',m.teams[p.team].color);$('identity').textContent=`${m.players.findIndex(q=>q.id===id)+1}번 · 팀 ${p.team+1} · ${p.name}`;$('cargo').textContent=`버킷 ${p.cargo} / 40`;$('phase').textContent=m.phase==='lobby'?'대기실':m.phase==='finished'?'경기 종료':`${Math.ceil(m.remaining)}초`;$('message').textContent=p.message?.replaceAll('흙','모래')||'모래더미 가까이 버킷을 내린 뒤 닫으세요';}};
ws.onclose=e=>{chatConnected(false);stop();cab.offline();active=false;$('controller').dataset.state='offline';$('control-status').textContent='연결이 끊겼습니다. 재접속하는 동안 조작이 멈춥니다.';if(e.code===4001){removed=true;$('message').textContent='다른 탭에서 운전석에 접속했습니다.';}if(!removed){$('phase').textContent='재접속 중';retry=setTimeout(connect,1200);}};}
$('join-button').onclick=()=>{void landscapeFullscreen();removed=false;$('join-error').textContent='';$('join-button').disabled=true;connect();};if(saved)connect();
// Models face +Z: positive Y rotation turns left from the driver's seat.
pads.push(bindPad($('left'),(x,y)=>{input.swing=-x;input.stick=-y;showParts();},{eightWay:true,enabled:canControl}));
pads.push(bindPad($('right'),(x,y)=>{input.curl=-x;input.boom=y;showParts();},{eightWay:true,enabled:canControl}));
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


