import {COMBAT,circleInSector,lineClear,sectorPolygon} from './public/disguise-geometry.js';
const prop=(x,z,w,d,h,color,kind)=>({x,z,w,d,h,color,kind});
const wall=(x,z,w,d)=>prop(x,z,w,d,.95,'#51616d','wall');
const room=(name,x,z,w,d,color)=>({name,x,z,w,d,color});
const points=a=>a.map(([x,z])=>({x,z}));
export const DISGUISE_MAPS=[
 {id:'station',name:'환승역 · 막차 플랫폼',npc:'통근객',coat:'#466478',floor:'#aabebf',event:'역내 방송',concept:'열차가 통과하면 두 건널목이 닫힙니다',nodes:points([[-14,-8],[-7,-7],[0,-8],[7,-7],[14,-8],[-11,0],[11,0],[-14,8],[-6,7],[2,8],[8,7],[14,8]]),
  rooms:[room('북쪽 승강장',0,-6.5,34,9,'#bccac1'),room('선로',0,0,34,4,'#354754'),room('남쪽 대합실',0,6.5,34,9,'#9bb4bc')],
  walls:[wall(-15,-2,4,.4),wall(0,-2,18,.4),wall(15,-2,4,.4),wall(-15,2,4,.4),wall(0,2,18,.4),wall(15,2,4,.4)],
  props:[prop(-5,-6,3,1,.65,'#927b56','벤치'),prop(6,6,3,1,.65,'#927b56','벤치'),prop(0,-9.5,4,.8,1.3,'#387879','출발 안내'),prop(-14,5,1.4,2,1.1,'#d59b4c','매표기'),prop(14,-5,1.4,2,1.1,'#d59b4c','매표기')]},
 {id:'gallery',name:'미술관 · 다섯 개의 방',npc:'관람객',coat:'#955d72',floor:'#dbd1b9',event:'전시 조명 전환',concept:'순환 전시문이 동·서쪽 전시실의 동선을 바꿉니다',nodes:points([[-13,-8],[-10,-3],[-12,4],[-9,8],[0,0],[-2,-3],[3,2],[-2,-9],[0,9],[10,-8],[12,-3],[10,3],[13,8]]),
  rooms:[room('서쪽 회화실',-11,0,12,22,'#b7c9c3'),room('동쪽 조각실',11,0,12,22,'#c9b5b5'),room('중앙 로비',0,0,10,10,'#f0dfb3'),room('북쪽 특별전',0,-8,10,6,'#afbed0'),room('남쪽 휴게실',0,8,10,6,'#c4c19c')],
  walls:[wall(-5,-6.5,.5,9),wall(-5,6.5,.5,9),wall(5,-6.5,.5,9),wall(5,6.5,.5,9),wall(-3.8,-5,2.4,.5),wall(3.8,-5,2.4,.5),wall(-3.8,5,2.4,.5),wall(3.8,5,2.4,.5)],
  props:[prop(-12,-5,2,1,1.3,'#668c89','회화'),prop(-10,5,2,1,1.3,'#cb916b','회화'),prop(12,-5,1.5,1.5,1.5,'#d5b26c','조각'),prop(11,5,1.5,1.5,1.5,'#7595ac','조각'),prop(0,8,3,1,.5,'#8c765d','휴식 벤치'),prop(0,-8,1.4,1.4,1.5,'#b4a5c8','특별전')]},
 {id:'warehouse',name:'물류 창고 · 역주행 컨베이어',npc:'작업자',coat:'#d3933b',floor:'#8b9c9a',event:'작업 점검 신호',concept:'중앙 컨베이어가 모두를 운반하고 주기적으로 방향을 바꿉니다',nodes:points([[-14,-8],[-7,-8],[0,-9],[9,-9],[15,-8],[-14,0],[-7,0],[0,0],[10,0],[15,9],[7,9],[0,9],[-7,9],[-15,8]]),
  rooms:[room('서쪽 적재실',-9.3,0,15.4,22,'#8caaa0'),room('중앙 컨베이어',0,0,3.2,22,'#414e5b'),room('동쪽 출고실',9.3,0,15.4,22,'#a5a188')],walls:[],
  props:[prop(-11,-3,3,10,1.45,'#526b77','랙 A'),prop(-4,3,2.8,9,1.45,'#526b77','랙 B'),prop(5,-3,2.8,10,1.45,'#526b77','랙 C'),prop(12,3,3,10,1.45,'#526b77','랙 D'),prop(-13,9.5,3,1,.9,'#a7835b','적재대'),prop(12,-9.5,3,1,.9,'#a7835b','출고대')]}
];
export const DISGUISE={speed:2.7,npcCount:64,attackRange:COMBAT.range,attackHalfAngle:COMBAT.halfAngle,bodyRadius:COMBAT.bodyRadius,windup:COMBAT.windup,recovery:COMBAT.recovery,attackCooldown:2,wrongCooldown:6,exposeTime:1,curtainTime:1,freezeAfter:45,revealAfter:75,revealInterval:30};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mapFor=m=>DISGUISE_MAPS.find(v=>v.id===(m.disguiseMap||'station'));
const inside=(p,o,pad=0)=>Math.abs(p.x-o.x)<o.w/2+pad&&Math.abs(p.z-o.z)<o.d/2+pad;
export function disguiseMechanic(map,time=0){
 if(map.id==='station'){const t=time%20,closed=t>=13&&t<18;return {kind:'train',closed,warning:t>=10&&t<13,progress:closed?(t-13)/5:0,label:closed?'열차 통과 · 건널목 폐쇄':t>=10&&t<13?'열차 접근 · 건널목 주의':'건널목 개방'};}
 if(map.id==='gallery'){const t=time%24,side=t<12?'east':'west',closed=t%12>=3;return {kind:'doors',side,closed,warning:!closed,label:(side==='east'?'동쪽':'서쪽')+(closed?' 전시문 닫힘 · 다른 방으로 우회':' 전시문 닫힘 예고')};}
 const direction=Math.floor(time/18)%2===0?1:-1;return {kind:'belt',direction,label:'컨베이어 '+(direction>0?'남쪽 ↓':'북쪽 ↑')+' 운반 · '+Math.ceil(18-time%18)+'초 뒤 반전'};
}
export function disguiseSolids(map,mechanic=disguiseMechanic(map)){
 const solids=[...map.walls,...map.props];if(mechanic.kind==='train'&&mechanic.closed)solids.push(prop(0,0,34,2.8,.08,'#bf514a','차단 선로'));
 if(mechanic.kind==='doors'&&mechanic.closed)solids.push(prop(mechanic.side==='east'?5:-5,0,.5,4,.85,'#bf7a54','전시문'));
 return solids;
}
export function disguiseFree(p,solids,pad=COMBAT.bodyRadius){return Math.abs(p.x)<=16.5-pad&&Math.abs(p.z)<=10.5-pad&&!solids.some(o=>inside(p,o,pad));}
const navCache=new Map();
function navigation(map,mechanic){const key=map.id+':'+(mechanic.closed?mechanic.side||'closed':'open');if(navCache.has(key))return navCache.get(key);const solids=disguiseSolids(map,mechanic),grid=new Map();for(let z=-10;z<=10;z++)for(let x=-16;x<=16;x++){const p={x,z};if(disguiseFree(p,solids,.42))grid.set(`${x},${z}`,p);}const nav={solids,grid};navCache.set(key,nav);return nav;}
function closest(p,grid){let best=null,dist=Infinity;for(const v of grid.values()){const d=(v.x-p.x)**2+(v.z-p.z)**2;if(d<dist){best=v;dist=d;}}return best;}
export function disguisePath(start,goal,map,mechanic=disguiseMechanic(map)){
 const {solids,grid}=navigation(map,mechanic);if(disguiseFree(goal,solids,.42)&&lineClear(start,goal,solids,.42))return [{...goal}];
 const a=closest(start,grid),b=closest(goal,grid);if(!a||!b)return [];const key=p=>`${p.x},${p.z}`,ak=key(a),bk=key(b),open=[{...a,g:0,f:0}],cost=new Map([[ak,0]]),parent=new Map();let found=false;
 while(open.length){open.sort((a,b)=>b.f-a.f);const p=open.pop(),pk=key(p);if(pk===bk){found=true;break;}if(p.g>cost.get(pk))continue;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nk=`${p.x+dx},${p.z+dz}`,q=grid.get(nk);if(!q||!lineClear(p,q,solids,.42))continue;const g=p.g+Math.hypot(dx,dz);if(g>=(cost.get(nk)??Infinity))continue;cost.set(nk,g);parent.set(nk,pk);open.push({...q,g,f:g+Math.hypot(q.x-b.x,q.z-b.z)});}}
 if(!found)return [];const raw=[];let k=bk;while(k!==ak){raw.unshift({...grid.get(k)});k=parent.get(k);}raw.unshift({...a});if(disguiseFree(goal,solids,.42)&&lineClear(b,goal,solids,.42))raw.push({...goal});const path=[];let origin=start;while(raw.length){let i=raw.length-1;while(i>0&&!lineClear(origin,raw[i],solids,.42))i--;const next=raw[i];path.push(next);origin=next;raw.splice(0,i+1);}return path;
}
function autoState(p){p.path=[];p.wait=Math.random()*1.7;p.routeVersion='';p.goal=null;p.behavior='대기';}
function validPoint(map,solids,i=0){for(let attempt=0;attempt<80;attempt++){const n=map.nodes[(i+Math.floor(Math.random()*map.nodes.length))%map.nodes.length],p={x:n.x+(Math.random()-.5)*3,z:n.z+(Math.random()-.5)*2.5};if(disguiseFree(p,solids,.45))return p;}return {...closest(map.nodes[0],navigation(map,disguiseMechanic(map)).grid)};}
function scatter(map,solids){for(let i=0;i<100;i++){const p={x:(Math.random()-.5)*31,z:(Math.random()-.5)*19};if(disguiseFree(p,solids,.45)&&(map.id!=='station'||Math.abs(p.z)>2.8))return p;}return validPoint(map,solids);}
export function disguiseSpawn(m,p){const map=mapFor(m),point=scatter(map,disguiseSolids(map));Object.assign(p,{...point,y:0,yaw:Math.random()*Math.PI*2,alive:true,participating:false,mimic:true,cooldown:0,exposed:0,kills:0,mistakes:0,survival:0,moving:false,vx:0,vz:0,attack:null,message:'NPC 흉내 · 공격하면 자동 해제',input:m.neutral(),lastInput:0});autoState(p);}
export function selectDisguiseMap(m,id){if(m.game!=='disguise'||m.phase!=='lobby')throw Error('맵은 위장 게임 대기실에서 선택하세요.');if(!DISGUISE_MAPS.some(v=>v.id===id))throw Error('올바른 맵을 선택하세요.');m.disguiseMap=id;m.disguise=null;for(const p of m.players.values())disguiseSpawn(m,p);}
export function disguiseStart(m){if([...m.players.values()].filter(p=>p.connected).length<2)throw Error('위장 생존은 2명 이상 필요합니다.');const map=mapFor(m),solids=disguiseSolids(map);m.disguise={elapsed:0,quiet:0,stage:'normal',freeze:0,reveal:0,curtain:0,nextReveal:DISGUISE.revealAfter,freezeDone:false,revealPoints:[],swings:[],serial:0,mechanic:disguiseMechanic(map),npcs:Array.from({length:DISGUISE.npcCount},(_,i)=>{const p={id:'npc-'+i,...scatter(map,solids),yaw:Math.random()*Math.PI*2,moving:false,vx:0,vz:0};autoState(p);return p;})};for(const p of m.players.values()){disguiseSpawn(m,p);p.participating=p.connected;p.alive=p.connected;}m.phase='running';m.results=null;}
function finish(m){const entries=[...m.players.values()].filter(p=>p.participating).sort((a,b)=>Number(b.alive)-Number(a.alive)||b.survival-a.survival);let rank=1;m.results={mode:'disguise',winnerIds:entries.filter(p=>p.alive).map(p=>p.id),players:entries.map((p,i)=>{if(i&&(p.alive!==entries[i-1].alive||p.survival!==entries[i-1].survival))rank=i+1;return {id:p.id,name:p.name,alive:p.alive,kills:p.kills,mistakes:p.mistakes,survival:p.survival,rank};})};m.phase='finished';m.disguise.curtain=0;m.disguise.reveal=0;for(const p of m.players.values()){p.input=m.neutral();p.attack=null;}}
export function disguiseAction(m,id,action){const p=m.players.get(id),s=m.disguise;if(m.phase!=='running'||!p?.connected||!p.alive||!p.participating||!s)return;
 if(action==='mimic'){if(p.attack)return;p.mimic=!p.mimic;if(p.mimic)autoState(p);p.message=p.mimic?'NPC 생활 패턴에 합류':'직접 이동 · 부채꼴 안의 몸통을 공격';return;}
 if(action!=='attack'||p.attack||p.cooldown>0||s.curtain>0||s.freeze>0||s.reveal>0)return;
 p.mimic=false;if(Date.now()-p.lastInput<350&&Math.hypot(p.input.moveX,p.input.moveY)>.12)p.yaw=Math.atan2(p.input.moveX,-p.input.moveY);p.vx=0;p.vz=0;p.cooldown=DISGUISE.attackCooldown;const solids=disguiseSolids(mapFor(m),s.mechanic),swing={id:++s.serial,attacker:p.id,x:p.x,z:p.z,yaw:p.yaw,age:0,resolved:false,result:'windup',polygon:sectorPolygon(p,p.yaw,solids)};p.attack=swing.id;s.swings.push(swing);p.message='공격 준비! 표시된 부채꼴 안의 몸통에 명중';
}
function resolve(m,swing,solids){const s=m.disguise,p=m.players.get(swing.attacker);swing.resolved=true;if(!p?.alive||!p.connected){swing.result='cancelled';return;}if(s.curtain>0||s.freeze>0||s.reveal>0){swing.result='cancelled';p.attack=null;return;}
 const candidates=[...m.players.values()].filter(q=>q!==p&&q.alive&&q.participating&&q.connected).concat(s.npcs),hit=candidates.filter(q=>circleInSector(swing,q,swing.yaw)&&lineClear(swing,q,solids,.015)).sort((a,b)=>Math.hypot(a.x-swing.x,a.z-swing.z)-Math.hypot(b.x-swing.x,b.z-swing.z)||a.id.localeCompare(b.id))[0];
 if(hit){swing.hit={x:hit.x,z:hit.z};swing.target=hit.id;}
 if(hit&&m.players.has(hit.id)){swing.result='kill';hit.alive=false;hit.attack=null;hit.survival=s.elapsed;hit.input=m.neutral();hit.message='탈락 · 다음 라운드를 기다리세요';p.kills++;p.attack=null;s.quiet=0;s.freezeDone=false;s.nextReveal=DISGUISE.revealAfter;s.curtain=DISGUISE.curtainTime;s.revealPoints=[];p.message='명중 · 커튼 동안 군중 속으로 숨으세요';if([...m.players.values()].filter(q=>q.alive&&q.participating&&q.connected).length<=1)finish(m);}
 else{swing.result=hit?'npc':'miss';p.mistakes++;p.cooldown=DISGUISE.wrongCooldown;p.exposed=DISGUISE.exposeTime;p.message=hit?'NPC 오인 공격 · 6초 대기':'빗나감 · 몸통과 부채꼴이 겹쳐야 명중 · 6초 대기';}
}
function move(p,dx,dz,dt,solids){const n=Math.max(1,Math.hypot(dx,dz)),blend=1-Math.exp(-10*dt);p.vx=(p.vx||0)+(dx/n*DISGUISE.speed-(p.vx||0))*blend;p.vz=(p.vz||0)+(dz/n*DISGUISE.speed-(p.vz||0))*blend;if(!dx&&!dz){p.vx=0;p.vz=0;}const oldX=p.x,oldZ=p.z,x=clamp(p.x+p.vx*dt,-16.15,16.15),z=clamp(p.z+p.vz*dt,-10.15,10.15);if(disguiseFree({x,z:p.z},solids))p.x=x;if(disguiseFree({x:p.x,z},solids))p.z=z;p.moving=Math.hypot(p.x-oldX,p.z-oldZ)>.001;if(p.moving){const target=Math.atan2(p.x-oldX,p.z-oldZ),difference=Math.atan2(Math.sin(target-p.yaw),Math.cos(target-p.yaw));p.yaw+=clamp(difference,-dt*7,dt*7);}}
function auto(p,dt,map,s,solids){p.moving=false;const version=map.id+':'+(s.mechanic.closed?s.mechanic.side||'closed':'open');if(p.routeVersion!==version){p.path=[];p.wait=0;p.routeVersion=version;}
 if(p.wait>0){p.wait-=dt;p.vx=0;p.vz=0;p.behavior=map.id==='gallery'?'작품 감상':map.id==='warehouse'?'물품 점검':'안내 확인';return;}
 if(!p.path?.length){const goal=validPoint(map,solids);p.path=disguisePath(p,goal,map,s.mechanic);p.goal=goal;if(!p.path.length){p.wait=.4;return;}}
 while(p.path.length>1&&lineClear(p,p.path[1],solids,.42))p.path.shift();const target=p.path[0],dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.2){p.path.shift();if(!p.path.length)p.wait=.7+Math.random()*3;return;}move(p,dx/d,dz/d,Math.min(dt,d/DISGUISE.speed),solids);p.behavior='이동';if(!p.moving){p.path=[];p.wait=.15;}
}
function evacuate(p,map,s,solids){if(disguiseFree(p,solids))return;const free=closest(p,navigation(map,s.mechanic).grid);if(free){p.x=free.x;p.z=free.z;p.path=[];p.vx=0;p.vz=0;}}
const down=(value,dt)=>Math.max(0,value-dt)<1e-6?0:Math.max(0,value-dt);
export function disguiseTick(m,dt,now){if(m.phase!=='running'||!m.disguise||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);const s=m.disguise,map=mapFor(m);s.elapsed+=dt;m.remaining=0;s.curtain=down(s.curtain,dt);s.freeze=down(s.freeze,dt);s.reveal=down(s.reveal,dt);s.mechanic=disguiseMechanic(map,s.elapsed);const solids=disguiseSolids(map,s.mechanic);
 if(s.curtain===0){s.quiet+=dt;if(!s.freezeDone&&s.quiet>=DISGUISE.freezeAfter){s.freeze=.5;s.freezeDone=true;}else if(s.quiet>=s.nextReveal&&s.freeze===0){s.reveal=.3;s.nextReveal+=DISGUISE.revealInterval;s.revealPoints=[...m.players.values()].filter(p=>p.alive&&p.participating&&p.connected).map(p=>({x:p.x,z:p.z}));}}
 for(const n of s.npcs){evacuate(n,map,s,solids);if(s.freeze===0)auto(n,dt,map,s,solids);else n.moving=false;}
 for(const p of m.players.values()){if(!p.participating||!p.alive)continue;if(!p.connected){p.alive=false;p.attack=null;p.survival=s.elapsed;continue;}evacuate(p,map,s,solids);p.survival=s.elapsed;p.cooldown=down(p.cooldown,dt);p.exposed=down(p.exposed,dt);if(p.attack){p.moving=false;continue;}const input=now-p.lastInput<350?p.input:m.neutral();if(Math.hypot(input.moveX,input.moveY)>.12)p.mimic=false;if(p.mimic){if(s.freeze===0)auto(p,dt,map,s,solids);else p.moving=false;}else move(p,input.moveX,-input.moveY,dt,solids);}
 // The conveyor affects NPCs and users identically, including imitation.
 if(s.mechanic.kind==='belt'&&s.freeze===0)for(const p of [...s.npcs,...m.players.values()])if((!('alive'in p)||p.alive&&p.participating)&&!p.attack&&Math.abs(p.x)<1.35&&Math.abs(p.z)<9.5){const z=p.z+s.mechanic.direction*dt*1.15;if(disguiseFree({x:p.x,z},solids))p.z=z;}
 for(const swing of s.swings){swing.age+=dt;if(!swing.resolved&&swing.age+1e-8>=COMBAT.windup)resolve(m,swing,solids);if(swing.age>=COMBAT.windup+COMBAT.recovery){const p=m.players.get(swing.attacker);if(p?.attack===swing.id)p.attack=null;}}
 s.swings=s.swings.filter(v=>v.age<.8);s.stage=s.curtain>0?'curtain':s.freeze>0?'freeze':s.reveal>0?'reveal':'normal';if(s.reveal===0)s.revealPoints=[];
 if(m.phase==='running'&&[...m.players.values()].filter(p=>p.alive&&p.participating&&p.connected).length<=1)finish(m);
}
export function disguiseSnapshot(m){const map=mapFor(m),s=m.disguise||{elapsed:0,quiet:0,curtain:0,freeze:0,reveal:0,stage:'normal',npcs:[],revealPoints:[],swings:[],mechanic:disguiseMechanic(map)},slim=p=>{const {path,goal,routeVersion,...out}=p;return out;};return {...DISGUISE,...s,npcs:s.npcs.map(slim),solids:disguiseSolids(map,s.mechanic),map,maps:DISGUISE_MAPS};}
