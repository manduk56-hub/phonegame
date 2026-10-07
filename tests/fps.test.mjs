import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {FPS_ARENA,FPS_MOVE_SPEED,fpsBlocked} from '../fps.mjs';
function setup(){const m=new Match();m.selectGame('fps');m.configure(2,30);const a=m.join('A'),b=m.join('B');m.start();Object.assign(a,{x:0,z:5,yaw:Math.PI});Object.assign(b,{x:0,z:-5});return {m,a,b};}
test('twelve rounds trigger a .75 second automatic reload and server rejects extra shots',()=>{
  const {m,a}=setup();a.yaw=Math.PI/2;
  assert.equal(a.ammo,12);
  for(let i=0;i<12;i++){
    if(i)m.tick(.25);
    m.fire(a.id);assert.equal(a.ammo,11-i);
    const sequence=m.fps.sequence;m.fire(a.id);assert.equal(m.fps.sequence,sequence);
  }
  assert.equal(a.reload,.75);assert.equal(m.fps.sequence,12);
  const state=m.snapshot();assert.equal(state.fps.magazineSize,12);assert.equal(state.players.find(p=>p.id===a.id).reload,.75);
  m.tick(.25);m.fire(a.id);assert.equal(m.fps.sequence,12);
  m.tick(.49);m.fire(a.id);assert.equal(a.ammo,0);assert.equal(m.fps.sequence,12);
  m.tick(.01);assert.equal(a.reload,0);assert.equal(a.ammo,12);
  m.fire(a.id);assert.equal(a.ammo,11);assert.equal(m.fps.sequence,13);
});
test('respawn and rematch restore a full magazine without pending reload',()=>{
  const {m,a}=setup();Object.assign(a,{hp:0,respawn:.1,ammo:0,reload:.75});
  m.tick(.1);assert.equal(a.hp,100);assert.equal(a.ammo,12);assert.equal(a.reload,0);
  Object.assign(a,{ammo:0,reload:.75});m.lobby();assert.equal(a.ammo,12);assert.equal(a.reload,0);
  m.start();assert.equal(a.ammo,12);assert.equal(a.reload,0);
});
test('shots follow character facing, ignore aim overrides, stay horizontal, and are rate limited',()=>{
  const {m,a,b}=setup();m.fire(a.id,{yaw:Math.PI,pitch:0});assert.equal(b.hp,66);m.fire(a.id,{yaw:Math.PI,pitch:0});assert.equal(b.hp,66);
  m.tick(.25);a.yaw=Math.PI+.2;m.fire(a.id,{yaw:Math.PI,pitch:0});assert.equal(b.hp,66);
  m.tick(.25);a.yaw=Math.PI;a.pitch=.7;m.fire(a.id,{yaw:0,pitch:.7});assert.equal(b.hp,32);
  assert.equal(a.pitch,0);assert(m.fps.shots.every(s=>s.y===s.ey));
  const c=m.players.get(b.id);assert.equal(c.deaths,0);
});
test('walls and teammates stop bullets; nearest player shields a player behind them',()=>{
  const {m,a,b}=setup();Object.assign(a,{x:9,z:-4,yaw:Math.PI});Object.assign(b,{x:9,z:-14});m.fire(a.id);assert.equal(b.hp,100);
  m.tick(.25);Object.assign(a,{x:0,z:8,yaw:Math.PI});Object.assign(b,{x:0,z:-5});
  m.phase='lobby';const ally=m.join('ally');m.assign(ally.id,a.team);m.phase='running';Object.assign(a,{x:0,z:8,yaw:Math.PI});Object.assign(b,{x:0,z:-5});Object.assign(ally,{x:0,z:4});
  m.fire(a.id);assert.equal(b.hp,100);assert.equal(ally.hp,100);
  ally.team=b.team;m.tick(.25);m.fire(a.id);assert.equal(ally.hp,66);assert.equal(b.hp,100);
});
test('death drops flag and respawns at precisely the death position after two seconds',()=>{
  const {m,a,b}=setup();m.fps.flag.carrier=b.id;const position={x:b.x,z:b.z};
  for(let i=0;i<3;i++){m.fire(a.id,{yaw:Math.PI,pitch:0});if(i<2)m.tick(.25);}
  assert.equal(b.hp,0);assert.equal(b.respawn,2);assert.equal(a.kills,1);assert.equal(b.deaths,1);assert.equal(m.fps.flag.carrier,null);assert.deepEqual({x:m.fps.flag.x,z:m.fps.flag.z},position);
  m.input(b.id,{forward:1,yaw:0},1000);m.tick(1.99,1000);assert.equal(b.hp,0);m.tick(.01,1000);assert.equal(b.hp,100);assert.deepEqual({x:b.x,z:b.z},position);assert.equal(b.input.forward,0);
});
test('flag pickup, capture, disconnect drop, results and rematch reset',()=>{
  const {m,a,b}=setup();Object.assign(a,{x:0,z:0});m.tick(.05);assert.equal(m.fps.flag.carrier,a.id);
  Object.assign(a,{x:m.teams[a.team].x,z:m.teams[a.team].z});m.tick(.05);assert.equal(m.teams[a.team].captures,1);assert.equal(a.captures,1);assert.equal(m.fps.flag.carrier,null);assert.equal(m.fps.flag.x,0);
  Object.assign(b,{x:0,z:0});m.tick(.05);assert.equal(m.fps.flag.carrier,b.id);m.disconnect(b.id);assert.equal(m.fps.flag.carrier,null);
  m.tick(30);assert.equal(m.phase,'finished');assert.deepEqual(m.results.winnerIds,[a.team]);assert.equal(m.results.mode,'fps');m.lobby();assert.equal(m.teams[a.team].captures,0);assert.equal(a.hp,100);assert.equal(a.kills,0);
});
test('flag carrier moves twenty percent slower and normal speed returns after a drop',()=>{
  const {m,a}=setup();Object.assign(a,{x:4,z:4,yaw:0});
  m.input(a.id,{forward:1},1000);m.tick(.05,1000);const normal=a.z-4;
  a.z=4;m.fps.flag.carrier=a.id;m.input(a.id,{forward:1},1000);m.tick(.05,1000);
  assert(Math.abs((a.z-4)/normal-.8)<1e-9);
  m.disconnect(a.id);assert.equal(m.fps.flag.carrier,null);a.connected=true;a.z=4;
  m.input(a.id,{forward:1},1000);m.tick(.05,1000);assert(Math.abs(a.z-4-normal)<1e-9);
});
test('a slain carrier drops at their latest position and a living opponent can recover the flag',()=>{
  const {m,a,b}=setup();m.fps.flag.carrier=b.id;m.fps.flag.x=20;m.fps.flag.z=20;
  for(let i=0;i<3;i++){m.fire(a.id,{yaw:Math.PI,pitch:0});if(i<2)m.tick(.25);}
  assert.equal(m.fps.flag.carrier,null);assert.equal(m.fps.flag.x,b.x);assert.equal(m.fps.flag.z,b.z);
  Object.assign(a,{x:b.x,z:b.z});m.tick(.05);assert.equal(b.hp,0);assert.equal(m.fps.flag.carrier,a.id);
});
test('walking stops at cover and stale input; game switching preserves identities with clean FPS state',()=>{
  const {m,a}=setup();Object.assign(a,{x:9,z:-2,yaw:Math.PI});let now=1000;
  for(let i=0;i<40;i++){m.input(a.id,{forward:1,yaw:Math.PI,pitch:0},now);m.tick(.05,now);now+=50;assert.equal(fpsBlocked(a.x,a.z),false);}
  assert(a.z>=-2.61);const z=a.z;m.tick(.1,now+1000);assert.equal(a.z,z);
  const id=a.id,token=a.token;m.lobby();for(const game of ['racing','excavator','fps'])m.selectGame(game);assert.equal(a.id,id);assert.equal(a.token,token);assert.equal(a.hp,100);assert.equal(a.pitch,0);assert.equal(m.snapshot().fps.arena.eye,1.55);assert.throws(()=>m.configure(1),/2팀/);
});
test('the visible pickup radius is authoritative, includes its boundary, and cannot reach through a wall',()=>{
  const {m,a}=setup();assert.equal(m.snapshot().fps.flag.pickupRadius,2.5);
  Object.assign(a,{x:2.51,z:0});m.tick(.05);assert.equal(m.fps.flag.carrier,null);
  a.x=2.5;m.tick(.05);assert.equal(m.fps.flag.carrier,a.id);
  m.fps.flag.carrier=null;Object.assign(m.fps.flag,{x:7.5,z:-4});Object.assign(a,{x:9,z:-2.5});
  m.tick(.05);assert.equal(m.fps.flag.carrier,null);
  Object.assign(a,{x:7.5,z:-2});m.tick(.05);assert.equal(m.fps.flag.carrier,a.id);
});

test('expanded FPS boundary and sixteen-player team spawns agree with rendered arena',()=>{
  for(const count of [2,4,8]){const m=new Match();m.selectGame('fps');m.configure(count);for(let i=0;i<16;i++)m.join('spawn '+i);m.start();for(const p of m.players.values()){assert(!fpsBlocked(p.x,p.z));assert(Math.abs(p.x)<FPS_ARENA.limit&&Math.abs(p.z)<FPS_ARENA.limit);}}
  const {m,a}=setup();Object.assign(a,{x:40,z:0,yaw:Math.PI/2});
  for(let i=0;i<30;i++){m.input(a.id,{forward:1},1000+i*50);m.tick(.05,1000+i*50);assert(!fpsBlocked(a.x,a.z));}
  assert(a.x>40);assert(a.x<=FPS_ARENA.limit-.4);assert(FPS_MOVE_SPEED<10);
});
