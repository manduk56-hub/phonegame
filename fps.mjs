import {readFileSync} from 'node:fs';
export const FPS_ARENA=JSON.parse(readFileSync(new URL('./game/fps-arena.json',import.meta.url),'utf8'));
export const FPS_MOVE_SPEED=10;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function resetFps(m){m.fps={flag:{x:0,z:0,carrier:null,pickupRadius:2.5},shots:[],sequence:0};for(const t of m.teams){t.captures=0;if(m.game==='fps')t.color=['#2866ce','#d84238','#eab642','#65b879','#9b76d3','#ea7b43','#db6da0','#46b5bf'][t.id];}}
export function fpsSpawn(m,p){
  const members=[...m.players.values()].filter(q=>q.team===p.team),slot=members.indexOf(p),a=p.team*Math.PI*2/m.teamCount;
  const t=m.teams[p.team],side=(slot-(members.length-1)/2)*1.2;
  Object.assign(p,{x:t.x+Math.cos(a)*side,z:t.z-Math.sin(a)*side,y:0,yaw:a+Math.PI,pitch:0,hp:100,respawn:0,cooldown:0,kills:0,deaths:0,captures:0,hitSerial:0,hit:false,message:'',input:m.neutral(),lastInput:0});
}
export function fpsAim(p,v){
  const {forward,strafe}=p.input;
  if(Math.hypot(forward,strafe)>0){
    const yaw=(Number.isFinite(v.yaw)?v.yaw:p.yaw)+Math.atan2(strafe,forward);
    p.yaw=((yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    p.input={forward:Math.min(1,Math.hypot(forward,strafe)),strafe:0};
  }
  p.pitch=0;
}
// Slab intersection uses the same axis-aligned boxes rendered on PC and phones.
export function rayBox(o,d,b){
  let near=0,far=100;
  for(const k of ['x','y','z']){if(Math.abs(d[k])<1e-9){if(o[k]<b.min[k]||o[k]>b.max[k])return Infinity;continue;}const a=(b.min[k]-o[k])/d[k],c=(b.max[k]-o[k])/d[k];near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));if(near>far)return Infinity;}
  return near;
}
export const wallBox=w=>({min:{x:w.x-w.w/2,y:0,z:w.z-w.d/2},max:{x:w.x+w.w/2,y:w.h,z:w.z+w.d/2}});
export function fpsFire(m,id,v={}){
  const p=m.players.get(id);if(m.game!=='fps'||m.phase!=='running'||!p?.connected||p.hp<=0||p.cooldown>0)return;
  p.pitch=0;p.cooldown=.25;p.hit=false;
  const o={x:p.x,y:FPS_ARENA.eye,z:p.z},d={x:Math.sin(p.yaw),y:0,z:Math.cos(p.yaw)};
  let nearest=100,target=null;
  for(const w of FPS_ARENA.walls)nearest=Math.min(nearest,rayBox(o,d,wallBox(w)));
  for(const q of m.players.values()){
    if(q===p||!q.connected||q.hp<=0)continue;
    const t=rayBox(o,d,{min:{x:q.x-.4,y:0,z:q.z-.4},max:{x:q.x+.4,y:1.9,z:q.z+.4}});
    if(t<nearest){nearest=t;target=q;}
  }
  m.fps.shots.push({id:++m.fps.sequence,player:id,x:p.x,y:o.y,z:p.z,ex:o.x+d.x*nearest,ey:o.y+d.y*nearest,ez:o.z+d.z*nearest,ttl:.16});
  if(target&&target.team!==p.team){
    p.hit=true;p.hitSerial++;target.hp=Math.max(0,target.hp-34);p.message='명중!';
    if(target.hp===0){target.deaths++;p.kills++;target.respawn=2;target.input=m.neutral();target.message='사망 · 2초 후 이 자리에서 부활';dropFlag(m,target);}
  }
}
export function dropFlag(m,p){if(m.fps?.flag.carrier===p.id)Object.assign(m.fps.flag,{x:p.x,z:p.z,carrier:null});}
export function canPickFlag(p,flag){
  const length=dist(p,flag);if(length>(flag.pickupRadius??2.5))return false;if(length<1e-8)return true;
  const direction={x:(flag.x-p.x)/length,y:0,z:(flag.z-p.z)/length};
  return !FPS_ARENA.walls.some(w=>rayBox({x:p.x,y:.75,z:p.z},direction,wallBox(w))<length);
}
export function fpsBlocked(x,z){return FPS_ARENA.walls.some(w=>Math.abs(x-w.x)<w.w/2+.4&&Math.abs(z-w.z)<w.d/2+.4);}
export function fpsTick(m,dt,now){
  if(m.phase!=='running')return;m.remaining=Math.max(0,m.remaining-dt);
  m.fps.shots=m.fps.shots.filter(s=>(s.ttl-=dt)>0);
  for(const p of m.players.values()){
    p.cooldown=Math.max(0,p.cooldown-dt);
    if(p.hp<=0){p.respawn=Math.max(0,p.respawn-dt);if(p.respawn<=1e-8){p.hp=100;p.respawn=0;p.input=m.neutral();p.lastInput=0;p.message='부활!';}continue;}
    if(!p.connected||now-p.lastInput>350)continue;
    const i=p.input,len=Math.max(1,Math.hypot(i.forward,i.strafe)),speed=FPS_MOVE_SPEED*(m.fps.flag.carrier===p.id?.8:1);
    const dx=(Math.sin(p.yaw)*i.forward+Math.cos(p.yaw)*i.strafe)/len*speed*dt,dz=(Math.cos(p.yaw)*i.forward-Math.sin(p.yaw)*i.strafe)/len*speed*dt;
    const limit=FPS_ARENA.limit-.4;
    const x=clamp(p.x+dx,-limit,limit),z=clamp(p.z+dz,-limit,limit);
    if(!fpsBlocked(x,p.z))p.x=x;if(!fpsBlocked(p.x,z))p.z=z;
  }
  const flag=m.fps.flag;
  if(flag.carrier){const p=m.players.get(flag.carrier);if(!p?.connected||p.hp<=0){if(p)dropFlag(m,p);else flag.carrier=null;}else{flag.x=p.x;flag.z=p.z;if(dist(p,m.teams[p.team])<3){m.teams[p.team].captures++;p.captures++;p.message='깃발 운반 성공! +1점';Object.assign(flag,{x:0,z:0,carrier:null});}}}
  else{const p=[...m.players.values()].find(p=>p.connected&&p.hp>0&&canPickFlag(p,flag));if(p){flag.carrier=p.id;p.message='깃발 획득! 우리 진영으로 이동하세요';}}
  if(m.remaining===0){m.phase='finished';m.results=fpsResults(m);for(const p of m.players.values())p.input=m.neutral();}
}
export function fpsResults(m){
  const rank=list=>list.sort((a,b)=>b.score-a.score).map((p,i,a)=>({...p,rank:a.findIndex(q=>q.score===p.score)+1}));
  const participating=new Set([...m.players.values()].map(p=>p.team));
  const teams=rank(m.teams.filter(t=>participating.has(t.id)).map(t=>({id:t.id,color:t.color,score:t.captures})));
  return {mode:'fps',teams,players:rank([...m.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,score:p.captures,kills:p.kills,deaths:p.deaths}))),winnerIds:teams.filter(t=>t.rank===1&&t.score>0).map(t=>t.id),total:teams.reduce((n,t)=>n+t.score,0)};
}
