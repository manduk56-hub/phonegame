export const KRILL={width:10,height:5.8,speed:6.6,tailRange:1.6,tailPush:1.44,tailCooldown:1.1};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function krillSpawn(m,p){
 const i=[...m.players.keys()].indexOf(p.id);p.x=(i%4-1.5)*3.6;p.y=(Math.floor(i/4)-1.5)*2.3;p.z=0;
 p.color=['#ffad77','#64dcff','#fb9bd0','#a4f2bb','#c0a6ff','#ffee8c','#ff817e','#7cf1e4'][i%8];
 p.alive=true;p.participating=false;p.survival=0;p.suction=0;p.hits=0;p.stun=0;p.invulnerable=0;p.tail=0;p.cooldown=0;p.vx=0;p.vy=0;p.swimX=0;p.swimY=0;p.message='경고 무늬가 없는 곳으로 이동하세요';p.input=m.neutral();p.lastInput=0;
}
export function krillStart(m){
 m.krill={elapsed:0,cycle:0,cycleTime:0,interval:6,stage:'rest',opening:0,safe:{x:0,y:0,r:2.8},obstacles:[],serial:0,spawnTimer:1.4,initialCount:0,ride:{x:0,y:0,yaw:0}};
 for(const p of m.players.values()){krillSpawn(m,p);p.participating=p.connected;p.alive=p.connected;if(p.connected)m.krill.initialCount++;}
 m.phase='running';m.remaining=m.duration;m.results=null;
}
export function krillAction(m,id,action){
 const p=m.players.get(id);if(action!=='tail'||m.phase!=='running'||!p?.connected||!p.alive||!p.participating||p.cooldown>0)return;
 p.tail=.28;p.cooldown=KRILL.tailCooldown;
 for(const q of m.players.values())if(q!==p&&q.participating&&q.alive){let dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d<KRILL.tailRange){if(d<.001){dx=1;dy=0;d=1;}q.vx+=dx/d*KRILL.tailPush*6;q.vy+=dy/d*KRILL.tailPush*6;}}
}
function results(m){const entries=[...m.players.values()].filter(p=>p.participating).sort((a,b)=>Number(b.alive)-Number(a.alive)||b.survival-a.survival);let rank=1;const players=entries.map((p,i)=>{if(i&& (p.alive!==entries[i-1].alive||Math.abs(p.survival-entries[i-1].survival)>.001))rank=i+1;return {id:p.id,name:p.name,color:p.color,alive:p.alive,survival:p.survival,rank};});return {mode:'krill',winnerIds:entries.filter(p=>p.alive).map(p=>p.id),players};}
export function krillTick(m,dt,now){
 if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);const k=m.krill;if(!k)return;
 if(m.phase==='finished'){const winner=m.players.get(m.results.winnerIds[0]);if(winner?.connected&&now-winner.lastInput<350){k.ride.x=clamp(k.ride.x+winner.input.moveX*dt*3,-4,4);k.ride.y=clamp(k.ride.y+winner.input.moveY*dt*2,-2,2);k.ride.yaw=winner.input.moveX*.16;}return;}
 if(m.phase!=='running')return;
 k.elapsed+=dt;m.remaining=Math.max(0,m.duration-k.elapsed);k.cycleTime+=dt;
 if(k.cycleTime>=k.interval){k.cycleTime-=k.interval;k.cycle++;k.interval=Math.max(4.2,6-k.elapsed*.028);k.safe={x:Math.sin(k.cycle*2.4)*5.5,y:Math.cos(k.cycle*1.7)*2.5,r:Math.max(.85,2.8-Math.min(1,k.elapsed*.012)-Math.max(0,k.elapsed-m.duration)*.025)};}
 const open=k.interval-1.4,warn=open-2;
 k.stage=k.cycleTime< warn?'rest':k.cycleTime<open?'warning':'suction';
 k.opening=k.stage==='suction'?Math.min(1,(k.cycleTime-open)/.25):Math.max(0,k.opening-dt*5);
 k.spawnTimer-=dt;if(k.spawnTimer<=0){const i=++k.serial;k.spawnTimer=Math.max(.55,1.5-k.elapsed*.006);k.obstacles.push({id:i,x:Math.sin(i*2.399)*8.8,y:Math.cos(i*1.61)*4.9,z:-23,r:i%3===0?.85:.65,kind:i%3===0?'rock':'fish'});}
 for(const o of k.obstacles)o.z+=dt*(8+Math.min(8,k.elapsed*.045));
 for(const p of m.players.values()){
  if(!p.participating||!p.alive)continue;
  if(!p.connected){p.alive=false;p.message='연결 종료';continue;}
  p.survival=k.elapsed;p.cooldown=Math.max(0,p.cooldown-dt);p.tail=Math.max(0,p.tail-dt);p.stun=Math.max(0,p.stun-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);
  const previousX=p.x,previousY=p.y;
  const input=now-p.lastInput<350?p.input:{moveX:0,moveY:0},n=Math.max(1,Math.hypot(input.moveX,input.moveY));
  p.x+=((p.stun>0?.35:1)*input.moveX/n*KRILL.speed+p.vx)*dt;p.y+=((p.stun>0?.35:1)*input.moveY/n*KRILL.speed+p.vy)*dt;
  p.vx*=Math.exp(-6*dt);p.vy*=Math.exp(-6*dt);
  const safe=Math.hypot(k.safe.x-p.x,k.safe.y-p.y)<=k.safe.r;
  if(k.stage==='suction'&&!safe){p.suction+=dt*(.8+Math.min(.45,k.elapsed*.003));p.x-=p.x*dt*.45;p.y-=p.y*dt*.45;p.message='흡입 중! 경고 무늬를 벗어나세요';}else{p.suction=Math.max(0,p.suction-dt*.65);p.message=k.stage==='rest'?'다음 흡입 경고에 대비하세요':safe?'안전 구역 안! 위치를 지키세요':'경고 영역에서 벗어나세요!';}
  for(const o of k.obstacles)if(Math.abs(o.z)<.65&&p.invulnerable===0&&Math.hypot(p.x-o.x,p.y-o.y)<o.r+.36){p.hits++;p.stun=.5;p.invulnerable=1.2;p.vx+=(p.x>=o.x?1:-1)*2.5;p.suction=clamp(p.suction+.16,0,1);p.message='충돌! 잠깐 휘청입니다';}
  p.x=clamp(p.x,-KRILL.width,KRILL.width);p.y=clamp(p.y,-KRILL.height,KRILL.height);
  const turn=1-Math.exp(-12*dt);
  p.swimX+=(clamp((p.x-previousX)/(dt*KRILL.speed),-1,1)-p.swimX)*turn;p.swimY+=(clamp((p.y-previousY)/(dt*KRILL.speed),-1,1)-p.swimY)*turn;
  if(p.suction>=1||p.hits>=3){p.alive=false;p.message=p.hits>=3?'장애물에 휩쓸렸어요':'고래에게 빨려들었어요';}
 }
 k.obstacles=k.obstacles.filter(o=>o.z<3);
 const alive=[...m.players.values()].filter(p=>p.participating&&p.alive);
 if((k.initialCount>1&&alive.length<=1)||(k.initialCount===1&&(alive.length===0||m.remaining<=0))){m.phase='finished';m.results=results(m);for(const p of m.players.values())p.input=m.neutral();}
}
