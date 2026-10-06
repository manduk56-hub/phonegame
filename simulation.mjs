import {FPS_ARENA,resetFps,fpsSpawn,fpsAim,fpsFire,fpsTick,fpsResults,dropFlag} from './fps.mjs';
import {EXCAVATOR_MAPS,resetWater,waterAction,waterTick,waterResults,waterHeight,waterSnapshot} from './waterway.mjs';
import { randomUUID } from 'node:crypto';
import {readFileSync} from 'node:fs';
import {raceSpawn,raceTick,chooseCar,CIRCUITS,TRACKS,CARS} from './racing.mjs';
import {excavatorOverlap} from './collision.mjs';
import {BULL_ARENA,bullSpawn,bullStart,bullTick} from './bull.mjs';
import {FISHING,fishingSpawn,fishingStart,fishingTick,fishingAction,fishingResults} from './fishing.mjs';
import {KRILL,krillSpawn,krillStart,krillTick,krillAction} from './krill.mjs';
export const ARENA=JSON.parse(readFileSync(new URL('./game/arena.json',import.meta.url),'utf8'));
export const COLORS = ['#faad28','#52c8fa','#f078a6','#77d99b','#a99aff','#fb775b','#e0d16c','#69d3cb'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
export class Match {
  constructor() {
    this.bullChoice='random';this.bull=null;
    this.excavatorMap=EXCAVATOR_MAPS[0];
    this.circuit=CIRCUITS[0];
    this.players = new Map(); this.teamCount = 4; this.duration = 180;
    this.phase = 'lobby'; this.remaining = this.duration; this.central = 4000;
    this.teams = []; this.game = 'excavator'; this.results = null; this.raceLaps=this.circuit.laps;this.raceCollisions=true;this.countdown=0;this.raceElapsed=0;this.raceDirector=null;this.resetTeams();
  }
  resetTeams() {
    this.krill=null;
    this.groundPiles = []; this.nextPileId = 0;
    this.teams = Array.from({length:this.teamCount}, (_,id) => {
      const angle = id / this.teamCount * Math.PI*2;
      return { id, color:COLORS[id], x:Math.sin(angle)*(this.game==='fps'?FPS_ARENA.teamRadius:ARENA.teamRadius), z:Math.cos(angle)*(this.game==='fps'?FPS_ARENA.teamRadius:ARENA.teamRadius), dirt:0 };
    });
    resetWater(this);
    resetFps(this);
  }
  spawn(p) {
    if(this.game==='krill'){krillSpawn(this,p);return;}
    if(this.game==='fishing'){fishingSpawn(this,p);return;}
    if(this.game==='bull'){bullSpawn(this,p);return;}
    if(this.game==='fps'){fpsSpawn(this,p);return;}
    if(this.game==='racing'){raceSpawn(this,p);return;}
    const members = [...this.players.values()].filter(q=>q.team===p.team);
    const slot = members.findIndex(q=>q.id===p.id);
    const sector = Math.PI*2/this.teamCount;
    const columns = Math.min(members.length, Math.max(1,Math.floor(sector*ARENA.spawnRadius/2.6)));
    const row = Math.floor(slot/columns), col = slot%columns;
    const rowSize = Math.min(columns,members.length-row*columns);
    const angle = p.team*sector+(col-(rowSize-1)/2)*Math.min(.28,sector*.8/columns);
    const radius = ARENA.spawnRadius+row*2.8;
    p.x = Math.sin(angle)*radius; p.z = Math.cos(angle)*radius;
    p.y=0; p.yaw = angle + Math.PI; p.turret = 0; p.boom=.50; p.stick=-1.4; p.curl=-.7; p.cargo=0;
    if(this.water){const lane=this.water.lanes[p.team],side=(slot%2===0?-1:1)*2.6;p.x=lane.x+side;p.z=this.water.start+2.2+Math.floor(slot/2)*2.6;p.yaw=side<0?Math.PI/2:-Math.PI/2;}
    p.input=this.neutral(); p.lastInput=0; p.cooldown=0; p.message=''; p.delivered=0; p.disrupted=0;
  }
  join(name, token) {
    let p = token && [...this.players.values()].find(q=>q.token===token);
    if(p) { p.connected=true; p.input=this.neutral(); return p; }
    if(this.phase !== 'lobby') throw Error('게임 중에는 신규 참가가 제한됩니다. 다음 라운드에 참가하세요.');
    if(this.players.size >= 16) throw Error('최대 16명까지 참가할 수 있습니다.');
    const counts=this.teams.map(t=>[...this.players.values()].filter(q=>q.team===t.id).length);
    p={id:randomUUID(),token:randomUUID(),name:String(name||'플레이어').trim().slice(0,16)||'플레이어',team:counts.indexOf(Math.min(...counts)),connected:true};
    this.players.set(p.id,p); for(const q of this.players.values()) this.spawn(q); return p;
  }
  neutral() {if(this.game==='krill')return {moveX:0,moveY:0};if(this.game==='fishing')return {tilt:0,reel:0};if(this.game==='bull')return {forward:0,steer:0};if(this.game==='fps')return {forward:0,strafe:0};return this.game==='racing'?{steer:0,throttle:0,brake:0}:{travelL:0,travelR:0,swing:0,boom:0,stick:0,curl:0};}
  selectGame(game){
    if(this.game===game)return;
    if(this.phase!=='lobby')throw Error('대기실에서 게임을 변경하세요.');
    if(!['excavator','racing','fps','bull','fishing','krill'].includes(game))throw Error('지원하지 않는 게임입니다.');
    this.game=game;if(game==='fps'&&this.teamCount<2)this.teamCount=2;this.resetTeams();for(const p of this.players.values())p.team%=this.teamCount;this.results=null;for(const p of this.players.values())this.spawn(p);
    if(game==='racing'){this.duration=Math.max(300,this.duration);this.remaining=this.duration;}
  }
  selectExcavatorMap(id){
    if(this.game!=='excavator'||this.phase!=='lobby')throw Error('맵은 포크레인 대기실에서 선택하세요.');
    const map=EXCAVATOR_MAPS.find(m=>m.id===id);if(!map)throw Error('올바른 맵을 선택하세요.');
    this.excavatorMap=map;this.results=null;this.resetTeams();for(const p of this.players.values())this.spawn(p);
  }
  chooseBull(id){if(this.game!=='bull'||this.phase!=='lobby')throw Error('황소는 투우 대기실에서 선택하세요.');if(id!=='random'&&!this.players.has(id))throw Error('참가자를 선택하세요.');this.bullChoice=id;}
  chooseCar(id,car){chooseCar(this,id,car);}
  selectTrack(id){
    if(this.game!=='racing'||this.phase!=='lobby')throw Error('트랙은 레이싱 대기실에서 선택하세요.');
    const circuit=CIRCUITS.find(t=>t.id===id);
    if(!circuit)throw Error('올바른 트랙을 선택하세요.');
    this.circuit=circuit;this.raceLaps=circuit.laps;this.results=null;this.raceElapsed=0;this.raceDirector=null;this.countdown=0;
    for(const p of this.players.values())this.spawn(p);
  }
  disconnect(id) { const p=this.players.get(id); if(p) {p.connected=false;p.input=this.neutral();dropFlag(this,p);} }
  configure(count, duration=this.duration) {
    if(this.phase!=='lobby') throw Error('팀 편성은 대기실에서 변경할 수 있습니다.');
    if(this.game==='fps'&&count<2)throw Error('깃발 쟁탈전은 2팀 이상으로 플레이하세요.');
    if(!Number.isInteger(count)||count<1||count>8) throw Error('팀 수는 1~8개입니다.');
    if(!Number.isFinite(duration)||duration<30||duration>900) throw Error('경기 시간은 30~900초입니다.');
    this.teamCount=count; this.duration=duration; this.remaining=duration; this.resetTeams();
    let i=0; for(const p of this.players.values()) p.team=i++%count;
    for(const p of this.players.values()) this.spawn(p);
  }
  assign(id, team) {
    if(this.phase!=='lobby') throw Error('팀 편성은 대기실에서 변경할 수 있습니다.');
    const p=this.players.get(id);
    if(!p||!Number.isInteger(team)||team<0||team>=this.teamCount) throw Error('잘못된 팀입니다.');
    p.team=team; for(const q of this.players.values()) this.spawn(q);
  }
  remove(id) {
    if(this.phase!=='lobby') throw Error('대기실에서만 참가자를 삭제할 수 있습니다.');
    this.players.delete(id);
    if(this.bullChoice===id)this.bullChoice='random';
    for(const p of this.players.values()) this.spawn(p);
  }
  start() {
    if(this.phase!=='lobby'||![...this.players.values()].some(p=>p.connected)) throw Error('접속한 참가자가 있어야 시작할 수 있습니다.');
    if(this.game==='krill'){krillStart(this);return;}
    if(this.game==='fishing'){fishingStart(this);return;}
    if(this.game==='bull'){bullStart(this);this.remaining=this.duration;this.results=null;this.phase='running';return;}
    this.central=4000; this.remaining=this.duration; this.results=null; this.resetTeams();
    for(const p of this.players.values()) this.spawn(p);
    this.countdown=this.game==='racing'?3:0;this.raceElapsed=0;this.raceDirector=null;
    this.phase='running';
  }
  lobby() {
    this.phase='lobby';this.raceDirector=null; this.remaining=this.duration; this.central=4000; this.results=null; this.resetTeams();
    for(const p of this.players.values()) this.spawn(p);
  }
  input(id, value, now=Date.now()) {
    const p=this.players.get(id); if(!p||!p.connected) return;
    p.input=Object.fromEntries(Object.keys(this.neutral()).map(k=>[k,clamp(Number.isFinite(value[k])?value[k]:0,-1,1)]));
    if(this.game==='racing'){p.input.throttle=clamp(p.input.throttle,0,1);p.input.brake=clamp(p.input.brake,0,1);}
    if(this.game==='fps'&&p.hp>0)fpsAim(p,value);
    p.lastInput=now;
  }
  fire(id,value){fpsFire(this,id,value);}
  bucket(p) {
    const a=p.yaw+p.turret, bucketAngle=p.boom+p.stick+Math.PI/2-p.curl;
    const reach=2.4*Math.cos(p.boom)+2.1*Math.cos(p.boom+p.stick)-.73*Math.cos(bucketAngle)+.48*Math.sin(bucketAngle);
    return {x:p.x+Math.sin(a)*reach,z:p.z+Math.cos(a)*reach,height:(p.y||0)+1.45+2.4*Math.sin(p.boom)+2.1*Math.sin(p.boom+p.stick)-.73*Math.sin(bucketAngle)-.48*Math.cos(bucketAngle)};
  }
  inZone(point, team) {return Math.abs(point.x-team.x)<=3.1&&Math.abs(point.z-team.z)<=3.1;}
  pileHeight(point, center, radius, amount, maximum, central=false) {
    if(amount<=0) return 0;
    const cell=radius/4.4, x=Math.round((point.x-center.x)/cell), z=Math.round((point.z-center.z)/cell);
    const d=Math.hypot(x,z);
    if(Math.abs(x)>4||Math.abs(z)>4||d>4.4) return 0;
    const scale=central?Math.max(.025,amount/maximum):clamp(amount/maximum,.05,2.5);
    return Math.max(.2,(4.6-d)*.55)*scale;
  }
  action(id, action) {
    if(this.game==='krill'){krillAction(this,id,action);return;}
    if(this.game==='fishing'){fishingAction(this,id,action);return;}
    if(this.game!=='excavator')return;
    const p=this.players.get(id);
    if(this.phase!=='running'||!p||!p.connected||p.cooldown>0) return;
    const tip=this.bucket(p); p.cooldown=.45;
    if(this.water){waterAction(this,p,action,tip);return;}
    if(action==='scoop') {
      if(p.cargo>=40) {p.message='버킷이 가득 찼어요';return;}
      const origin={x:0,z:0};
      const loose=this.groundPiles.find(s=>this.pileHeight(tip,s,s.radius,s.dirt,40)>0);
      let source=loose || (distance(tip,origin)<=4.5 ? this : this.teams.find(t=>this.inZone(tip,t)));
      if(!source) {p.message='버킷을 흙더미 가까이 이동하세요';return;}
      const key=source===this?'central':'dirt';
      const surface=source===this?this.pileHeight(tip,origin,4.3,this.central,4000,true):this.pileHeight(tip,source,source.radius||2.5,source.dirt,loose?40:400);
      if(source[key]<=0) {p.message='남은 흙이 없어요';return;}
      if(surface===0||tip.height>surface+.35||tip.height<-.02) {p.message='버킷 이빨을 흙더미 가까이 내리세요';return;}
      const amount=Math.min(40-p.cargo,source[key]); source[key]-=amount;p.cargo+=amount;
      if(!loose&&source!==this&&source.id!==p.team)p.disrupted+=amount;
      if(loose&&loose.dirt===0) this.groundPiles=this.groundPiles.filter(s=>s!==loose);
      p.message=amount ? (loose?'바닥의 흙을 다시 퍼담았어요':source===this?'중앙 흙을 퍼담았어요':source.id===p.team?'우리 팀 흙을 퍼담았어요':'상대 팀 흙을 훔쳤어요!') : '남은 흙이 없어요';
    } else if(action==='drop') {
      const t=this.teams.find(t=>this.inZone(tip,t));
      if(t) {t.dirt+=p.cargo;if(t.id===p.team)p.delivered+=p.cargo;}
      else if(p.cargo) {
        const nearby=this.groundPiles.find(s=>distance(tip,s)<.35);
        if(nearby) nearby.dirt+=p.cargo;
        else this.groundPiles.push({id:this.nextPileId++,x:tip.x,z:tip.z,radius:.85,dirt:p.cargo});
      }
      p.message=p.cargo?(t?'흙을 내려놓았어요':'구역 밖 바닥에 흙을 내려놓았어요'):'버킷이 비어 있어요';
      p.cargo=0;
    }
  }
  tick(dt,now=Date.now()) {
    if(this.game==='krill'){krillTick(this,dt,now);return;}
    if(this.game==='fishing'){fishingTick(this,Number.isFinite(dt)?clamp(dt,0,1):0,now);return;}
    if(this.game==='bull'){bullTick(this,Math.max(0,Math.min(.1,dt)),now);return;}
    if(this.game==='fps'){fpsTick(this,dt,now);return;}
    if(this.game==='racing'){raceTick(this,dt,now);return;}
    const ceremony=this.phase==='finished';
    if(this.phase!=='running'&&!ceremony) return;
    if(!ceremony)this.remaining=Math.max(0,this.remaining-dt);
    for(const p of this.players.values()) {
      if(ceremony&&!this.results.winnerIds.includes(p.team))continue;
      p.cooldown=Math.max(0,p.cooldown-dt);
      if(!p.connected||now-p.lastInput>350) continue;
      const i=p.input;
      // Facing +Z, the driver's left track is on +X: its forward motion turns toward -X.
      const canMove=next=>![...this.players.values()].some(q=>q!==p&&excavatorOverlap(next,q)>Math.max(1e-8,excavatorOverlap(p,q)+1e-8));
      if(!ceremony){const next={...p,yaw:p.yaw+(i.travelR-i.travelL)*1.3*dt};if(canMove(next))p.yaw=next.yaw;}
      const speed=ceremony?0:(i.travelL+i.travelR)*1.7;
      if(Math.abs(speed)>.05) {
        const next={x:clamp(p.x+Math.sin(p.yaw)*speed*dt,-ARENA.driveLimit,ARENA.driveLimit),z:clamp(p.z+Math.cos(p.yaw)*speed*dt,-ARENA.driveLimit,ARENA.driveLimit)};
        if(canMove({...p,...next})) {p.x=next.x;p.z=next.z;}
      }
      if(this.water&&!ceremony)p.y=waterHeight(this,p);
      const turned={...p,turret:p.turret+i.swing*1.4*dt};
      if(ceremony||canMove(turned))p.turret=turned.turret;
      const old={boom:p.boom,stick:p.stick,curl:p.curl};
      const target={boom:clamp(p.boom+i.boom*.7*dt,-.25,1.35),stick:clamp(p.stick+i.stick*.9*dt,-2.4,-.25),curl:clamp(p.curl+i.curl*1.8*dt,-1.2,1.2)};
      Object.assign(p,target);
      const floor=()=>{const tip=this.bucket(p);return .02+(this.water&&!ceremony?waterHeight(this,tip):0);};
      if(this.bucket(p).height<floor()) {
        let low=0,high=1;
        for(let step=0;step<14;step++) {
          const fraction=(low+high)/2;
          for(const key of Object.keys(old))p[key]=old[key]+(target[key]-old[key])*fraction;
          if(this.bucket(p).height>=floor())low=fraction;else high=fraction;
        }
        for(const key of Object.keys(old))p[key]=old[key]+(target[key]-old[key])*low;
      }
      if(i.curl>.2&&(this.water||p.curl>.1)&&p.cargo<40) this.action(p.id,'scoop');
      if(i.curl<-.2&&p.curl<-.5&&p.cargo>0) this.action(p.id,'drop');
    }
    const waterFinished=!ceremony&&this.water&&waterTick(this,dt);
    if(!ceremony&&(this.remaining<=0||waterFinished)) {
      this.phase='finished';this.results=this.buildResults();
      const winners=[...this.players.values()].filter(p=>this.results.winnerIds.includes(p.team));
      const columns=Math.min(4,winners.length);
      winners.forEach((p,i)=>{
        const row=Math.floor(i/columns),rowSize=Math.min(columns,winners.length-row*columns);
        p.y=0;p.x=(i%columns-(rowSize-1)/2)*5;p.z=ARENA.driveLimit-row*6;p.yaw=0;p.turret=0;
        p.boom=.75;p.stick=-1.2;p.curl=.2;p.cargo=0;p.input=this.neutral();p.lastInput=0;
      });
    }
  }
  buildResults() {
    if(this.game==='fishing')return fishingResults(this);
    if(this.game==='fps')return fpsResults(this);
    if(this.water)return waterResults(this);
    const rank=entries=>{
      entries.sort((a,b)=>b.score-a.score);
      let place=1;
      return entries.map((entry,i)=>{if(i===0||entry.score!==entries[i-1].score)place=i+1;return {...entry,rank:place};});
    };
    const participating=new Set([...this.players.values()].map(p=>p.team));
    const teams=rank(this.teams.filter(t=>participating.has(t.id)).map(t=>({id:t.id,color:t.color,score:t.dirt})));
    const players=rank([...this.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,score:p.delivered,disrupted:p.disrupted})));
    return {teams,players,winnerIds:teams.filter(t=>t.score>0&&t.rank===1).map(t=>t.id),total:teams.reduce((sum,t)=>sum+t.score,0)};
  }
  snapshot() {
    return {type:'state',arena:ARENA,game:this.game,phase:this.phase,results:this.results,teamCount:this.teamCount,duration:this.duration,remaining:this.remaining,central:this.central,teams:this.teams,groundPiles:this.groundPiles,
      ...(this.game==='excavator'?{excavatorMap:this.excavatorMap,excavatorMaps:EXCAVATOR_MAPS,water:waterSnapshot(this.water)}:{}),
      ...(this.game==='bull'?{bull:{...(this.bull||{}),arena:BULL_ARENA,choice:this.bullChoice}}:{}),
      ...(this.game==='krill'?{krill:{...(this.krill||{elapsed:0,stage:'rest',danger:{x:0,y:0,r:3.6},obstacles:[]}),...KRILL}}:{}),
      ...(this.game==='fishing'?{fishing:{...(this.fishing||{elapsed:0}),...FISHING}}:{}),
      ...(this.game==='fps'?{fps:{...this.fps,arena:FPS_ARENA}}:{}),
      ...(this.game==='racing'?{race:{laps:this.raceLaps,collisions:this.raceCollisions,steeringRange:50,countdown:this.countdown,elapsed:this.raceElapsed,broadcast:this.raceDirector?{id:this.raceDirector.id,reason:this.raceDirector.reason}:null,cars:CARS,tracks:TRACKS},circuit:this.circuit}:{}),
      players:[...this.players.values()].map(({token,input,lastInput,cooldown,...p})=>({...p,...(this.game==='krill'?{tailCooldown:cooldown}:{}),...(this.game==='excavator'?{bucket:this.bucket(p)}:{})}))};
  }
}
