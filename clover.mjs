import {COLORS} from './simulation.mjs';
export const CLOVER={width:24,depth:18,reach:1.55,speed:3.4,resetDelay:2.4};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cloverField(round=1,previous=-1){
 const plants=Array.from({length:221},(_,id)=>({id,x:(id%17-8)*1.32+(Math.random()-.5)*.42,z:(Math.floor(id/17)-6)*1.22+(Math.random()-.5)*.36,angle:Math.random()*Math.PI*2}));
 let target=Math.floor(Math.random()*plants.length);if(target===previous)target=(target+1)%plants.length;
 return {...CLOVER,round,plants,target,reset:0,winner:null};
}
export function cloverSpawn(m,p){const i=[...m.players.keys()].indexOf(p.id),a=i/16*Math.PI*2;Object.assign(p,{x:Math.sin(a)*11,z:Math.cos(a)*8,y:0,yaw:Math.PI,number:i+1,color:COLORS[i%COLORS.length],clovers:0,crouching:false,selected:null,message:'',input:m.neutral(),lastInput:0});}
export function cloverStart(m){m.clover=cloverField();m.phase='running';m.remaining=m.duration;m.results=null;for(const p of m.players.values())cloverSpawn(m,p);}
export function cloverAction(m,id,action,value={}){
 const p=m.players.get(id),s=m.clover;if(m.phase!=='running'||!p?.connected||!s||s.reset>0)return;
 if(action==='crouch'){p.crouching=!p.crouching;p.selected=null;p.message='';return;}
 if(value.round!==s.round)return;
 if(action==='clover-select'){
  const plant=s.plants.find(v=>v.id===value.plant);
  if(!p.crouching){p.message='먼저 웅크리세요';return;}
  p.selected=plant&&Math.hypot(p.x-plant.x,p.z-plant.z)<=CLOVER.reach?plant.id:null;
  p.message=p.selected===null?'손이 닿는 클로버를 터치하세요':'선택했어요 · 뽑기를 누르세요';return;
 }
 if(action!=='pull')return;
 const plant=s.plants.find(v=>v.id===p.selected);
 if(!p.crouching||!plant||Math.hypot(p.x-plant.x,p.z-plant.z)>CLOVER.reach){p.selected=null;p.message='가까이 이동 → 웅크리기 → 클로버 터치';return;}
 if(plant.id!==s.target){p.message='세잎클로버예요 · 다시 찾아보세요';p.selected=null;return;}
 p.clovers++;s.winner={id:p.id,name:p.name,number:p.number};s.reset=CLOVER.resetDelay;p.message='네잎클로버 발견! +1점';
}
export function cloverTick(m,dt,now){
 if(m.phase!=='running')return;dt=Number.isFinite(dt)?clamp(dt,0,.1):0;m.remaining=Math.max(0,m.remaining-dt);
 const s=m.clover;
 if(s.reset>0){s.reset=Math.max(0,s.reset-dt);if(s.reset===0){m.clover=cloverField(s.round+1,s.target);for(const p of m.players.values()){const score=p.clovers;cloverSpawn(m,p);p.clovers=score;}}}
 else for(const p of m.players.values()){
  if(!p.connected||now-p.lastInput>350)continue;
  const i=p.input,n=Math.max(1,Math.hypot(i.moveX,i.moveY)),speed=CLOVER.speed*(p.crouching?.32:1);
  p.x=clamp(p.x+i.moveX/n*speed*dt,-11.7,11.7);p.z=clamp(p.z-i.moveY/n*speed*dt,-8.7,8.7);p.yaw+=i.turn*2*dt;
  if(Math.hypot(i.moveX,i.moveY)>.05){p.selected=null;p.message='';}
 }
 if(m.remaining===0){const players=[...m.players.values()].map(p=>({id:p.id,name:p.name,score:p.clovers})).sort((a,b)=>b.score-a.score);players.forEach((p,i)=>p.rank=i&&p.score===players[i-1].score?players[i-1].rank:i+1);m.results={mode:'clover',players,winnerIds:players.filter(p=>p.rank===1&&p.score>0).map(p=>p.id)};m.phase='finished';}
}
