import {bumperSpawn,bumperTick} from './bumper.mjs';
import {updateRaceDirector} from './race-director.mjs';
import {readFileSync} from 'node:fs';
import {raceBody,bodyContact} from './collision.mjs';
export const CIRCUIT=JSON.parse(readFileSync(new URL('./game/circuit.json',import.meta.url),'utf8'));
export const CIRCUITS=JSON.parse(readFileSync(new URL('./game/circuits.json',import.meta.url),'utf8')).map(({scenery,...track})=>track);
export const BUMPER_ARENA=JSON.parse(readFileSync(new URL('./game/bumper-arena.json',import.meta.url),'utf8'));
export const RACE_TRACKS=[...CIRCUITS,BUMPER_ARENA];
export const TRACKS=RACE_TRACKS.map(({points,bounds,width,radius,...info})=>info);
export const CARS=[
  {id:'wedge',name:'에이펙스',description:'낮은 쐐기형 · 대형 공기흡입구'},
  {id:'classic',name:'클래식',description:'둥근 헤드램프 · 곡선 루프'},
  {id:'tourer',name:'그랜드',description:'긴 보닛 · 그랜드 투어러'},
  {id:'muscle',name:'머슬',description:'넓은 차체 · 두 줄 스트라이프'},
  {id:'exotic',name:'스프린트',description:'날렵한 전면 · 엔진 루버'},
  {id:'gt',name:'GT',description:'각진 쿠페 · 높은 리어윙'}
];
export const RACE_COLORS=['#ffbf26','#50c8ff','#f775a5','#65d888','#af8aff','#ff764b','#eee9dc','#4de0d4','#db4259','#5886ff','#a7d940','#ec983c','#cd7be1','#36ad85','#d2b788','#93abbf'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function nearestTrack(x,z,circuit=CIRCUIT){
  const points=circuit.points;
  let best={distance:Infinity};
  for(let index=0;index<points.length;index++){
    const a=points[index],b=points[(index+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/len2,0,1),px=a.x+dx*t,pz=a.z+dz*t,distance=Math.hypot(x-px,z-pz);
    if(distance<best.distance)best={distance,x:px,z:pz,index,t,yaw:Math.atan2(dx,dz),progress:(index+t)/points.length};
  }return best;
}
export function raceSpawn(match,p){
  const points=match.circuit.points;
  const index=[...match.players.keys()].indexOf(p.id),n=points.length;
  const wrap=value=>((value%n)+n)%n;
  const a=points[wrap(n-2-Math.floor(index/2)*3)],b=points[wrap(n-1-Math.floor(index/2)*3)];
  p.yaw=Math.atan2(b.x-a.x,b.z-a.z);const lane=index%2?2.0:-2.0;
  p.x=a.x+Math.cos(p.yaw)*lane;p.z=a.z-Math.sin(p.yaw)*lane;
  p.car=CARS.some(c=>c.id===p.car)?p.car:CARS[index%CARS.length].id;
  p.color=RACE_COLORS[index];p.speed=0;p.steer=0;p.driveThrottle=0;p.reverseHold=0;p.lap=0;p.checkpoint=0;p.raceDistance=0;
  p.finishedAt=null;p.rank=index+1;p.offroad=false;p.wallContact=false;p.message='';p.input=match.neutral();p.lastInput=0;
  Object.assign(p,{y:0,pushX:0,pushZ:0,fallV:0,falling:false,eliminatedAt:null,landedAt:null,fallX:0,fallZ:0});
  if(match.circuit.mode==='bumper')bumperSpawn(match,p);
}
export function chooseCar(match,id,car){
  if(match.game!=='racing'||match.phase!=='lobby')throw Error('차량은 레이싱 대기실에서 선택하세요.');
  if(!CARS.some(c=>c.id===car))throw Error('올바른 차량을 선택하세요.');
  const p=match.players.get(id);if(p)p.car=car;
}
export function raceResults(match){
  const sorted=[...match.players.values()].sort((a,b)=>(a.finishedAt??Infinity)-(b.finishedAt??Infinity)||b.raceDistance-a.raceDistance);
  return {race:true,winnerIds:sorted.length?[sorted[0].id]:[],players:sorted.map((p,i)=>({id:p.id,name:p.name,color:p.color,car:p.car,rank:i+1,lap:p.lap,time:p.finishedAt,score:p.raceDistance})),teams:[],total:0};
}
const slowTowardsStop=(speed,amount)=>Math.abs(speed)<=amount?0:Math.sign(speed)*(Math.abs(speed)-amount);
function driveSpeed(p,input,live,dt){
  const throttle=live?input.throttle:0,brake=live?input.brake:0;
  // Engine response builds progressively; braking always takes priority.
  p.driveThrottle+=(throttle-p.driveThrottle)*Math.min(1,dt*10);
  if(!live){p.reverseHold=0;p.speed=slowTowardsStop(p.speed,26*dt);return;}
  if(brake>0){
    if(p.speed>0||throttle>0){p.speed=slowTowardsStop(p.speed,48*brake*dt);p.reverseHold=0;}
    else{
      p.reverseHold+=dt;
      if(p.speed<0||p.reverseHold>=.35)p.speed=Math.max(-8,p.speed-7.5*brake*dt);
    }
  }else{
    p.reverseHold=0;
    if(throttle>0){
      if(p.speed<0)p.speed=slowTowardsStop(p.speed,18*throttle*dt);
      else p.speed=Math.min(90,p.speed+30*p.driveThrottle/(1+p.speed/90)*dt);
    }
  }
  // Rolling resistance, engine braking on lift-off and increasing air drag.
  const resistance=.65+Math.abs(p.speed)*.025+p.speed*p.speed*.0005+(throttle===0&&brake===0?1.6:0);
  p.speed=slowTowardsStop(p.speed,resistance*dt);
}
export function raceTick(match,dt,now){
  const circuit=match.circuit,points=circuit.points;
  if(match.phase!=='running')return;
  dt=Math.min(.1,Math.max(0,dt));
  if(circuit.mode==='bumper'){bumperTick(match,dt,now,driveSpeed);return;}
  if(match.countdown>0){match.countdown=Math.max(0,match.countdown-dt);return;}
  match.remaining=Math.max(0,match.remaining-dt);match.raceElapsed+=dt;
  for(const p of match.players.values()){
    if(p.finishedAt!==null)continue;
    const live=p.connected&&now-p.lastInput<=350,i=live?p.input:match.neutral();
    p.steer+=(i.steer-p.steer)*Math.min(1,dt*9);
    driveSpeed(p,i,live,dt);
    // +Z forward; screen-right steering must decrease the world Y angle.
    // Keep tight low-speed corners, but soften tilt sensitivity above 126 km/h.
    const steeringAngle=.48/(1+Math.max(0,p.speed-35)/110);
    p.yaw-=Math.tan(p.steer*steeringAngle)*p.speed/3.4*dt;
    p.x+=Math.sin(p.yaw)*p.speed*dt;p.z+=Math.cos(p.yaw)*p.speed*dt;
    let track=nearestTrack(p.x,p.z,circuit);p.offroad=track.distance>circuit.width/2;
    if(p.offroad)p.speed=slowTowardsStop(p.speed,4*dt);
    const limit=circuit.width/2+2.0;
    if(track.distance>=limit-.08){
      const nx=(p.x-track.x)/track.distance,nz=(p.z-track.z)/track.distance;
      const outward=(nx*Math.sin(p.yaw)+nz*Math.cos(p.yaw))*Math.sign(p.speed);
      if(outward>=-1e-6){
        // The wall absorbs motion into it; tangential scraping has continuous friction.
        if(track.distance>limit)p.speed*=Math.sqrt(Math.max(0,1-outward*outward));
        p.speed=slowTowardsStop(p.speed,(6+Math.abs(p.speed)*.18)*dt);p.wallContact=true;
      }else p.wallContact=false;
      if(track.distance>limit){const scale=limit/track.distance;p.x=track.x+(p.x-track.x)*scale;p.z=track.z+(p.z-track.z)*scale;}
    }else p.wallContact=false;
    // Ordered gates prevent finish-line rocking, reversing and corner cuts from awarding laps.
    const gates=12,target=points[Math.round(p.checkpoint*points.length/gates)%points.length];
    const heading=Math.cos(p.yaw-nearestTrack(target.x,target.z,circuit).yaw);
    if(p.speed>0&&Math.hypot(p.x-target.x,p.z-target.z)<circuit.width*.7&&heading>.25){
      p.checkpoint++;
      if(p.checkpoint>gates){p.lap++;p.checkpoint=1;if(p.lap>=match.raceLaps){p.finishedAt=match.raceElapsed;p.speed=0;}}
    }
    const gateProgress=clamp((p.checkpoint-1)/gates,0,1);
    p.raceDistance=p.lap+(p.checkpoint===0?track.progress-1:clamp(track.progress,gateProgress,Math.min(1,gateProgress+1/gates)));
  }
  const players=[...match.players.values()];
  if(match.raceCollisions)for(let a=0;a<players.length;a++)for(let b=a+1;b<players.length;b++){
    const p=players[a],q=players[b];if(p.finishedAt!==null||q.finishedAt!==null)continue;
    const contact=bodyContact(raceBody(p),raceBody(q));if(!contact)continue;
    const shift=(contact.depth+1e-6)/2;
    p.x+=contact.x*shift;p.z+=contact.z*shift;q.x-=contact.x*shift;q.z-=contact.z*shift;
    p.speed*=.88;q.speed*=.88;
  }
  const ranks=raceResults(match);for(const r of ranks.players)match.players.get(r.id).rank=r.rank;
  updateRaceDirector(match,dt);
  if(match.remaining===0||players.every(p=>p.finishedAt!==null)){
    match.phase='finished';match.results=ranks;
  }
}
