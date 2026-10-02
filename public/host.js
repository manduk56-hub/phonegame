const $=id=>document.getElementById(id);
let config,ws,latest,retry,authenticated=false;
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
  qr();
}
function render(m){
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
    if(!config.adminKey){$('error').textContent='진행자는 이 PC에서 http://localhost:3000을 열어주세요.';return;}
    ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
    ws.onopen=()=>send({type:'host',key:config.adminKey});
    ws.onclose=()=>{lockControls();$('status').textContent='연결 끊김 · 재접속 중';retry=setTimeout(connect,1500);};
    ws.onmessage=e=>{
      const m=JSON.parse(e.data);
      if(m.type==='error'){$('error').textContent=m.message;if(!authenticated)ws.close();return;}
      if(m.type!=='state')return;
      authenticated=true;$('error').textContent='';render(m);
    };
  }catch(e){$('status').textContent='서버 연결 대기';$('error').textContent=e.message;retry=setTimeout(connect,1500);}
}
$('address').onchange=()=>{qr();send({type:'network',address:$('address').value});};
$('configure').onclick=()=>send({type:'configure',teams:Number($('teams').value),duration:Number($('duration').value)});
$('start').onclick=()=>send({type:'start'});
$('lobby').onclick=()=>send({type:'lobby'});
connect();
