import {bindPad} from './pointer-pad.js';
import {createCabView} from './cab-view.js';
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
const canControl=()=>active&&!portrait.matches&&document.activeElement!==$('chat-input');
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
async function landscapeFullscreen(){
  // Fullscreen and orientation locking have independent browser support.
  try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();}catch{}
  try{await screen.orientation?.lock?.('landscape');}catch{}
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
if(m.type==='state'){const p=m.players.find(p=>p.id===id);if(!p)return;active=m.phase==='running'&&m.game==='excavator';if(!active)stop();
if(m.game==='excavator')cab.update(m,id);
for(const view of document.querySelectorAll('[data-game]'))view.classList.toggle('hidden',view.dataset.game!==m.game);
$('controller').dataset.state=active?'running':m.phase;
$('control-status').textContent=m.game!=='excavator'?'이 게임의 컨트롤러를 준비 중입니다.':m.phase==='lobby'?'PC에서 경기를 시작하면 조작할 수 있습니다.':m.phase==='finished'?'경기가 끝났습니다. PC에서 다음 경기를 준비하세요.':'조작 중 · 공유 화면에서 내 번호와 팀 색상을 확인하세요.';
document.documentElement.style.setProperty('--accent',m.teams[p.team].color);$('identity').textContent=`${m.players.findIndex(q=>q.id===id)+1}번 · 팀 ${p.team+1} · ${p.name}`;$('cargo').textContent=`버킷 ${p.cargo} / 40`;$('phase').textContent=m.phase==='lobby'?'대기실':m.phase==='finished'?'경기 종료':`${Math.ceil(m.remaining)}초`;$('message').textContent=p.message?.replaceAll('흙','모래')||'모래더미 가까이 버킷을 내린 뒤 닫으세요';}};
ws.onclose=e=>{chatConnected(false);stop();cab.offline();active=false;$('controller').dataset.state='offline';$('control-status').textContent='연결이 끊겼습니다. 재접속하는 동안 조작이 멈춥니다.';if(e.code===4001){removed=true;$('message').textContent='다른 탭에서 운전석에 접속했습니다.';}if(!removed){$('phase').textContent='재접속 중';retry=setTimeout(connect,1200);}};}
$('join-button').onclick=()=>{void landscapeFullscreen();removed=false;$('join-error').textContent='';$('join-button').disabled=true;connect();};if(saved)connect();
pads.push(bindPad($('left'),(x,y)=>{input.swing=x;input.stick=-y;showParts();},{eightWay:true,enabled:canControl}));
pads.push(bindPad($('right'),(x,y)=>{input.curl=-x;input.boom=y;showParts();},{eightWay:true,enabled:canControl}));
for(const key of ['travelL','travelR'])pads.push(bindPad($(key),(_,y)=>{input[key]=-y;showParts();},{vertical:true,enabled:canControl}));
setInterval(()=>{if(canControl()&&document.visibilityState==='visible')send({type:'input',...input});},50);
portrait.addEventListener('change',stop);
document.addEventListener('fullscreenchange',()=>{stop();if(document.fullscreenElement){try{const lock=screen.orientation?.lock?.('landscape');lock?.catch(()=>{});}catch{}}});
document.addEventListener('visibilitychange',stop);window.addEventListener('blur',stop);window.addEventListener('pagehide',stop);
$('fullscreen').onclick=landscapeFullscreen;
$('landscape-button').onclick=landscapeFullscreen;


