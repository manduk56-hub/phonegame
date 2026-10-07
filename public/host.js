import {createRaceBroadcast} from './race-broadcast.js';
import {createKrillScene} from './krill-scene.js';
const krillStyle=document.createElement('link');krillStyle.rel='stylesheet';krillStyle.href='/krill.css';document.head.append(krillStyle);
import {createBullScene} from './bull-scene.js';
import {createFishingScene} from './fishing-scene.js';
const fishingStyle=document.createElement('link');fishingStyle.rel='stylesheet';fishingStyle.href='/fishing.css';document.head.append(fishingStyle);
const bullStyle=document.createElement('link');bullStyle.rel='stylesheet';bullStyle.href='/bull.css';document.head.append(bullStyle);
import {createFpsScene} from './fps-scene.js';
const fpsStyle=document.createElement('link');fpsStyle.rel='stylesheet';fpsStyle.href='/fps.css';document.head.append(fpsStyle);
import {createWaterOverview} from './water-view.js';
import {renderResults} from './results.js';
import {createRaceScene} from './race-scene.js';
const racingStyle=document.createElement('link');racingStyle.rel='stylesheet';racingStyle.href='/race.css';document.head.append(racingStyle);
const $=id=>document.getElementById(id);
const lobby=document.querySelector('main.shell');
lobby.hidden=true;
const hub=document.createElement('main');
hub.className='game-hub';
const catalog=[
  {title:'플레이룸',subtitle:'모래 쟁탈전 · 폭포 물길 경주',type:'팀 대결',description:'휴대폰을 운전석으로! 포크레인을 조작해 우리 팀 구역에 가장 많은 모래를 모으세요.',meta:'2–16명 · 1–10분 · 휴대폰 컨트롤러',ready:true},
  {title:'POCKET RACING',subtitle:'작은 차, 커다란 승부',type:'레이싱',description:'가로로 든 폰을 기울여 핸들을 돌리고 실제 페달 모양의 버튼을 밟으세요. 여섯 스포츠카로 5바퀴를 먼저 완주하세요.',meta:'1–16명 · 5바퀴 · 차량 충돌 · 동일 성능',ready:true},
  {title:'FLAG STRIKE',subtitle:'조준하고, 탈환하고, 귀환하라',type:'FPS',description:'PC 화면 기준 방향키로 이동하고, 폰의 1인칭 십자가에 상대를 맞추세요. 벽 뒤의 상대는 맞지 않습니다. 중앙 깃발을 우리 진영으로 가져오면 1점, 사망하면 2초 후 그 자리에서 부활합니다.',meta:'2–16명 · 2–8팀 · 깃발 쟁탈전',ready:true},
  {title:'BULL RUN',subtitle:'뿔을 피하라, 끝까지 살아남아라',type:'투우',description:'한 명은 황소, 나머지는 도망자! 가속하는 황소의 뿔을 피해 원형 경기장에서 살아남으세요. 황소는 좌우 회전만 조작하며 자동으로 전진합니다.',meta:'2–16명 · 30–900초 · 랜덤/지정 황소',ready:true},
  {title:'TIDELINE',subtitle:'한 배에서 펼치는 바다 낚시 대결',type:'낚시',description:'큰 입질 때 가로 폰 윗부분을 몸 안쪽으로 당겨 챔질하세요. 물고기 방향으로 기울여 힘을 빼고 시계 방향으로 릴을 감으세요. 가장 많이 잡으면 우승!',meta:'1–16명 · 개인전 · 모션 센서 · 원형 릴',ready:true},
  {title:'KRILL ESCAPE',subtitle:'작은 크릴, 거대한 고래',type:'생존',description:'다가오는 물고기와 장애물을 피하고 고래의 흡입 구역에서 탈출하세요. 왼쪽 패드로 이동하고 꼬리치기로 살짝 밀치세요. 마지막 크릴은 고래를 타고 조종합니다!',meta:'1–16명 · 개인 생존 · 모바일 이동 · 꼬리치기',ready:true}
];
const illustrations=[
  '<path fill="#7d805b" d="M0 135h400v25H0z"/><path fill="#e4c18c" d="m265 135 53-56 46 56z"/><rect x="83" y="113" width="147" height="28" rx="12" fill="#252b30"/><path stroke="#555c58" stroke-width="16" stroke-dasharray="1 24" d="M99 127h120"/><path fill="#f1b94a" d="M95 84h133v30H95z"/><path fill="#252b30" d="M105 40h62v48h-62z"/><path fill="#c9e4e2" d="M114 49h43v30h-43z"/><path fill="none" stroke="#252b30" stroke-width="19" d="m194 88 45-61 53 59"/><path fill="none" stroke="#f1b94a" stroke-width="12" d="m194 88 45-61 53 59"/><path fill="#252b30" d="m277 82 36 6-11 27-23-7z"/>',
  '<path fill="#4d657a" d="M0 97h400v63H0z"/><path stroke="#d9e3dc" stroke-width="4" stroke-dasharray="35 35" d="M10 127h400"/><path fill="#ed795e" d="M110 73h68v32h-68z"/><path fill="#f2d37b" d="M230 73h68v32h-68z"/><path fill="#dce9e9" d="M122 52h42v24h-42zm120 0h42v24h-42z"/><g fill="#252b30"><circle cx="122" cy="106" r="11"/><circle cx="166" cy="106" r="11"/><circle cx="242" cy="106" r="11"/><circle cx="286" cy="106" r="11"/></g>',
  '<path fill="#252b30" d="M120 106h160v16H120zm18 16h18v30h-18zm106 0h18v30h-18z"/><circle cx="200" cy="80" r="37" fill="#f1d077"/><path fill="#fff2ca" d="M175 58h50v35h-50z"/><g fill="#252b30"><circle cx="190" cy="73" r="4"/><circle cx="210" cy="73" r="4"/><path d="M187 86h26v4h-26z"/></g>',
  '<g fill="#252b30"><path d="M82 109h48v35H82zm63-32h48v35h-48zm64 32h48v35h-48zm63-32h48v35h-48z"/></g><circle cx="106" cy="87" r="22" fill="#f0c667"/><circle cx="169" cy="55" r="22" fill="#d77a88"/><circle cx="233" cy="87" r="22" fill="#80bab1"/><circle cx="296" cy="55" r="22" fill="#eee4d4"/><path stroke="#252b30" stroke-width="5" stroke-dasharray="5 10" d="M96 87h25m38-32h25m39 32h25m38-32h25"/>'
];
illustrations[2]='<path fill="#657d75" d="M0 110h400v50H0z"/><path fill="#b4ad92" d="M50 60h75v65H50zm220 20h80v65h-80z"/><path stroke="#eee9d4" stroke-width="6" d="M195 140V22"/><path fill="#ffe45c" d="M198 24h65l-16 25h-49z"/><path fill="#f07866" d="M130 112h35v40h-35z"/><circle cx="147" cy="101" r="12" fill="#ead5ae"/><path stroke="white" stroke-width="3" d="M200 66v28m-14-14h28"/>';
const art=i=>i===5?'<img class="hub-art" src="/assets/krill-card.png" alt="고래와 크릴 입체 모델">':i===4?'<img class="hub-art" src="/assets/fishing-card.png" alt="바다 위 낚시배와 밀짚모자 낚시꾼 입체 모델">':i===3?'<img class="hub-art" src="/assets/bull-card.png" alt="황소와 도망자 3D 모델 · 투우 게임">':i===2?'<img class="hub-art hub-fps-art" src="/assets/fps-model-card.png" alt="실제 FPS 병사와 소총 모델로 렌더링한 빨강·파랑 팀 깃발 쟁탈전" width="1920" height="1080">':i===1?'<img class="hub-art" src="/assets/racing-models.png" alt="선택 가능한 여섯 스포츠카">':i===0?'<img class="hub-art hub-game-render" src="/assets/dirt-rally-card.png" alt="실제 게임 속 노란 포크레인이 모래를 담은 버킷을 들어 올린 모습" width="1024" height="1024">':`<svg class="hub-art art-${i}" viewBox="0 0 400 160" aria-hidden="true"><defs><pattern id="grid-${i}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="white" stroke-opacity=".13"/></pattern></defs><path fill="url(#grid-${i})" d="M0 0h400v160H0z"/>${illustrations[i]}</svg>`;
hub.innerHTML=`<header class="hub-header"><a class="hub-brand" href="#games">▦ 플레이룸 <span>함께 노는 시간</span></a><span class="hub-device">하나의 화면 · 각자의 휴대폰</span></header><section class="hub-intro"><p class="hub-kicker">PICK A GAME. MAKE A MEMORY.</p><h1>오늘은 어떤 게임을 할까요<span>?</span></h1><p>친구들을 모으고, 게임을 고르고, 함께 시작하세요.</p></section><div class="hub-layout"><section aria-label="게임 목록" class="hub-catalog">${catalog.map((g,i)=>`<button class="hub-card" data-game="${i}" aria-pressed="false">${art(i)}<span class="hub-card-heading"><strong>${g.title}</strong><span class="hub-tag">${g.type}</span></span><span class="hub-card-subtitle">${g.subtitle}</span><span class="hub-card-status ${g.ready?'is-ready':''}">${g.ready?('● 플레이 가능 <span>'+(i===1||i===4||i===5?'1':'2')+'–16명</span>'):'준비 중 <span>COMING SOON</span>'}</span></button>`).join('')}</section><aside class="hub-detail" aria-label="선택한 게임 정보"><p class="hub-detail-kicker">선택한 게임 <span>GAME INFO ↗</span></p><div id="hub-preview"></div><h2 id="hub-title"></h2><p id="hub-subtitle"></p><p id="hub-description" aria-live="polite"></p><p id="hub-meta"></p><button id="hub-play">대기실 입장 <span>→</span></button><p class="hub-footnote" id="hub-footnote"></p></aside></div><footer class="hub-footer"><span><b>01</b> 게임 선택 <i>→</i> <b>02</b> QR로 참가 <i>→</i> <b>03</b> 함께 플레이</span><span>PLAY TOGETHER.</span></footer>`;
document.body.prepend(hub);
const sidebar=document.createElement('div');sidebar.className='hub-sidebar';
const detail=hub.querySelector('.hub-detail');detail.before(sidebar);sidebar.append(detail);
sidebar.insertAdjacentHTML('afterbegin',`<section class="hub-join" aria-label="휴대폰 참가"><img id="hub-qr" width="200" height="200" alt="모든 게임에 사용하는 참가 QR코드"><div><strong>QR 한 번으로 참가</strong><p>게임을 바꿔도 이 폰으로 계속 플레이!</p><p id="hub-room">서버 연결 중…</p><p id="hub-players" aria-live="polite"></p><p id="hub-url"></p></div></section>`);
const welcome=document.createElement('div');welcome.className='hub-welcome';
const intro=hub.querySelector('.hub-intro');intro.before(welcome);
welcome.append(intro,hub.querySelector('.hub-join'));
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
  $('hub-footnote').textContent=game.ready?'공통 참가 QR로 먼저 참가하세요. 연결한 폰은 모든 게임에서 계속 사용합니다.':'아직 플레이할 수 없어요. 다음 업데이트를 기다려주세요.';
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
$('hub-play').onclick=()=>{if(catalog[selectedGame].ready){send({type:'game',game:['excavator','racing','fps','bull','fishing','krill'][selectedGame]});location.hash='dirt-rally';showScreen('dirt-rally');}};
backToGames.onclick=()=>{if(currentPhase!=='running'){if(currentPhase==='finished')send({type:'lobby'});location.hash='games';showScreen('games');}};
window.addEventListener('hashchange',()=>{if(currentPhase==='running'&&location.hash!=='#dirt-rally'){location.hash='dirt-rally';return;}showScreen(location.hash.slice(1));});
chooseGame(0);showScreen(location.hash.slice(1));
const fpsCanvas=document.createElement('canvas');fpsCanvas.id='fps-overview';fpsCanvas.hidden=true;lobby.insertBefore(fpsCanvas,lobby.querySelector('.grid'));let fpsScene;
let config,ws,latest,retry,authenticated=false,hostKey='';
const bullCanvas=document.createElement('canvas');bullCanvas.id='bull-overview';bullCanvas.hidden=true;lobby.insertBefore(bullCanvas,lobby.querySelector('.grid'));let bullScene;
const bullPicker=document.createElement('section');bullPicker.id='bull-picker';bullPicker.hidden=true;bullPicker.innerHTML='<h2>황소 선택</h2><select aria-label="황소 참가자 선택"></select><p>황소: 자동 전진 · 가속할수록 회전이 어려워짐 · 벽 충돌 시 밀림과 스턴<br>사람: 앞뒤 이동과 좌우 회전 · 뿔에 닿으면 경기장 밖으로 아웃</p>';lobby.insertBefore(bullPicker,bullCanvas);
const bullSummary=document.createElement('p');bullSummary.id='bull-summary';bullSummary.hidden=true;lobby.insertBefore(bullSummary,bullCanvas);
const bullMapPicker=document.createElement('select');bullMapPicker.setAttribute('aria-label','투우 맵 선택');bullMapPicker.append(new Option('맵 1 · 참가자 황소','classic'),new Option('맵 2 · 원형 경기장 문 돌진','gates'));bullPicker.prepend(bullMapPicker);bullMapPicker.onchange=()=>send({type:'bull-map',map:bullMapPicker.value});
let bullPickerKey='';
function renderBull(m){const playing=m.game==='bull';bullCanvas.hidden=!playing;bullPicker.hidden=!playing;bullSummary.hidden=!playing;if(!playing)return;if(!bullScene)bullScene=createBullScene(bullCanvas,{overview:true});bullScene.update(m);
bullMapPicker.value=m.bull.map;bullMapPicker.disabled=m.phase!=='lobby'||!authenticated;const gates=m.bull.map==='gates';
const picker=bullPicker.querySelector('select[aria-label="황소 참가자 선택"]'),key=JSON.stringify([m.bull.choice,m.phase,m.players.map(p=>[p.id,p.name,p.connected])]);picker.hidden=gates;bullPicker.querySelector('h2').textContent=gates?'원형 경기장 · 문 돌진':'황소 선택';bullPicker.querySelector('p').textContent=gates?'모두 사람이 되어 생존하세요 · 360도 랜덤 위치에 문이 철컥 생성 · 다른 랜덤 문으로 직선 돌진 · 속도 12 고정 · 시간이 갈수록 황소 증가':'황소: 전진 버튼과 좌우 회전 · 사람: 앞뒤 이동과 좌우 회전 · 뿔에 닿으면 아웃';if(key!==bullPickerKey){bullPickerKey=key;picker.replaceChildren(new Option('매 라운드 무작위','random'),...m.players.filter(p=>p.connected).map(p=>new Option(p.name,p.id)));picker.value=m.bull.choice;picker.disabled=m.phase!=='lobby'||!authenticated;picker.onchange=()=>send({type:'bull-choice',id:picker.value});}
bullSummary.textContent=m.phase==='lobby'?'2명 이상 참가한 뒤 시작하세요 · PC는 경기장 전체, 휴대폰은 내 1인칭 시야':m.phase==='finished'?`${m.results.winner==='bull'?'황소 승리!':'사람 승리!'} · `+m.results.players.map(p=>`${p.name}: ${p.role==='bull'?'황소':p.survival.toFixed(2)+'초'}`).join(' / '):`${Math.ceil(m.remaining)}초 · 황소 ${m.players.find(p=>p.role==='bull')?.name} · 생존 ${m.players.filter(p=>p.participating&&p.role==='human'&&p.alive).length}명`;
if(gates&&m.phase!=='finished')bullSummary.textContent=m.phase==='lobby'?'1–16명 · 모두 사람 · 열리는 문을 살피고 피하세요':`${Math.ceil(m.remaining)}초 · 황소 속도 12 고정 · 누적 등장 ${m.bull.spawned}마리 · 생존 ${m.players.filter(p=>p.participating&&p.alive).length}명`;
lobby.querySelector('.worksite-hero h1').firstChild.textContent='BULL RUN';lobby.querySelector('.title-caption').textContent='뿔을 피해 살아남아라!';lobby.querySelector('.worksite-hero .eyebrow').textContent='2–16명 · 원형 투우 경기장';lobby.querySelector('.pixel-scene').hidden=true;lobby.querySelector('.worksite-hero p').textContent='황소는 모두를 아웃시키면 승리 · 제한 시간까지 사람이 남으면 사람 승리';}
const raceCanvas=document.createElement('canvas');raceCanvas.id='race-overview';raceCanvas.hidden=true;lobby.insertBefore(raceCanvas,lobby.querySelector('.grid'));let raceScene;const raceBroadcast=createRaceBroadcast(lobby);
const raceSummary=document.createElement('p');raceSummary.hidden=true;lobby.append(raceSummary);
const trackPicker=document.createElement('section');trackPicker.id='race-track-picker';trackPicker.hidden=true;
trackPicker.innerHTML='<h2>서킷 선택</h2><p>코스를 고른 뒤 QR로 참가하세요. 모든 드라이버가 같은 서킷에서 경주합니다.</p><div class="track-grid"></div><p id="race-track-detail" aria-live="polite"></p>';
lobby.insertBefore(trackPicker,raceCanvas);
const mapPicker=document.createElement('section');mapPicker.id='excavator-map-picker';mapPicker.innerHTML='<h2>포크레인 맵 선택</h2><div class="track-grid"></div><p class="map-description" aria-live="polite"></p>';lobby.insertBefore(mapPicker,trackPicker);
const waterCanvas=document.createElement('canvas');waterCanvas.id='water-overview';waterCanvas.hidden=true;lobby.insertBefore(waterCanvas,raceCanvas);let waterScene,mapSignature='';
function renderMapPicker(m){
  mapPicker.hidden=m.game!=='excavator';waterCanvas.hidden=!m.water||m.game!=='excavator';
  if(m.game!=='excavator')return;
  lobby.querySelector('.worksite-hero h1').firstChild.textContent='플레이룸';lobby.querySelector('.worksite-hero .eyebrow').textContent='최대 16명 · 포크레인 팀 게임';lobby.querySelector('.pixel-scene').hidden=false;
  if(m.water){if(!waterScene)waterScene=createWaterOverview(waterCanvas);waterScene.update(m);}
  const key=JSON.stringify([m.excavatorMap?.id,m.phase,authenticated]);if(key===mapSignature)return;mapSignature=key;
  const grid=mapPicker.querySelector('.track-grid');grid.replaceChildren();
  for(const map of m.excavatorMaps||[]){const b=document.createElement('button');b.className='track-card';b.dataset.map=map.id;b.setAttribute('aria-pressed',String(map.id===m.excavatorMap.id));b.disabled=!authenticated||m.phase!=='lobby';const title=document.createElement('strong');title.textContent=map.name;const sub=document.createElement('small');sub.textContent=map.mode==='water'?'폭포 → 땅 파기 → 목표선':'모래 모으기';b.append(title,sub);b.onclick=()=>send({type:'excavator-map',map:map.id});grid.append(b);}
  mapPicker.querySelector('.map-description').textContent=m.excavatorMap.description+(m.water?' 팀별로 같은 물길이 주어집니다. 제한 시간 내 도착한 팀이 없으면 무승부입니다.':'');
  lobby.querySelector('.title-caption').textContent=m.water?'물길을 연결하라!':'모래를 옮겨라!';
  lobby.querySelector('.worksite-hero p').textContent=m.excavatorMap.description;
  lobby.querySelector('.pixel-scene span').textContent=m.water?'폭포 물길 작업장':'모래 운반 작업장';
  const guide=lobby.querySelector('.field-guide');guide.querySelector('.eyebrow').textContent=m.water?'03 / 물길 만드는 법':'03 / 모래 운반 요령';guide.querySelector('h2').textContent=m.water?'목표선까지 물을 보내세요':'우리 구역을 가득 채우세요';
  guide.querySelector('.how-to').innerHTML=m.water?'<p><b>01 · 땅 파기</b>우리 팀 땅에서 버킷을 낮추고<br>닿은 부분을 조금씩 파세요.</p><p><b>02 · 흙 비우기</b>버킷이 차면 옆 풀밭에서<br>열어 흙을 내려놓으세요.</p><p><b>03 · 물길 연결</b>깊이와 연결 상태를 확인하세요.<br>물이 먼저 도착한 팀이 승리합니다.</p>':'<p><b>01 · 퍼담기</b>버킷을 낮추고 닫아<br>모래를 퍼담으세요.</p><p><b>02 · 운반하기</b>양쪽 주행 레버로<br>우리 팀 구역까지 이동!</p><p><b>03 · 내려놓기</b>팀 구역에서 버킷을 열면<br>내려놓은 모래가 점수가 됩니다.</p>';
  guide.querySelector('details p').textContent='PC 게임에서 함께 플레이하세요. 왼손은 상부 회전·암, 오른손은 붐·버킷을 조작합니다.';
}
let trackSignature='';
function renderTrackPicker(m){
  trackPicker.hidden=m.game!=='racing';if(m.game!=='racing')return;
  const signature=JSON.stringify([m.circuit.id,m.phase,authenticated]);if(signature===trackSignature)return;trackSignature=signature;
  const grid=trackPicker.querySelector('.track-grid');grid.replaceChildren();
  for(const track of m.race.tracks){
    const button=document.createElement('button');button.className='track-card';button.dataset.track=track.id;button.setAttribute('aria-pressed',String(track.id===m.circuit.id));button.disabled=!authenticated||m.phase!=='lobby';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','-240 -180 480 360');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',track.anchors.map(([x,z],i)=>`${i?'L':'M'}${x} ${z}`).join(' ')+' Z');path.setAttribute('fill','none');path.setAttribute('stroke',track.color);path.setAttribute('stroke-width','12');path.setAttribute('stroke-linejoin','round');svg.append(path);
    const title=document.createElement('strong');title.textContent=track.name;const meta=document.createElement('small');meta.textContent=track.mode==='bumper'?'원형 절벽 · 마지막 생존자 승리':`${(track.length/1000).toFixed(2)} km · ${track.difficulty}`;button.append(svg,title,meta);
    button.onclick=()=>send({type:'track',track:track.id});grid.append(button);
  }
  document.getElementById('race-track-detail').textContent=`${m.circuit.name} · ${m.circuit.description}${m.phase!=='lobby'?' · 대기실로 돌아오면 변경할 수 있습니다.':''}`;
}
const send=m=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));};
for(let n=1;n<=8;n++)$('teams').add(new Option(`${n}개`,n));
function lockControls(){for(const id of ['teams','duration','configure','start','lobby'])$(id).disabled=true;for(const el of $('players').querySelectorAll('select,button'))el.disabled=true;}
function qr(){
  const address=$('address').value;
  $('qr').src=`/qr?address=${encodeURIComponent(address)}&room=${config.room}`;
  $('url').textContent=`${address}/controller?room=${config.room}`;
  $('room').textContent=`방 코드 ${config.room}`;
  $('hub-qr').src=$('qr').src;
  $('hub-room').textContent=$('room').textContent;
  $('hub-url').textContent=$('url').textContent;
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
const fishingCanvas=document.createElement('canvas');fishingCanvas.id='fishing-overview';fishingCanvas.hidden=true;lobby.insertBefore(fishingCanvas,lobby.querySelector('.grid'));let fishingScene;
const fishingPanel=document.createElement('section');fishingPanel.id='fishing-pc-panel';fishingPanel.hidden=true;lobby.insertBefore(fishingPanel,fishingCanvas);
const krillCanvas=document.createElement('canvas');krillCanvas.id='krill-overview';krillCanvas.hidden=true;lobby.insertBefore(krillCanvas,lobby.querySelector('.grid'));let krillScene;
const krillSummary=document.createElement('p');krillSummary.id='krill-summary';krillSummary.hidden=true;lobby.insertBefore(krillSummary,krillCanvas);
function renderKrill(m){const on=m.game==='krill';krillCanvas.hidden=!on;krillSummary.hidden=!on;if(!on)return;lobby.querySelector('.worksite-hero h1').firstChild.textContent='KRILL ESCAPE';lobby.querySelector('.title-caption').textContent='작은 크릴, 거대한 고래';lobby.querySelector('.worksite-hero .eyebrow').textContent='1–16명 · 크릴 생존 개인전';lobby.querySelector('.pixel-scene').hidden=true;lobby.querySelector('.worksite-hero p').textContent='왼쪽 패드 이동 · 오른쪽 꼬리치기 · 위험 구역에서 탈출 · 최후의 크릴은 고래를 조종';if(!krillScene)krillScene=createKrillScene(krillCanvas);krillScene.update(m);const k=m.krill;krillSummary.textContent=m.phase==='lobby'?'KRILL ESCAPE · QR로 참가 · 왼쪽 패드 이동 / 오른쪽 꼬리치기':m.phase==='finished'?(m.results.winnerIds.length?m.players.find(p=>p.id===m.results.winnerIds[0])?.name+' · 고래의 주인! 휴대폰 패드로 고래를 조종하세요':'생존자 없음')+'\n'+m.results.players.map(p=>p.rank+'위 '+p.name+' · '+p.survival.toFixed(1)+'초').join(' / '):'생존 '+m.players.filter(p=>p.alive&&p.participating).length+'명 · '+(k.stage==='warning'?'곧 입을 벌립니다':k.stage==='suction'?'흡입 중!':'다가오는 물고기를 피하세요')+' · 흡입 주기 '+k.interval.toFixed(1)+'초'+(m.remaining===0?' · 최후의 크릴까지 연장전':'');}
function renderFishing(m){
 const on=m.game==='fishing';fishingCanvas.hidden=!on;fishingPanel.hidden=!on;if(!on)return;
 if(!fishingScene)fishingScene=createFishingScene(fishingCanvas);fishingScene.update(m);
 lobby.querySelector('.worksite-hero h1').firstChild.textContent='TIDELINE';lobby.querySelector('.title-caption').textContent='한 배, 각자의 낚시';lobby.querySelector('.worksite-hero .eyebrow').textContent='1–16명 · 바다 낚시 개인전';lobby.querySelector('.pixel-scene').hidden=true;lobby.querySelector('.worksite-hero p').textContent='던지기 → 큰 입질에 챔질 → 물고기 방향으로 기울이기 → 시계 방향으로 릴 감기 · 많이 잡으면 우승';
 const heading=document.createElement('h2');heading.textContent=m.phase==='finished'?(m.results.winnerIds.length?m.results.players.filter(p=>m.results.winnerIds.includes(p.id)).map(p=>p.name).join(' · ')+' 우승!':'무승부'):m.phase==='lobby'?'휴대폰 센서를 허용하고 PC에서 시작하세요':Math.ceil(m.remaining)+'초 · 실시간 낚시';
 const list=document.createElement('div');list.className='fishing-standings';
 for(const p of [...m.players].filter(p=>m.phase==='lobby'||p.participating).sort((a,b)=>b.caught-a.caught)){const row=document.createElement('div');row.className='fishing-standing';row.style.setProperty('--angler',p.color);const title=document.createElement('strong');title.textContent=(m.players.findIndex(v=>v.id===p.id)+1)+' · '+p.name+' · '+p.caught+'마리';const detail=document.createElement('div'),f=p.fishing;detail.textContent=m.phase==='finished'?Object.entries(p.collection).filter(([,n])=>n).map(([id,n])=>(m.fishing.species.find(s=>s.id===id)?.name||id)+' '+n+'마리').join(' / ')||'포획 기록 없음':f.stage==='fighting'?(m.fishing.species.find(s=>s.id===f.species)?.name+' · ')+(f.direction<0?'← 왼쪽':'오른쪽 →')+' · 힘 '+Math.round(f.energy*100)+'% · 줄 '+Math.round(f.tension*100)+'% · '+Math.ceil(f.distance)+'m':f.message;row.append(title,detail);list.append(row);}
 fishingPanel.replaceChildren(heading,list);
}
function render(m){
  renderKrill(m);const krill=m.game==='krill';
  renderFishing(m);const fishing=m.game==='fishing';
  renderBull(m);const bull=m.game==='bull';
  const shooting=m.game==='fps';fpsCanvas.hidden=!shooting;
  if(shooting){if(!fpsScene)fpsScene=createFpsScene(fpsCanvas,{overview:true});fpsScene.update(m);lobby.querySelector('.title-caption').textContent='깃발을 탈환하라!';lobby.querySelector('.worksite-hero h1').firstChild.textContent='FLAG STRIKE';lobby.querySelector('.worksite-hero .eyebrow').textContent='최대 16명 · FPS 깃발 쟁탈전';lobby.querySelector('.pixel-scene').hidden=true;lobby.querySelector('.worksite-hero p').textContent='PC 화면을 보며 이동 방향으로 조준 · 발사 버튼으로 사격 · 깃발 운반';}
  lobby.querySelector('.field-guide').hidden=shooting||bull||fishing||krill;
  const settings=$('configure').closest('section');if(settings){const heading=settings.querySelector('h2');if(heading)heading.textContent=(bull||fishing||krill)?'경기 시간과 참가자':'팀과 경기 설정';const hint=settings.querySelector(':scope > p.muted');if(hint)hint.textContent=krill?'휴대폰 이동 패드와 꼬리치기를 사용하세요. 여러 명이면 최후의 한 마리까지 연장합니다.':fishing?'휴대폰을 가로로 잡고 센서 시작을 누른 뒤 PC에서 경기를 시작하세요.':bull?'황소 선택 후 경기를 시작하세요.':'참가자의 팀을 직접 바꿀 수 있습니다. 준비가 끝나면 경기를 시작하세요.';}
  $('configure').textContent=(bull||fishing||krill)?'시간 적용':'균등 배정';
  $('teams').parentElement.hidden=bull||fishing||krill;
  for(const option of $('teams').options)option.disabled=shooting&&Number(option.value)<2;
  renderMapPicker(m);
  renderTrackPicker(m);
  const racing=m.game==='racing';raceCanvas.hidden=!racing||(m.phase!=='lobby'&&m.race.mode!=='bumper');raceBroadcast.root.hidden=!racing;raceSummary.hidden=!racing;
  lobby.classList.toggle('racing-lobby',racing);
  if(racing){raceBroadcast.update(m);if(m.race.mode==='bumper')raceBroadcast.root.hidden=true;if(!raceScene)raceScene=createRaceScene(raceCanvas,{overview:true});raceScene.update(m);raceSummary.textContent=m.race.mode==='bumper'?`${m.circuit.name} · 생존 ${m.players.filter(p=>p.eliminatedAt===null).length}/${m.players.length}대 · ${m.phase==='finished'?'경기 종료 · '+m.results.players.map(p=>p.rank+'위 '+p.name).join(' / '):'상대를 밀어 떨어뜨리세요'}`:m.phase==='finished'?m.results.players.map(p=>`${p.rank}위 ${p.name} ${p.time===null?'미완주':p.time.toFixed(2)+'초'}`).join(' / '):`${m.circuit.name} · ${(m.circuit.length/1000).toFixed(2)} km · ${m.race.laps}바퀴 · ${m.players.length}대 · 차량 충돌 사용`;
    $('results').hidden=true;
  }
  if(bull||racing||fishing||krill)$('results').hidden=true;
  currentPhase=m.phase;
  $('hub-players').textContent=`접속 ${m.players.filter(p=>p.connected).length} / 16명`;
  backToGames.disabled=m.phase==='running';
  backToGames.title=backToGames.disabled?'대기실로 돌아온 뒤 게임을 변경하세요.':'';
  if(m.phase==='running'&&!hub.hidden){location.hash='dirt-rally';showScreen('dirt-rally');}
  if(!racing&&!bull&&!fishing&&!krill)renderResults($('results'),m);
  if(m.connection&&m.connection.address!==$('address').value){$('address').value=m.connection.address;qr();}
  const signature=JSON.stringify([m.game,m.circuit?.id,m.phase,m.teamCount,m.duration,m.bull?.choice,m.bull?.map,m.players.map(p=>[p.id,p.name,p.team,p.connected,p.car,p.color])]);
  $('status').textContent=`${m.players.filter(p=>p.connected).length}/16 접속 · ${m.phase==='lobby'?'대기':m.phase==='running'?`${Math.ceil(m.remaining)}초`:'종료'}`;
  $('scores').replaceChildren(...(racing?[...m.players].sort((a,b)=>a.rank-b.rank).map(p=>{const d=document.createElement('div');d.className='score';d.style.color=p.color;d.textContent=m.race.mode==='bumper'?`${p.rank}위 · ${p.name} · ${p.eliminatedAt===null?'생존':'탈락'}`:`${p.rank}위 · ${p.name} · ${Math.min(3,p.lap+1)}/3 LAP`;return d;}):m.teams.map(t=>{const d=document.createElement('div');d.className='score';d.style.color=t.color;d.textContent=m.water?`팀 ${t.id+1} · 물길 ${Math.floor(m.water.lanes[t.id].progress)}%`:shooting?`팀 ${t.id+1} · 깃발 ${t.captures}점`:`팀 ${t.id+1} · ${t.dirt} 모래`;return d;})));
  if(bull){$('scores').replaceChildren(...m.players.filter(p=>p.participating||m.phase==='lobby').map(p=>{const d=document.createElement('div');d.className='score';d.textContent=p.role==='bull'?`${p.name} · 황소`:`${p.name} · ${p.survival.toFixed(1)}초 · ${p.alive?'생존':'아웃'}`;return d;}));}
  if(krill){$('scores').replaceChildren(...m.players.map(p=>{const d=document.createElement('div');d.className='score';d.style.color=p.color;d.textContent=p.name+' · '+(p.alive?'생존':'탈락')+' · '+p.survival.toFixed(1)+'초';return d;}));}
  if(fishing){$('scores').replaceChildren(...[...m.players].sort((a,b)=>b.caught-a.caught).map(p=>{const d=document.createElement('div');d.className='score';d.style.color=p.color;d.textContent=p.name+' · '+p.caught+'마리';return d;}));}
  if(signature===latest)return;
  latest=signature;
  $('teams').value=m.teamCount;$('duration').value=m.duration;
  const locked=m.phase!=='lobby';
  for(const id of ['teams','duration','configure'])$(id).disabled=locked||(bull&&id==='teams');
  $('start').disabled=locked||m.players.filter(p=>p.connected).length<(bull&&m.bull.map!=='gates'?2:1);$('lobby').disabled=false;
  $('players').replaceChildren(...m.players.map((p,i)=>{
    const card=document.createElement('div');card.className='player';card.style.setProperty('--team',racing||krill?p.color:m.teams[p.team].color);
    const name=document.createElement('strong');name.textContent=`${i+1}. ${p.name} ${p.connected?'●':'(연결 끊김)'}`;
    const row=document.createElement('div');row.className='row';
    const select=document.createElement('select');select.ariaLabel=`${p.name} 팀`;
    for(const t of m.teams)select.add(new Option(`팀 ${t.id+1}`,t.id));
    select.value=p.team;select.disabled=locked;select.onchange=()=>send({type:'assign',id:p.id,team:Number(select.value)});
    const remove=document.createElement('button');remove.textContent='제외';remove.disabled=locked;remove.onclick=()=>send({type:'remove',id:p.id});
    if(fishing||krill){const seat=document.createElement('span');seat.textContent='개인전 · '+(i+1)+'번 자리';row.append(seat,remove);}else if(bull){const role=document.createElement('span');role.textContent=m.phase==='lobby'?(m.bull.choice===p.id?'지정 황소':m.bull.choice==='random'?'무작위 추첨 대상':'사람'):p.role==='bull'?'황소':'사람';row.append(role,remove);}else if(racing){const car=document.createElement('span');car.textContent=m.race.cars.find(c=>c.id===p.car)?.name;row.append(car,remove);}else row.append(select,remove);card.append(name,row);return card;
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
