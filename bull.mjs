export const BULL_ARENA={radius:44,humanSpeed:5,humanTurnSpeed:1.8,bullMinSpeed:7,bullMaxSpeed:15,acceleration:1.6,stun:.8};
export const BULL_GATES={speed:12,warning:.8,initialInterval:3,minInterval:.45,rampSeconds:20};
export function bullGatePoint(angle){return {x:Math.sin(angle)*BULL_ARENA.radius,z:Math.cos(angle)*BULL_ARENA.radius};}
export function bullSpawnInterval(elapsed){return Math.max(BULL_GATES.minInterval,BULL_GATES.initialInterval/(1+elapsed/BULL_GATES.rampSeconds));}
export function bullSpawn(m,p){
  const players=[...m.players.values()],i=players.indexOf(p),a=i/Math.max(1,players.length)*Math.PI*2;
  Object.assign(p,{x:Math.sin(a)*BULL_ARENA.radius*.6,z:Math.cos(a)*BULL_ARENA.radius*.6,y:0,yaw:a+Math.PI,role:'human',alive:true,survival:0,speed:0,stun:0,lift:0,flight:null,celebrationPose:null,celebrationHit:false,capeWave:0,participating:false,input:m.neutral(),lastInput:0});
}
export function bullStart(m){
  const players=[...m.players.values()].filter(p=>p.connected);
  if(m.bullMap==='gates'){
    if(!players.length)throw Error('접속한 참가자가 있어야 시작할 수 있습니다.');
    for(const p of m.players.values()){bullSpawn(m,p);p.participating=p.connected;p.alive=p.connected;}
    m.bull={arena:BULL_ARENA,map:'gates',elapsed:0,bulls:[],nextSpawn:1,nextId:0,spawned:0};return;
  }
  if(players.length<2)throw Error('투우는 접속한 참가자가 2명 이상이어야 합니다.');
  const chosen=m.bullChoice==='random'?players[Math.floor(Math.random()*players.length)]:players.find(p=>p.id===m.bullChoice);
  if(!chosen)throw Error('지정한 황소가 접속해 있어야 합니다. 다시 선택하세요.');
  for(const p of m.players.values()){bullSpawn(m,p);p.participating=p.connected;p.alive=p.connected;}
  Object.assign(chosen,{role:'bull',x:0,z:0,yaw:0,speed:0});
  m.bull={arena:BULL_ARENA,map:'classic',bullId:chosen.id,elapsed:0,choice:m.bullChoice};
}
export function bullResults(m,winner){
  return {mode:'bull',winner,winnerIds:[],teams:[],players:[...m.players.values()].filter(p=>p.participating).map(p=>({id:p.id,name:p.name,role:p.role,alive:p.alive,survival:p.survival})).sort((a,b)=>b.survival-a.survival)};
}
function finish(m,winner){
  m.phase='finished';m.results=bullResults(m,winner);
  m.bull.celebration={winner,startsAt:m.bull.elapsed+1.5,ready:false,hits:0};
  for(const p of m.players.values()){p.input=m.neutral();p.speed=0;}
}
function celebrate(m,dt,now){
  const c=m.bull.celebration;if(!c||m.bull.elapsed<c.startsAt)return;
  const humans=[...m.players.values()].filter(p=>p.participating&&p.role==='human'),b=m.players.get(m.bull.bullId);
  if(!c.ready){
    const columns=Math.min(5,humans.length);
    humans.forEach((p,i)=>{const row=Math.floor(i/columns),count=Math.min(columns,humans.length-row*columns);Object.assign(p,{x:(i%columns-(count-1)/2)*3.4,z:row*4,y:0,yaw:0,flight:null,celebrationHit:false,celebrationPose:c.winner==='bull'?'tremble':p.alive?'cape':'idle',capeWave:0,input:m.neutral()});});
    if(b)Object.assign(b,{x:0,z:-14,y:0,yaw:0,speed:0,stun:0,lift:0,flight:null,celebrationPose:'bull',input:m.neutral()});
    m.bull.bulls=[];c.ready=true;
  }
  for(const p of humans)p.capeWave=p.connected&&p.celebrationPose==='cape'&&now-p.lastInput<350?Math.max(0,p.input.wave):0;
  if(c.winner!=='bull'||!b)return;
  const input=b.connected&&now-b.lastInput<350?b.input:m.neutral();
  const steps=Math.max(1,Math.ceil(dt/.016)),step=dt/steps;
  for(let n=0;n<steps;n++){
    b.speed=input.forward>0?Math.min(BULL_ARENA.bullMaxSpeed,Math.max(BULL_ARENA.bullMinSpeed,b.speed)+BULL_ARENA.acceleration*step):0;
    b.yaw+=input.steer*2.15/(1+Math.max(0,b.speed-BULL_ARENA.bullMinSpeed)*.22)*step;
    b.x+=Math.sin(b.yaw)*b.speed*step;b.z+=Math.cos(b.yaw)*b.speed*step;
    for(const p of humans){
      if(p.celebrationHit||b.speed===0)continue;
      const dx=p.x-b.x,dz=p.z-b.z,front=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw),side=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw);
      if(front>.8&&front<2.8&&Math.abs(side)<1.65){p.celebrationHit=true;p.celebrationPose='launched';p.flight={x:p.x,z:p.z,endX:p.x+Math.sin(b.yaw)*14+side*2,endZ:p.z+Math.cos(b.yaw)*14,start:m.bull.elapsed,duration:1.35};b.lift=.45;c.hits++;}
    }
    const d=Math.hypot(b.x,b.z),limit=BULL_ARENA.radius-2;if(d>limit){b.x*=limit/d;b.z*=limit/d;b.speed=0;}
  }
  b.lift=Math.max(0,b.lift-dt);
}
function eject(m,p,b){p.alive=false;p.survival=Math.min(m.duration,m.bull.elapsed);const d=Math.hypot(p.x,p.z)||1;let dx=p.x/d,dz=p.z/d;if(d<2){dx=Math.sin(b.yaw);dz=Math.cos(b.yaw);}p.flight={x:p.x,z:p.z,endX:dx*(BULL_ARENA.radius+7),endZ:dz*(BULL_ARENA.radius+7),start:m.bull.elapsed,duration:1.35};b.lift=.45;}
function tickGates(m,dt){
  const arena=m.bull;
  while(arena.elapsed>=arena.nextSpawn){
    // Continuous angles allow a doorway anywhere on the full circumference.
    // Keep endpoints far enough apart for two doors and a meaningful crossing.
    const from=Math.random()*Math.PI*2,to=(from+.25+Math.random()*(Math.PI*2-.5))%(Math.PI*2);
    const start=bullGatePoint(from),end=bullGatePoint(to),distance=Math.hypot(end.x-start.x,end.z-start.z);
    arena.bulls.push({id:`gate-bull-${arena.nextId++}`,name:'황소',role:'bull',from,to,start,end,distance,x:start.x,z:start.z,y:0,yaw:Math.atan2(end.x-start.x,end.z-start.z),speed:BULL_GATES.speed,release:arena.nextSpawn+BULL_GATES.warning,progress:0,alive:true,participating:true,stun:0,lift:0});
    arena.spawned++;arena.nextSpawn+=bullSpawnInterval(arena.nextSpawn);
  }
  for(const b of arena.bulls){
    const previous=b.progress;b.progress=Math.max(0,(arena.elapsed-b.release)*b.speed);
    b.x=b.start.x+Math.sin(b.yaw)*b.progress;b.z=b.start.z+Math.cos(b.yaw)*b.progress;b.lift=Math.max(0,b.lift-dt);
    if(arena.elapsed<b.release)continue;
    for(const p of m.players.values())if(p.participating&&p.alive){
      const dx=p.x-b.start.x,dz=p.z-b.start.z,along=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw),side=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw);
      if(along>previous-.9&&along<b.progress+2.8&&Math.abs(side)<1.65)eject(m,p,b);
    }
  }
  arena.bulls=arena.bulls.filter(b=>b.progress<b.distance+3);
  if(![...m.players.values()].some(p=>p.participating&&p.alive))finish(m,'bull');
  else if(m.remaining<=0)finish(m,'humans');
}
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
      const i=now-p.lastInput<350?p.input:{forward:0,steer:0};p.yaw+=i.steer*BULL_ARENA.humanTurnSpeed*dt;
      p.x+=Math.sin(p.yaw)*i.forward*BULL_ARENA.humanSpeed*dt;p.z+=Math.cos(p.yaw)*i.forward*BULL_ARENA.humanSpeed*dt;
      const d=Math.hypot(p.x,p.z),limit=BULL_ARENA.radius-.65;if(d>limit){p.x*=limit/d;p.z*=limit/d;}
    }
  }
  if(!running){celebrate(m,dt,now);return;}
  m.remaining=Math.max(0,m.duration-m.bull.elapsed);
  if(m.bull.map==='gates'){tickGates(m,dt);return;}
  if(!b?.connected){finish(m,'humans');return;}
  b.lift=Math.max(0,b.lift-dt);
  const input=now-b.lastInput<350?b.input:{forward:0,steer:0};
  const advancing=input.forward>0;
  const steps=Math.max(1,Math.ceil(dt/.016)),step=dt/steps;
  for(let n=0;n<steps;n++){
    if(b.stun>0){b.stun=Math.max(0,b.stun-step);b.x-=Math.sin(b.yaw)*4*step;b.z-=Math.cos(b.yaw)*4*step;continue;}
    b.speed=advancing?Math.min(BULL_ARENA.bullMaxSpeed,Math.max(BULL_ARENA.bullMinSpeed,b.speed)+BULL_ARENA.acceleration*step):0;
    b.yaw+=input.steer*(2.15/(1+Math.max(0,b.speed-BULL_ARENA.bullMinSpeed)*.22))*step;
    b.x+=Math.sin(b.yaw)*b.speed*step;b.z+=Math.cos(b.yaw)*b.speed*step;
    // Substeps keep the front horn collision from skipping runners at full speed.
    for(const p of m.players.values())if(p.role==='human'&&p.participating&&p.alive){
      const dx=p.x-b.x,dz=p.z-b.z,front=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw),side=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw);
      if(front>.8&&front<2.8&&Math.abs(side)<1.65)eject(m,p,b);
    }
    const d=Math.hypot(b.x,b.z),limit=BULL_ARENA.radius-2;
    if(d>limit){b.x*=limit/d;b.z*=limit/d;b.stun=BULL_ARENA.stun;b.speed=0;}
  }
  if(![...m.players.values()].some(p=>p.participating&&p.role==='human'&&p.alive))finish(m,'bull');
  else if(m.remaining<=0)finish(m,'humans');
}
