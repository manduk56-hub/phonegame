import {readFileSync} from 'node:fs';
import {CATCH_DURATION} from './public/fishing-effects.js';
const modelData=JSON.parse(readFileSync(new URL('./game/fishing-models.json',import.meta.url),'utf8'));
export const SPECIES=modelData.species.map(({id,name})=>({id,name}));
export const SEATING_PATH=modelData.seatingPath;
export const FISHING={castDistance:9,biteWindow:1.8,steeringRange:35,species:SPECIES};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const edges=SEATING_PATH.map((a,i)=>{const b=SEATING_PATH[(i+1)%SEATING_PATH.length];return {a,b,length:Math.hypot(b[0]-a[0],b[1]-a[1])};});
export const BOAT_PERIMETER=edges.reduce((n,e)=>n+e.length,0);
export function fishingSeat(slot,count){
 let distance=slot/Math.max(1,count)*BOAT_PERIMETER;
 for(const edge of edges){if(distance<=edge.length){const t=distance/edge.length,x=edge.a[0]+(edge.b[0]-edge.a[0])*t,z=edge.a[1]+(edge.b[1]-edge.a[1])*t;return {x,z,y:.94,yaw:Math.atan2(x,z),seatDistance:slot/Math.max(1,count)*BOAT_PERIMETER};}distance-=edge.length;}
 return {x:0,z:9.05,y:.94,yaw:0,seatDistance:0};
}
export function anglerColor(slot){const h=(slot*137.508%360)/60,c=.78,x=c*(1-Math.abs(h%2-1)),rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return '#'+rgb.map(n=>Math.round((n+.18)*255).toString(16).padStart(2,'0')).join('');}
export function fishingSpawn(m,p){
  if(m.phase==='lobby')m.fishing={elapsed:0,catches:[],catchSequence:0,ceremony:null};
  const all=[...m.players.values()],slot=all.indexOf(p);
  Object.assign(p,{...fishingSeat(slot,all.length),color:anglerColor(slot),caught:0,collection:Object.fromEntries(SPECIES.map(s=>[s.id,0])),participating:false,input:m.neutral(),lastInput:0,
    fishing:{stage:'ready',timer:0,age:0,castAge:0,distance:FISHING.castDistance,direction:0,offset:0,species:SPECIES[slot%SPECIES.length].id,lastCatch:null,energy:1,tension:.25,bob:0,fishX:0,fishZ:0,message:'던지기로 시작하세요'}});
}
export function fishingStart(m){
  for(const p of m.players.values()){fishingSpawn(m,p);p.participating=p.connected;}
  // Only connected anglers occupy the evenly spaced fishing positions this round.
  const all=[...m.players.values()].filter(p=>p.participating);
  all.forEach((p,i)=>Object.assign(p,fishingSeat(i,all.length)));
  m.fishing={elapsed:0,catches:[],catchSequence:0,ceremony:null};m.remaining=m.duration;m.results=null;m.phase='running';
}
function release(p,message){Object.assign(p.fishing,{stage:'cooldown',timer:1.2,bob:0,message});}
export function fishingAction(m,id,action){
  if(m.game==='fishing'&&m.phase==='finished'){
    const p=m.players.get(id),c=m.fishing.ceremony;
    if(!p?.connected||!m.results.winnerIds.includes(id)||!c)return;
    const owner=m.players.get(c.id);
    if(action==='cast'&&(['ready','close'].includes(c.stage)||!owner?.connected))Object.assign(c,{id,stage:'casting',timer:.65,distance:34});
    else if(action==='hook'&&c.id===id&&c.stage==='bite')c.stage='reeling';
    return;
  }
  const p=m.players.get(id);if(m.game!=='fishing'||m.phase!=='running'||!p?.connected||!p.participating)return;
  const f=p.fishing;
  if(action==='cast'&&f.stage==='ready'){
    Object.assign(f,{stage:'casting',timer:.65,castAge:0,age:0,energy:1,tension:.25,distance:FISHING.castDistance,direction:0,offset:0,species:SPECIES[Math.floor(Math.random()*SPECIES.length)].id,message:'찌가 내려앉는 중'});
  }else if(action==='hook'&&f.stage==='bite'){
    Object.assign(f,{stage:'fighting',age:0,energy:1,tension:.25,direction:Math.random()<.5?-1:1,turnTimer:2+Math.random()*2,message:'물고기 방향으로 기울이고 시계 방향으로 릴을 감으세요'});
  }else if(action==='hook'&&f.stage==='waiting')release(p,'너무 빨랐어요 · 큰 입질 때 당기세요');
}
export function fishingResults(m){
  const players=[...m.players.values()].filter(p=>p.participating).map(p=>({id:p.id,name:p.name,color:p.color,score:p.caught,collection:{...p.collection}})).sort((a,b)=>b.score-a.score);
  let rank=1;players.forEach((p,i)=>{if(i&&p.score!==players[i-1].score)rank=i+1;p.rank=rank;});
  return {mode:'fishing',teams:[],players,winnerIds:players.filter(p=>p.rank===1&&p.score>0).map(p=>p.id),total:players.reduce((n,p)=>n+p.score,0)};
}
export function fishingTick(m,dt,now){
  if(m.phase==='finished'){
    m.fishing.elapsed+=dt;
    const c=m.fishing.ceremony,p=c&&m.players.get(c.id);
    if(c?.stage==='casting'&&p?.connected){c.timer-=dt;if(c.timer<=0)c.stage='bite';}
    if(c?.stage==='reeling'&&p?.connected&&now-p.lastInput<350){c.distance=Math.max(1.8,c.distance-dt*6*clamp(p.input.reel,0,1));if(c.distance<=1.8)c.stage='close';}
    return;
  }
  if(m.phase!=='running')return;
  const steps=Math.max(1,Math.ceil(dt/.05)),step=dt/steps;
  for(let s=0;s<steps&&m.phase==='running';s++){
    const h=Math.min(step,m.remaining);m.remaining=Math.max(0,m.remaining-h);m.fishing.elapsed+=h;
    for(const p of m.players.values()){
      if(!p.participating)continue;const f=p.fishing;f.age+=h;f.castAge+=h;
      if(['casting','waiting','bite','cooldown'].includes(f.stage))f.timer-=h;
      if(f.stage==='casting'&&f.timer<=0)Object.assign(f,{stage:'waiting',timer:2.5+Math.random()*3,age:0,message:'찌를 지켜보세요'});
      if(f.stage==='waiting'&&f.timer<=0)Object.assign(f,{stage:'bite',timer:FISHING.biteWindow,age:0,message:'큰 입질! 폰 윗부분을 몸 안쪽으로 당기세요'});
      if(f.stage==='bite'&&f.timer<=0)release(p,'입질을 놓쳤어요 · 다시 던지세요');
      if(f.stage==='cooldown'&&f.timer<=0)Object.assign(f,{stage:'ready',message:'던지기로 다시 시작하세요'});
      if(f.stage==='fighting'){
        f.turnTimer-=h;if(f.turnTimer<=0){f.direction=-f.direction;f.turnTimer=2+Math.random()*2;}
        f.offset=clamp(f.offset+f.direction*h*.9,-4,4);
        const input=p.connected&&now-p.lastInput<350?p.input:{tilt:0,reel:0};
        const aligned=input.tilt*f.direction>.22,reel=clamp(input.reel,0,1);
        // Correctly following the run wears the fish out. Reeling against it strains the line.
        f.energy=clamp(f.energy-h*(aligned?.095:.018),0,1);
        f.tension=clamp(f.tension+h*(aligned?-.18: .10+reel*.38),.1,1);
        f.distance=clamp(f.distance-h*reel*(aligned?(f.energy<.2?4.2:1.8):.22)+h*(!aligned? .42*f.energy:0),0,23);
        if(f.tension>=1||f.distance>=23)release(p,'줄이 끊어졌어요 · 방향을 따라가며 릴을 감으세요');
        else if(f.distance<=1&&f.energy<.2){
          p.caught++;p.collection[f.species]++;f.lastCatch=f.species;
          m.fishing.catches.push({id:++m.fishing.catchSequence,playerId:p.id,species:f.species,at:m.fishing.elapsed,from:[p.x+Math.sin(p.yaw)*.65,p.y+1.3,p.z+Math.cos(p.yaw)*.65],yaw:p.yaw});
          if(m.fishing.catches.length>60)m.fishing.catches.shift();
          release(p,`${SPECIES.find(s=>s.id===f.species).name} 포획! · 상자에 넣는 중`);f.timer=CATCH_DURATION;
        }
        else f.message=aligned?'방향 일치 · 릴을 감으세요':'물고기 방향으로 기울이세요 · 무리하게 감으면 줄이 끊어져요';
      }
      f.bob=f.stage==='bite'?Math.sin(f.age*26)*.65-.35:f.stage==='waiting'?Math.sin(f.age*3)*.06:f.stage==='fighting'?Math.sin(f.age*12)*.16:0;
      // The angled PC camera still projects +X toward screen right at every seat.
      f.fishX=p.x+Math.sin(p.yaw)*f.distance+f.offset;f.fishZ=p.z+Math.cos(p.yaw)*f.distance;
    }
    if(m.remaining<=0){m.phase='finished';m.results=fishingResults(m);m.fishing.ceremony=m.results.winnerIds.length?{id:m.results.winnerIds[0],stage:'ready',distance:34,timer:0}:null;for(const p of m.players.values())p.input=m.neutral();}
  }
}
