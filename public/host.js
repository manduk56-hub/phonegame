import {renderResults} from './results.js';
const $=id=>document.getElementById(id);
const lobby=document.querySelector('main.shell');
lobby.hidden=true;
const hub=document.createElement('main');
hub.className='game-hub';
const catalog=[
  {title:'플레이룸',subtitle:'포크레인 모래 쟁탈전',type:'팀 대결',description:'휴대폰을 운전석으로! 포크레인을 조작해 우리 팀 구역에 가장 많은 모래를 모으세요.',meta:'2–16명 · 1–10분 · 휴대폰 컨트롤러',ready:true},
  {title:'POCKET RACING',subtitle:'작은 차, 커다란 승부',type:'레이싱',description:'친구들과 함께 달리는 미니 레이싱. 새로운 경기장을 준비하고 있어요.'},
  {title:'KITCHEN PANIC',subtitle:'우당탕탕 협동 주방',type:'협동',description:'주문이 쏟아지는 주방에서 함께 요리하세요. 새로운 협동 게임을 준비하고 있어요.'},
  {title:'PARTY MIX',subtitle:'다 같이 즐기는 미니게임',type:'파티',description:'짧고 신나는 미니게임으로 한판 더! 새로운 파티 게임을 준비하고 있어요.'}
];
const illustrations=[
  '<path fill="#7d805b" d="M0 135h400v25H0z"/><path fill="#e4c18c" d="m265 135 53-56 46 56z"/><rect x="83" y="113" width="147" height="28" rx="12" fill="#252b30"/><path stroke="#555c58" stroke-width="16" stroke-dasharray="1 24" d="M99 127h120"/><path fill="#f1b94a" d="M95 84h133v30H95z"/><path fill="#252b30" d="M105 40h62v48h-62z"/><path fill="#c9e4e2" d="M114 49h43v30h-43z"/><path fill="none" stroke="#252b30" stroke-width="19" d="m194 88 45-61 53 59"/><path fill="none" stroke="#f1b94a" stroke-width="12" d="m194 88 45-61 53 59"/><path fill="#252b30" d="m277 82 36 6-11 27-23-7z"/>',
  '<path fill="#4d657a" d="M0 97h400v63H0z"/><path stroke="#d9e3dc" stroke-width="4" stroke-dasharray="35 35" d="M10 127h400"/><path fill="#ed795e" d="M110 73h68v32h-68z"/><path fill="#f2d37b" d="M230 73h68v32h-68z"/><path fill="#dce9e9" d="M122 52h42v24h-42zm120 0h42v24h-42z"/><g fill="#252b30"><circle cx="122" cy="106" r="11"/><circle cx="166" cy="106" r="11"/><circle cx="242" cy="106" r="11"/><circle cx="286" cy="106" r="11"/></g>',
  '<path fill="#252b30" d="M120 106h160v16H120zm18 16h18v30h-18zm106 0h18v30h-18z"/><circle cx="200" cy="80" r="37" fill="#f1d077"/><path fill="#fff2ca" d="M175 58h50v35h-50z"/><g fill="#252b30"><circle cx="190" cy="73" r="4"/><circle cx="210" cy="73" r="4"/><path d="M187 86h26v4h-26z"/></g>',
  '<g fill="#252b30"><path d="M82 109h48v35H82zm63-32h48v35h-48zm64 32h48v35h-48zm63-32h48v35h-48z"/></g><circle cx="106" cy="87" r="22" fill="#f0c667"/><circle cx="169" cy="55" r="22" fill="#d77a88"/><circle cx="233" cy="87" r="22" fill="#80bab1"/><circle cx="296" cy="55" r="22" fill="#eee4d4"/><path stroke="#252b30" stroke-width="5" stroke-dasharray="5 10" d="M96 87h25m38-32h25m39 32h25m38-32h25"/>'
];
const art=i=>i===0?'<img class="hub-art hub-game-render" src="/assets/dirt-rally-card.png" alt="실제 게임 속 노란 포크레인이 모래를 담은 버킷을 들어 올린 모습" width="1024" height="1024">':`<svg class="hub-art art-${i}" viewBox="0 0 400 160" aria-hidden="true"><defs><pattern id="grid-${i}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="white" stroke-opacity=".13"/></pattern></defs><path fill="url(#grid-${i})" d="M0 0h400v160H0z"/>${illustrations[i]}</svg>`;
hub.innerHTML=`<header class="hub-header"><a class="hub-brand" href="#games">▦ 플레이룸 <span>함께 노는 시간</span></a><span class="hub-device">하나의 화면 · 각자의 휴대폰</span></header><section class="hub-intro"><p class="hub-kicker">PICK A GAME. MAKE A MEMORY.</p><h1>오늘은 어떤 게임을 할까요<span>?</span></h1><p>친구들을 모으고, 게임을 고르고, 함께 시작하세요.</p></section><div class="hub-layout"><section aria-label="게임 목록" class="hub-catalog">${catalog.map((g,i)=>`<button class="hub-card" data-game="${i}" aria-pressed="false">${art(i)}<span class="hub-card-heading"><strong>${g.title}</strong><span class="hub-tag">${g.type}</span></span><span class="hub-card-subtitle">${g.subtitle}</span><span class="hub-card-status ${g.ready?'is-ready':''}">${g.ready?'● 플레이 가능 <span>2–16명</span>':'준비 중 <span>COMING SOON</span>'}</span></button>`).join('')}</section><aside class="hub-detail" aria-label="선택한 게임 정보"><p class="hub-detail-kicker">선택한 게임 <span>GAME INFO ↗</span></p><div id="hub-preview"></div><h2 id="hub-title"></h2><p id="hub-subtitle"></p><p id="hub-description" aria-live="polite"></p><p id="hub-meta"></p><button id="hub-play">대기실 입장 <span>→</span></button><p class="hub-footnote" id="hub-footnote"></p></aside></div><footer class="hub-footer"><span><b>01</b> 게임 선택 <i>→</i> <b>02</b> QR로 참가 <i>→</i> <b>03</b> 함께 플레이</span><span>PLAY TOGETHER.</span></footer>`;
document.body.prepend(hub);
document.title='플레이룸 · 게임 선택';
let selectedGame=0,currentPhase='lobby';
function chooseGame(index){
  selectedGame=index;
  const game=catalog[index];
  for(const card of hub.querySelectorAll('.hub-card'))card.setAttribute('aria-pressed',String(Number(card.dataset.game)===index));
  // Use a separate pattern ID in the large preview to avoid duplicate SVG IDs.
  $('hub-preview').innerHTML=art(index).replaceAll(`grid-${index}`,`preview-grid-${index}`);
  $('hub-title').textContent=game.title;$('hub-subtitle').textContent=game.subtitle;
  $('hub-description').textContent=game.description;$('hub-meta').textContent=game.meta||`${game.type} · 새로운 게임 준비 중`;
  $('hub-play').disabled=!game.ready;$('hub-play').innerHTML=game.ready?'대기실 입장 <span>→</span>':'곧 만나요!';
  $('hub-footnote').textContent=game.ready?'대기실에서 QR코드와 팀 설정을 확인하세요.':'아직 플레이할 수 없어요. 다음 업데이트를 기다려주세요.';
}
for(const card of hub.querySelectorAll('.hub-card'))card.onclick=()=>chooseGame(Number(card.dataset.game));
const backToGames=document.createElement('button');
backToGames.className='hub-back';backToGames.textContent='← 게임 선택';
lobby.prepend(backToGames);
function showScreen(screen){
  const inLobby=screen==='dirt-rally';
  hub.hidden=inLobby;lobby.hidden=!inLobby;
  document.title=inLobby?'플레이룸 · 대기실':'플레이룸 · 게임 선택';
  if(inLobby)backToGames.focus();else hub.querySelector(`[data-game="${selectedGame}"]`).focus();
  window.scrollTo(0,0);
}
$('hub-play').onclick=()=>{if(catalog[selectedGame].ready){location.hash='dirt-rally';showScreen('dirt-rally');}};
backToGames.onclick=()=>{if(currentPhase!=='running'){location.hash='games';showScreen('games');}};
window.addEventListener('hashchange',()=>{if(currentPhase==='running'&&location.hash!=='#dirt-rally'){location.hash='dirt-rally';return;}showScreen(location.hash.slice(1));});
chooseGame(0);showScreen(location.hash.slice(1));
let config,ws,latest,retry,authenticated=false,hostKey='';
const send=m=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));};
for(let n=1;n<=8;n++)$('teams').add(new Option(`${n}개`,n));
function lockControls(){for(const id of ['teams','duration','configure','start','lobby'])$(id).disabled=true;for(const el of $('players').querySelectorAll('select,button'))el.disabled=true;}
function qr(){
  const address=$('address').value;
  $('qr').src=`/qr?address=${encodeURIComponent(address)}&room=${config.room}`;
  $('url').textContent=`${address}/controller?room=${config.room}`;
  $('room').textContent=`방 코드 ${config.room}`;
}
function updateConnection(next){
  const changed=!config||config.room!==next.room||JSON.stringify(config.addresses)!==JSON.stringify(next.addresses);
  config=next;
  if(changed){$('address').replaceChildren();for(const a of config.addresses)$('address').add(new Option(a,a));}
  $('address').value=config.joinAddress;
  const remote=config.hostAuth==='token';
  for(const id of ['address','url','network-help'])$(id).hidden=remote;
  qr();
}
function render(m){
  currentPhase=m.phase;
  backToGames.disabled=m.phase==='running';
  backToGames.title=backToGames.disabled?'대기실로 돌아온 뒤 게임을 변경하세요.':'';
  if(m.phase==='running'&&!hub.hidden){location.hash='dirt-rally';showScreen('dirt-rally');}
  renderResults($('results'),m);
  if(m.connection&&m.connection.address!==$('address').value){$('address').value=m.connection.address;qr();}
  const signature=JSON.stringify([m.phase,m.teamCount,m.duration,m.players.map(p=>[p.id,p.name,p.team,p.connected])]);
  $('status').textContent=`${m.players.filter(p=>p.connected).length}/16 접속 · ${m.phase==='lobby'?'대기':m.phase==='running'?`${Math.ceil(m.remaining)}초`:'종료'}`;
  $('scores').replaceChildren(...m.teams.map(t=>{const d=document.createElement('div');d.className='score';d.style.color=t.color;d.textContent=`팀 ${t.id+1} · ${t.dirt} 모래`;return d;}));
  if(signature===latest)return;
  latest=signature;
  $('teams').value=m.teamCount;$('duration').value=m.duration;
  const locked=m.phase!=='lobby';
  for(const id of ['teams','duration','configure'])$(id).disabled=locked;
  $('start').disabled=locked||!m.players.some(p=>p.connected);$('lobby').disabled=false;
  $('players').replaceChildren(...m.players.map((p,i)=>{
    const card=document.createElement('div');card.className='player';card.style.setProperty('--team',m.teams[p.team].color);
    const name=document.createElement('strong');name.textContent=`${i+1}. ${p.name} ${p.connected?'●':'(연결 끊김)'}`;
    const row=document.createElement('div');row.className='row';
    const select=document.createElement('select');select.ariaLabel=`${p.name} 팀`;
    for(const t of m.teams)select.add(new Option(`팀 ${t.id+1}`,t.id));
    select.value=p.team;select.disabled=locked;select.onchange=()=>send({type:'assign',id:p.id,team:Number(select.value)});
    const remove=document.createElement('button');remove.textContent='제외';remove.disabled=locked;remove.onclick=()=>send({type:'remove',id:p.id});
    row.append(select,remove);card.append(name,row);return card;
  }));
}
async function connect(){
  clearTimeout(retry);lockControls();latest=null;authenticated=false;
  try{
    const next=await fetch('/config',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('서버에 연결할 수 없습니다.');return r.json();});
    if(next.app!=='dirt-rally'||next.protocol!==1)throw Error('게임 서버의 버전이 맞지 않습니다.');
    updateConnection(next);
    const remote=config.hostAuth==='token';
    $('host-auth').hidden=!remote;
    $('join-help').textContent=remote?'휴대폰으로 QR코드를 스캔하세요. 모바일 데이터로도 참가할 수 있습니다.':'PC와 같은 Wi-Fi에서 QR코드를 스캔하세요.';
    const key=remote?hostKey:config.adminKey;
    if(!key){$('error').textContent=remote?'진행자 키를 입력하세요.':'진행자는 서버 PC의 localhost 주소로 접속하세요.';return;}
    ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
    ws.onopen=()=>send({type:'host',key});
    ws.onclose=()=>{lockControls();$('status').textContent='연결 끊김 · 재접속 중';retry=setTimeout(connect,1500);};
    ws.onmessage=e=>{
      const m=JSON.parse(e.data);
      if(m.type==='error'){$('error').textContent=m.message;if(!authenticated){hostKey='';ws.onclose=()=>{lockControls();$('status').textContent='인증 필요';};ws.close();}return;}
      if(m.type!=='state')return;
      authenticated=true;$('error').textContent='';render(m);
    };
  }catch(e){$('status').textContent='서버 연결 대기';$('error').textContent=e.message;retry=setTimeout(connect,1500);}
}
$('address').onchange=()=>{qr();send({type:'network',address:$('address').value});};
$('configure').onclick=()=>send({type:'configure',teams:Number($('teams').value),duration:Number($('duration').value)});
$('start').onclick=()=>send({type:'start'});
$('lobby').onclick=()=>send({type:'lobby'});
$('host-auth').onsubmit=e=>{e.preventDefault();hostKey=$('host-key').value;$('host-key').value='';if(ws){ws.onclose=null;ws.close();}connect();};
connect();
