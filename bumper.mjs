import {raceBody,bodyContact} from './collision.mjs';
const velocity=p=>({x:Math.sin(p.yaw)*p.speed+p.pushX,z:Math.cos(p.yaw)*p.speed+p.pushZ});
export function bumperSpawn(match,p){
  const index=[...match.players.keys()].indexOf(p.id),angle=index*Math.PI*2/16;
  p.x=Math.sin(angle)*28;p.z=Math.cos(angle)*28;p.yaw=angle+Math.PI;
  Object.assign(p,{y:0,pushX:0,pushZ:0,fallV:0,falling:false,eliminatedAt:null,landedAt:null,fallX:0,fallZ:0});
}
export function bumperResults(match){
  const sorted=[...match.players.values()].sort((a,b)=>(b.eliminatedAt??Infinity)-(a.eliminatedAt??Infinity));
  let rank=1;
  const players=sorted.map((p,i)=>{if(i&&p.eliminatedAt!==sorted[i-1].eliminatedAt)rank=i+1;return {id:p.id,name:p.name,color:p.color,car:p.car,rank,lap:0,time:p.eliminatedAt,score:p.eliminatedAt??match.raceElapsed,survived:p.eliminatedAt===null};});
  return {race:true,bumper:true,winnerIds:players.filter(p=>p.rank===1).map(p=>p.id),players,teams:[],total:0};
}
export function bumperTick(match,dt,now,driveSpeed){
  if(match.countdown>0){match.countdown=Math.max(0,match.countdown-dt);return;}
  match.raceElapsed+=dt;match.remaining=Math.max(0,match.remaining-dt);
  const players=[...match.players.values()];
  for(const p of players){
    if(p.eliminatedAt!==null){
      if(p.landedAt===null){
        p.fallV-=24*dt;p.y+=p.fallV*dt;p.x+=p.fallX*dt;p.z+=p.fallZ*dt;
        if(p.y<=match.circuit.floorY){p.y=match.circuit.floorY;p.landedAt=match.raceElapsed;p.falling=false;}
      }continue;
    }
    const live=p.connected&&now-p.lastInput<=350,i=live?p.input:match.neutral();
    p.steer+=(i.steer-p.steer)*Math.min(1,dt*9);driveSpeed(p,i,live,dt);
    p.speed=Math.max(-8,Math.min(32,p.speed));
    p.yaw-=Math.tan(p.steer*.48)*p.speed/3.4*dt;
    const v=velocity(p);p.x+=v.x*dt;p.z+=v.z*dt;
    const damping=Math.exp(-1.5*dt);p.pushX*=damping;p.pushZ*=damping;
  }
  const active=players.filter(p=>p.eliminatedAt===null);
  for(let a=0;a<active.length;a++)for(let b=a+1;b<active.length;b++){
    const p=active[a],q=active[b],c=bodyContact(raceBody(p),raceBody(q));if(!c)continue;
    const shift=(c.depth+.005)/2;p.x+=c.x*shift;p.z+=c.z*shift;q.x-=c.x*shift;q.z-=c.z*shift;
    const pv=velocity(p),qv=velocity(q),closing=(pv.x-qv.x)*c.x+(pv.z-qv.z)*c.z;
    if(closing<0){const impulse=-(1.25)*closing/2+1.8;p.pushX+=c.x*impulse;p.pushZ+=c.z*impulse;q.pushX-=c.x*impulse;q.pushZ-=c.z*impulse;}
  }
  for(const p of active)if(Math.hypot(p.x,p.z)>match.circuit.radius+.4){
    const v=velocity(p);p.fallX=v.x*.45;p.fallZ=v.z*.45;p.speed=0;p.eliminatedAt=match.raceElapsed;p.finishedAt=match.raceElapsed;p.falling=true;p.input=match.neutral();
  }
  const ranks=bumperResults(match);for(const r of ranks.players)match.players.get(r.id).rank=r.rank;
  const alive=players.filter(p=>p.eliminatedAt===null).length;
  const resolved=alive===0||(players.length>1&&alive===1)||match.remaining===0;
  // Keep the round visible until every falling car has hit the floor and its blast has played.
  if(resolved&&players.every(p=>p.eliminatedAt===null||(p.landedAt!==null&&match.raceElapsed-p.landedAt>=1.5))){match.phase='finished';match.results=ranks;}
}
