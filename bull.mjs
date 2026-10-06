export const BULL_ARENA={radius:44,humanSpeed:5,bullMinSpeed:7,bullMaxSpeed:15,acceleration:1.6,stun:.8};
export function bullSpawn(m,p){
  const players=[...m.players.values()],i=players.indexOf(p),a=i/Math.max(1,players.length)*Math.PI*2;
  Object.assign(p,{x:Math.sin(a)*BULL_ARENA.radius*.6,z:Math.cos(a)*BULL_ARENA.radius*.6,y:0,yaw:a+Math.PI,role:'human',alive:true,survival:0,speed:0,stun:0,lift:0,flight:null,participating:false,input:m.neutral(),lastInput:0});
}
export function bullStart(m){
  const players=[...m.players.values()].filter(p=>p.connected);
  if(players.length<2)throw Error('투우는 접속한 참가자가 2명 이상이어야 합니다.');
  const chosen=m.bullChoice==='random'?players[Math.floor(Math.random()*players.length)]:players.find(p=>p.id===m.bullChoice);
  if(!chosen)throw Error('지정한 황소가 접속해 있어야 합니다. 다시 선택하세요.');
  for(const p of m.players.values()){bullSpawn(m,p);p.participating=p.connected;p.alive=p.connected;}
  Object.assign(chosen,{role:'bull',x:0,z:0,yaw:0,speed:BULL_ARENA.bullMinSpeed});
  m.bull={arena:BULL_ARENA,bullId:chosen.id,elapsed:0,choice:m.bullChoice};
}
export function bullResults(m,winner){
  return {mode:'bull',winner,winnerIds:[],teams:[],players:[...m.players.values()].filter(p=>p.participating).map(p=>({id:p.id,name:p.name,role:p.role,alive:p.alive,survival:p.survival})).sort((a,b)=>b.survival-a.survival)};
}
function finish(m,winner){m.phase='finished';m.results=bullResults(m,winner);}
function eject(m,p,b){p.alive=false;p.survival=m.bull.elapsed;const d=Math.hypot(p.x,p.z)||1;let dx=p.x/d,dz=p.z/d;if(d<2){dx=Math.sin(b.yaw);dz=Math.cos(b.yaw);}p.flight={x:p.x,z:p.z,endX:dx*(BULL_ARENA.radius+7),endZ:dz*(BULL_ARENA.radius+7),start:m.bull.elapsed,duration:1.35};b.lift=.45;}
export function bullTick(m,dt,now){
  if(!['running','finished'].includes(m.phase)||!m.bull)return;
  // Continue the final victim's flight after the result is decided.
  m.bull.elapsed+=dt;
  const b=m.players.get(m.bull.bullId),running=m.phase==='running';
  for(const p of m.players.values()){
    if(p.flight){const t=Math.min(1,(m.bull.elapsed-p.flight.start)/p.flight.duration);p.x=p.flight.x+(p.flight.endX-p.flight.x)*t;p.z=p.flight.z+(p.flight.endZ-p.flight.z)*t;p.y=10*4*t*(1-t);continue;}
    if(!running||!p.participating||!p.alive)continue;
    if(p.role==='human'){
      p.survival=Math.min(m.duration,m.bull.elapsed);
      if(!p.connected)continue;
      const i=now-p.lastInput<350?p.input:{forward:0,steer:0};p.yaw+=i.steer*3.3*dt;
      p.x+=Math.sin(p.yaw)*i.forward*BULL_ARENA.humanSpeed*dt;p.z+=Math.cos(p.yaw)*i.forward*BULL_ARENA.humanSpeed*dt;
      const d=Math.hypot(p.x,p.z),limit=BULL_ARENA.radius-.65;if(d>limit){p.x*=limit/d;p.z*=limit/d;}
    }
  }
  if(!running)return;
  m.remaining=Math.max(0,m.duration-m.bull.elapsed);
  if(!b?.connected){finish(m,'humans');return;}
  b.lift=Math.max(0,b.lift-dt);
  const steps=Math.max(1,Math.ceil(dt/.016)),step=dt/steps;
  for(let n=0;n<steps;n++){
    if(b.stun>0){b.stun=Math.max(0,b.stun-step);b.x-=Math.sin(b.yaw)*4*step;b.z-=Math.cos(b.yaw)*4*step;continue;}
    b.speed=Math.min(BULL_ARENA.bullMaxSpeed,b.speed+BULL_ARENA.acceleration*step);
    const steer=now-b.lastInput<350?b.input.steer:0;b.yaw+=steer*(2.15/(1+(b.speed-7)*.22))*step;
    b.x+=Math.sin(b.yaw)*b.speed*step;b.z+=Math.cos(b.yaw)*b.speed*step;
    // Substeps keep the front horn collision from skipping runners at full speed.
    for(const p of m.players.values())if(p.role==='human'&&p.participating&&p.alive){
      const dx=p.x-b.x,dz=p.z-b.z,front=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw),side=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw);
      if(front>.8&&front<2.8&&Math.abs(side)<1.65)eject(m,p,b);
    }
    const d=Math.hypot(b.x,b.z),limit=BULL_ARENA.radius-2;
    if(d>limit){b.x*=limit/d;b.z*=limit/d;b.stun=BULL_ARENA.stun;b.speed=BULL_ARENA.bullMinSpeed;}
  }
  if(![...m.players.values()].some(p=>p.participating&&p.role==='human'&&p.alive))finish(m,'bull');
  else if(m.remaining<=0)finish(m,'humans');
}
