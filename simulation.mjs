import { randomUUID } from 'node:crypto';
import {readFileSync} from 'node:fs';
import {raceSpawn,raceTick,chooseCar,CIRCUITS,TRACKS,CARS} from './racing.mjs';
export const ARENA=JSON.parse(readFileSync(new URL('./game/arena.json',import.meta.url),'utf8'));
export const COLORS = ['#faad28','#52c8fa','#f078a6','#77d99b','#a99aff','#fb775b','#e0d16c','#69d3cb'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
export class Match {
  constructor() {
    this.circuit=CIRCUITS[0];
    this.players = new Map(); this.teamCount = 4; this.duration = 180;
    this.phase = 'lobby'; this.remaining = this.duration; this.central = 4000;
    this.teams = []; this.game = 'excavator'; this.results = null; this.raceLaps=3;this.raceCollisions=true;this.countdown=0;this.raceElapsed=0;this.resetTeams();
  }
  resetTeams() {
    this.groundPiles = []; this.nextPileId = 0;
    this.teams = Array.from({length:this.teamCount}, (_,id) => {
      const angle = id / this.teamCount * Math.PI*2;
      return { id, color:COLORS[id], x:Math.sin(angle)*ARENA.teamRadius, z:Math.cos(angle)*ARENA.teamRadius, dirt:0 };
    });
  }
  spawn(p) {
    if(this.game==='racing'){raceSpawn(this,p);return;}
    const members = [...this.players.values()].filter(q=>q.team===p.team);
    const slot = members.findIndex(q=>q.id===p.id);
    const sector = Math.PI*2/this.teamCount;
    const columns = Math.min(members.length, Math.max(1,Math.floor(sector*ARENA.spawnRadius/2)));
    const row = Math.floor(slot/columns), col = slot%columns;
    const rowSize = Math.min(columns,members.length-row*columns);
    const angle = p.team*sector+(col-(rowSize-1)/2)*Math.min(.24,sector*.8/columns);
    const radius = ARENA.spawnRadius+row*2.2;
    p.x = Math.sin(angle)*radius; p.z = Math.cos(angle)*radius;
    p.yaw = angle + Math.PI; p.turret = 0; p.boom=.50; p.stick=-1.4; p.curl=-.7; p.cargo=0;
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
  neutral() {return this.game==='racing'?{steer:0,throttle:0,brake:0}:{travelL:0,travelR:0,swing:0,boom:0,stick:0,curl:0};}
  selectGame(game){
    if(this.game===game)return;
    if(this.phase!=='lobby')throw Error('대기실에서 게임을 변경하세요.');
    if(!['excavator','racing'].includes(game))throw Error('지원하지 않는 게임입니다.');
    this.game=game;this.results=null;for(const p of this.players.values())this.spawn(p);
    if(game==='racing'){this.duration=Math.max(300,this.duration);this.remaining=this.duration;}
  }
  chooseCar(id,car){chooseCar(this,id,car);}
  selectTrack(id){
    if(this.game!=='racing'||this.phase!=='lobby')throw Error('트랙은 레이싱 대기실에서 선택하세요.');
    const circuit=CIRCUITS.find(t=>t.id===id);
    if(!circuit)throw Error('올바른 트랙을 선택하세요.');
    this.circuit=circuit;this.results=null;this.raceElapsed=0;this.countdown=0;
    for(const p of this.players.values())this.spawn(p);
  }
  disconnect(id) { const p=this.players.get(id); if(p) {p.connected=false;p.input=this.neutral();} }
  configure(count, duration=this.duration) {
    if(this.phase!=='lobby') throw Error('팀 편성은 대기실에서 변경할 수 있습니다.');
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
    for(const p of this.players.values()) this.spawn(p);
  }
  start() {
    if(this.phase!=='lobby'||![...this.players.values()].some(p=>p.connected)) throw Error('접속한 참가자가 있어야 시작할 수 있습니다.');
    this.central=4000; this.remaining=this.duration; this.results=null; this.resetTeams();
    for(const p of this.players.values()) this.spawn(p);
    this.countdown=this.game==='racing'?3:0;this.raceElapsed=0;
    this.phase='running';
  }
  lobby() {
    this.phase='lobby'; this.remaining=this.duration; this.central=4000; this.results=null; this.resetTeams();
    for(const p of this.players.values()) this.spawn(p);
  }
  input(id, value, now=Date.now()) {
    const p=this.players.get(id); if(!p||!p.connected) return;
    p.input=Object.fromEntries(Object.keys(this.neutral()).map(k=>[k,clamp(Number.isFinite(value[k])?value[k]:0,-1,1)]));
    if(this.game==='racing'){p.input.throttle=clamp(p.input.throttle,0,1);p.input.brake=clamp(p.input.brake,0,1);}
    p.lastInput=now;
  }
  bucket(p) {
    const a=p.yaw+p.turret, bucketAngle=p.boom+p.stick+Math.PI/2-p.curl;
    const reach=2.4*Math.cos(p.boom)+2.1*Math.cos(p.boom+p.stick)-.73*Math.cos(bucketAngle)+.48*Math.sin(bucketAngle);
    return {x:p.x+Math.sin(a)*reach,z:p.z+Math.cos(a)*reach,height:1.45+2.4*Math.sin(p.boom)+2.1*Math.sin(p.boom+p.stick)-.73*Math.sin(bucketAngle)-.48*Math.cos(bucketAngle)};
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
    if(this.game==='racing')return;
    const p=this.players.get(id);
    if(this.phase!=='running'||!p||!p.connected||p.cooldown>0) return;
    const tip=this.bucket(p); p.cooldown=.45;
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
    if(this.game==='racing'){raceTick(this,dt,now);return;}
    const ceremony=this.phase==='finished';
    if(this.phase!=='running'&&!ceremony) return;
    if(!ceremony)this.remaining=Math.max(0,this.remaining-dt);
    for(const p of this.players.values()) {
      if(ceremony&&!this.results.winnerIds.includes(p.team))continue;
      p.cooldown=Math.max(0,p.cooldown-dt);
      if(!p.connected||now-p.lastInput>350) continue;
      const i=p.input;
      if(!ceremony)p.yaw+=(i.travelL-i.travelR)*1.3*dt;
      const speed=ceremony?0:(i.travelL+i.travelR)*1.7;
      if(Math.abs(speed)>.05) {
        const next={x:clamp(p.x+Math.sin(p.yaw)*speed*dt,-ARENA.driveLimit,ARENA.driveLimit),z:clamp(p.z+Math.cos(p.yaw)*speed*dt,-ARENA.driveLimit,ARENA.driveLimit)};
        if(![...this.players.values()].some(q=>q!==p&&distance(next,q)<1.5)) {p.x=next.x;p.z=next.z;}
      }
      p.turret+=i.swing*1.4*dt;
      const old={boom:p.boom,stick:p.stick,curl:p.curl};
      const target={boom:clamp(p.boom+i.boom*.7*dt,-.25,1.35),stick:clamp(p.stick+i.stick*.9*dt,-2.4,-.25),curl:clamp(p.curl+i.curl*1.8*dt,-1.2,1.2)};
      Object.assign(p,target);
      if(this.bucket(p).height<.02) {
        let low=0,high=1;
        for(let step=0;step<14;step++) {
          const fraction=(low+high)/2;
          for(const key of Object.keys(old))p[key]=old[key]+(target[key]-old[key])*fraction;
          if(this.bucket(p).height>=.02)low=fraction;else high=fraction;
        }
        for(const key of Object.keys(old))p[key]=old[key]+(target[key]-old[key])*low;
      }
      if(i.curl>.2&&p.curl>.1&&p.cargo<40) this.action(p.id,'scoop');
      if(i.curl<-.2&&p.curl<-.5&&p.cargo>0) this.action(p.id,'drop');
    }
    if(!ceremony&&this.remaining<=0) {
      this.phase='finished';this.results=this.buildResults();
      const winners=[...this.players.values()].filter(p=>this.results.winnerIds.includes(p.team));
      const columns=Math.min(4,winners.length);
      winners.forEach((p,i)=>{
        const row=Math.floor(i/columns),rowSize=Math.min(columns,winners.length-row*columns);
        p.x=(i%columns-(rowSize-1)/2)*5;p.z=ARENA.driveLimit-row*6;p.yaw=0;p.turret=0;
        p.boom=.75;p.stick=-1.2;p.curl=.2;p.cargo=0;p.input=this.neutral();p.lastInput=0;
      });
    }
  }
  buildResults() {
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
      ...(this.game==='racing'?{race:{laps:this.raceLaps,collisions:this.raceCollisions,steeringRange:50,countdown:this.countdown,elapsed:this.raceElapsed,cars:CARS,tracks:TRACKS},circuit:this.circuit}:{}),
      players:[...this.players.values()].map(({token,input,lastInput,cooldown,...p})=>({...p,...(this.game==='excavator'?{bucket:this.bucket(p)}:{})}))};
  }
}
