import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {Match} from '../simulation.mjs';
import {createServer} from '../server.mjs';
import {EXCAVATOR_MAPS,waterHeight} from '../waterway.mjs';
import {decodeSurface,groundGeometry,waterGeometry} from '../public/water-surface.js';

function match(count=2,map='waterfall'){const m=new Match();m.configure(count,60);m.selectExcavatorMap(map);const players=Array.from({length:count},(_,i)=>m.join('굴착 '+i));m.start();return {m,a:players[0],b:players[1]};}
function aim(m,p,x,z,height=.02,heading=0){
  p.y=0;p.yaw=heading;p.turret=0;p.stick=-1.4;p.curl=-.7;p.x=0;p.z=0;
  let low=-.25,high=1.35;for(let i=0;i<40;i++){p.boom=(low+high)/2;if(m.bucket(p).height<height)low=p.boom;else high=p.boom;}
  const tip=m.bucket(p);p.x=x-tip.x;p.z=z-tip.z;p.cooldown=0;
}
function discard(m,p){aim(m,p,30,30);m.action(p.id,'drop');assert.equal(p.cargo,0);}
function flow(m,steps=850){for(let i=0;i<steps&&m.phase==='running';i++)m.tick(.05,1000+i*50);}
function route(m,lane,depth=.4){for(let row=5;row<m.water.rows;row++)for(let col=8;col<=12;col++)lane.depth[row*m.water.cols+col]=depth;lane.revision++;}
const volume=(w,lane)=>lane.depth.reduce((sum,d)=>sum+d*w.size*w.size,0);
function footprint(m,a,x=.13,z=4,heading=0){const lane=m.water.lanes[0],before=lane.depth.slice();aim(m,a,lane.x+x,m.water.start+z,.02,heading);m.action(a.id,'scoop');return lane.depth.map((d,i)=>d-before[i]);}
function moments(w,diff){let total=0,x=0,z=0;for(let i=0;i<diff.length;i++){total+=diff[i];x+=diff[i]*(i%w.cols)*w.size;z+=diff[i]*Math.floor(i/w.cols)*w.size;}x/=total;z/=total;let xx=0,zz=0;for(let i=0;i<diff.length;i++){xx+=diff[i]*((i%w.cols)*w.size-x)**2;zz+=diff[i]*(Math.floor(i/w.cols)*w.size-z)**2;}return {x,z,xx:xx/total,zz:zz/total};}

test('only sand and waterfall remain, maps are lobby-only, identities persist and new rounds reset the surface',()=>{
 assert.deepEqual(EXCAVATOR_MAPS.map(m=>m.id),['sand','waterfall']);const {m,a}=match();assert.throws(()=>m.selectExcavatorMap('sand'),/대기실/);m.lobby();const token=a.token;assert.throws(()=>m.selectExcavatorMap('canyon'),/올바른/);
 m.water.lanes[0].depth[800]=.5;m.start();assert.equal(m.water.lanes[0].depth[800],0);assert.equal(a.token,token);m.lobby();m.selectExcavatorMap('sand');assert.equal(m.water,null);
});

test('a scoop removes a curved bucket footprint, preserves surrounding soil, and tracks exact excavated volume',()=>{
 const {m,a}=match();const lane=m.water.lanes[0],before=volume(m.water,lane),diff=footprint(m,a);
 const changed=[...diff].filter(d=>d>0);assert(changed.length>5&&changed.length<40);assert(new Set(changed.map(d=>d.toFixed(4))).size>5,'bowl must have different depths, not one disappearing block');
 assert(Math.max(...changed)>.2&&Math.max(...changed)<=.3);assert.equal(lane.depth[30*m.water.cols],0);assert(a.cargo>0&&a.cargo<=40);
 assert(Math.abs((volume(m.water,lane)-before)*230-a.cargo)<1e-8);assert.equal(a.cargo,a.delivered);
 const shape=groundGeometry(m.water,lane.depth);assert.equal(shape.positions.length,lane.depth.length*3);assert(shape.normals.some(n=>n!==0&&n!==1),'mesh must have continuous slope normals');
});

test('subsample bucket movements change the excavation shape and rotating the bucket rotates its footprint',()=>{
 const first=match(),second=match(),turned=match();const d1=footprint(first.m,first.a,.03),d2=footprint(second.m,second.a,.10),d3=footprint(turned.m,turned.a,.03,4,Math.PI/2);
 assert.notDeepEqual([...d1],[...d2],'a seven-centimeter movement cannot snap to the same tile');
 const a=moments(first.m.water,d1),b=moments(second.m.water,d2),c=moments(turned.m.water,d3);
 assert(b.x-a.x>.04&&b.x-a.x<.1);assert(a.z<4,'bowl extends behind its cutting lip');assert(c.x<2+.03,'rotated bowl extends toward the machine');
});

test('same pose cannot repeatedly mine empty space; lowering the cutting lip deepens the same hollow',()=>{
 const {m,a}=match();footprint(m,a);const lane=m.water.lanes[0],first=lane.depth.slice(),cargo=a.cargo;a.cooldown=0;m.action(a.id,'scoop');assert.equal(a.cargo,cargo);assert.deepEqual(lane.depth,first);
 const tip=m.bucket(a),ground=waterHeight(m,tip);discard(m,a);aim(m,a,tip.x,tip.z,ground+.02);m.action(a.id,'scoop');assert(a.cargo>0);assert(lane.depth.some((d,i)=>d>first[i]));
 discard(m,a);assert(m.groundPiles[0].dirt>0);
});

test('contact, ownership, capacity, disconnection and dumping gates match the real bucket and conserve soil',()=>{
 const {m,a}=match();const lane=m.water.lanes[0];aim(m,a,lane.x+.1,m.water.start+4.2,1);m.action(a.id,'scoop');assert.equal(a.cargo,0);
 aim(m,a,m.water.lanes[1].x+.1,m.water.start+4.2);m.action(a.id,'scoop');assert.equal(a.cargo,0);
 a.cargo=39;const before=volume(m.water,lane);aim(m,a,lane.x+.1,m.water.start+4.2);m.action(a.id,'scoop');assert.equal(a.cargo,40);assert(Math.abs((volume(m.water,lane)-before)*230-1)<1e-8);
 a.cooldown=0;m.action(a.id,'drop');assert.equal(a.cargo,40);assert.match(a.message,/밖/);discard(m,a);
 m.disconnect(a.id);aim(m,a,lane.x+.5,m.water.start+5.2);m.action(a.id,'scoop');assert.equal(a.cargo,0);
});

test('continuous water outline fits the curved pool and does not fill a rectangular soil sample',()=>{
 const {m}=match();const w=m.snapshot().water,{depth,wet}=decodeSurface(w.lanes[0].surface,w.rows*w.cols),vertices=waterGeometry(w,depth,wet);assert(vertices.length>0);
 const z=[...vertices].filter((_,i)=>i%3===2);assert(z.some(v=>Math.abs((v-w.start)/w.size-Math.round((v-w.start)/w.size))>.01),'shore must interpolate between samples');
 assert.deepEqual([...decodeSurface(w.lanes[0].surface,w.rows*w.cols).wet],[...wet]);
});

test('isolated pits and a shallow crest block flow; a connected deep channel reaches the goal and freezes results',()=>{
 const {m}=match();const lane=m.water.lanes[0];route(m,lane);for(let col=0;col<m.water.cols;col++)lane.depth[35*m.water.cols+col]=.20;
 flow(m,200);assert(lane.progress<50);assert.equal(lane.wet[60*m.water.cols+10],0);assert.equal(m.phase,'running');
 for(let col=8;col<=12;col++)lane.depth[35*m.water.cols+col]=.4;lane.revision++;flow(m);assert.equal(m.phase,'finished');assert.deepEqual(m.results.winnerIds,[0]);assert.equal(m.results.teams[0].score,100);assert(m.remaining>0);
 const saved=structuredClone(m.results);m.tick(1);assert.deepEqual(m.results,saved);
});

test('a route made solely by overlapping actual bucket cuts transports water to the finish',()=>{
 const {m,a}=match(1),w=m.water,lane=w.lanes[0];
 for(let z=w.start+.65;z<=(w.start+(w.rows-1)*w.size)+.001;z+=.4){
   const x=Math.sin((z-w.start)*.4)*.25;
   for(let pass=0;pass<5;pass++){aim(m,a,x,z,waterHeight(m,{x,z})+.02);m.action(a.id,'scoop');if(a.cargo>30)discard(m,a);}
 }
 flow(m);assert.equal(m.phase,'finished');assert.deepEqual(m.results.winnerIds,[0]);assert(a.delivered>40);assert.equal(lane.progress,100);
});

test('equal connected routes tie, empty lanes cannot win, and goal-less timeout is a draw',()=>{
 const {m}=match();for(const lane of m.water.lanes)route(m,lane);flow(m);assert.deepEqual(m.results.winnerIds,[0,1]);assert.equal(m.results.teams[0].time,m.results.teams[1].time);
 const solo=new Match();solo.selectExcavatorMap('waterfall');solo.join('A');solo.start();route(solo,solo.water.lanes[1]);flow(solo,200);assert.equal(solo.water.lanes[1].progress,0);solo.remaining=.01;solo.tick(.05);assert.equal(solo.results.timedOut,true);assert.deepEqual(solo.results.winnerIds,[]);
});

test('sixteen machines spawn safely in every team layout and packed terrain fits the existing network limit',()=>{
 for(let count=1;count<=8;count++){
  const m=new Match();m.configure(count);m.selectExcavatorMap('waterfall');for(let i=0;i<16;i++)m.join(String(i));const players=[...m.players.values()];
  for(const p of players){assert(Math.abs(p.x)<=31&&Math.abs(p.z)<=31);for(const q of players)if(p!==q)assert(Math.hypot(p.x-q.x,p.z-q.z)>=1.5);}
  const state=m.snapshot();assert(JSON.stringify(state).length<65536);assert.equal(decodeSurface(state.water.lanes[0].surface,m.water.rows*m.water.cols).depth.length,m.water.rows*m.water.cols);
 }
});

test('real host selects a map and phone reconnect receives terrain without changing room or identity',async()=>{
  const app=await createServer({port:0,host:'127.0.0.1',manualTick:true});
  const peers=[];
  const connect=async()=>{const ws=new WebSocket(`ws://127.0.0.1:${app.port}`);peers.push(ws);const messages=[];ws.on('message',data=>messages.push(JSON.parse(data)));await new Promise(r=>ws.once('open',r));return {ws,messages,wait:async predicate=>{for(let i=0;i<150;i++){const message=messages.find(predicate);if(message)return message;await new Promise(r=>setTimeout(r,20));}throw Error('state timeout');}};};
  try{
    const cfg=await fetch(`http://127.0.0.1:${app.port}/config`).then(r=>r.json());const host=await connect(),phone=await connect();
    host.ws.send(JSON.stringify({type:'host',key:cfg.adminKey}));await host.wait(m=>m.type==='host-ready');
    phone.ws.send(JSON.stringify({type:'join',room:app.room,name:'폰'}));const joined=await phone.wait(m=>m.type==='joined');
    phone.ws.send(JSON.stringify({type:'excavator-map',map:'waterfall'}));await new Promise(r=>setTimeout(r,60));assert.equal(app.match.excavatorMap.id,'sand');
    host.ws.send(JSON.stringify({type:'excavator-map',map:'waterfall'}));const state=await phone.wait(m=>m.water);assert.equal(state.excavatorMap.id,'waterfall');
    const returned=await connect();returned.ws.send(JSON.stringify({type:'join',room:app.room,token:joined.token}));assert.equal((await returned.wait(m=>m.type==='joined')).id,joined.id);assert.equal((await returned.wait(m=>m.water)).connection.room,app.room);
    assert.equal((await fetch(`http://127.0.0.1:${app.port}/water-view.js`)).status,200);
    assert.equal((await fetch(`http://127.0.0.1:${app.port}/bucket-shape.js`)).status,200);
  }finally{for(const ws of peers)ws.terminate();await app.close();}
});

test('waterfall lanes run parallel from the same map edge to the opposite edge',()=>{
 for(const count of [1,4,8]){
  const {m}=match(count);const w=m.water;assert(w.start<0&&w.start+(w.rows-1)*w.size>0);
  for(const lane of w.lanes){assert.equal(lane.angle,0);assert.equal(lane.z,0);assert.equal(waterHeight(m,{x:lane.x,z:w.start+.4})<0,true);assert(Math.abs(waterHeight(m,{x:lane.x,z:w.start+10}))<.00001);}
  for(let i=1;i<count;i++)assert(Math.abs(w.lanes[i].x-w.lanes[i-1].x-7.8)<.00001);
 }
});

test('tracks in every excavator map drive along the chassis heading, independent of upper rotation',()=>{
 for(const map of EXCAVATOR_MAPS)for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const turret of [0,Math.PI/2,Math.PI])for(const direction of [-1,1]){
  const {m,a}=match(1,map.id);a.x=0;a.z=0;a.yaw=yaw;a.turret=turret;
  m.input(a.id,{travelL:direction,travelR:direction},1000);m.tick(.1,1000);
  const forward=a.x*Math.sin(yaw)+a.z*Math.cos(yaw),side=a.x*Math.cos(yaw)-a.z*Math.sin(yaw);
  assert(forward*direction>0,'both tracks must travel along the chassis front or rear');
  assert(Math.abs(side)<1e-8,'upper rotation must not redirect the tracks');assert.equal(a.yaw,yaw);
 }
});

test('differential steering follows the moving track in every excavator map',()=>{
 for(const map of EXCAVATOR_MAPS)for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const [left,right,turn] of [[1,0,-1],[0,1,1],[-1,0,1],[0,-1,-1],[1,-1,-1],[-1,1,1]]){
  const {m,a}=match(1,map.id);a.x=0;a.z=0;a.yaw=yaw;a.turret=Math.PI/2;
  m.input(a.id,{travelL:left,travelR:right},1000);m.tick(.1,1000);
  assert((a.yaw-yaw)*turn>0,`${map.id}: left and right tracks must turn in the correct direction`);
  if(left+right===0){assert.equal(a.x,0);assert.equal(a.z,0);}
 }
});
