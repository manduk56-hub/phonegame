import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {raceBody,bodyContact} from '../collision.mjs';
function setup(n=2){const m=new Match();m.selectGame('racing');m.selectTrack('bumper-arena');const players=Array.from({length:n},(_,i)=>m.join('범퍼'+i));m.start();m.countdown=0;return {m,players};}
test('arena exposes a separate racing mode, sixteen safe spawns and existing controls',()=>{
  const {m,players}=setup(16);assert.equal(m.snapshot().race.mode,'bumper');
  for(const p of players){assert(Math.hypot(p.x,p.z)<m.circuit.radius-4);assert.equal(p.eliminatedAt,null);}
  for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)assert.equal(bodyContact(raceBody(players[a]),raceBody(players[b])),null);
  assert.throws(()=>m.selectTrack('stadium'));m.lobby();m.selectTrack(m.snapshot().race.tracks[0].id);assert.equal(m.snapshot().race.mode,'race');
});
test('head-on collision transfers a shove to the other car and carries it sideways',()=>{
  const {m,players:[p,q]}=setup();Object.assign(p,{x:-2,z:0,yaw:Math.PI/2,speed:22});Object.assign(q,{x:1,z:0,yaw:0,speed:0});
  m.input(p.id,{throttle:1},1000);m.input(q.id,{},1000);m.tick(.05,1000);
  assert(q.pushX>5);const x=q.x;for(let i=0;i<5;i++)m.tick(.05,1050+i*50);assert(q.x>x+1);
});
test('edge eliminates immediately; impact happens at the floor, then final results and reset',()=>{
  const {m,players:[p,q]}=setup();p.x=43;p.z=0;m.tick(.05,1000);
  assert(p.falling);assert.equal(p.eliminatedAt,.05);assert.equal(p.landedAt,null);assert.equal(m.phase,'running');
  const token=p.token;m.disconnect(p.id);assert.equal(m.join('',token).eliminatedAt,.05);
  for(let i=0;i<15;i++)m.tick(.05,1100+i*50);assert(p.y<0&&p.y>m.circuit.floorY);assert.equal(p.landedAt,null);
  for(let i=0;i<20&&p.landedAt===null;i++)m.tick(.05,2000+i*50);
  assert.equal(p.y,m.circuit.floorY);assert(p.landedAt>p.eliminatedAt);assert.equal(m.phase,'running');
  for(let i=0;i<35;i++)m.tick(.05,3000+i*50);
  assert.equal(m.phase,'finished');assert.deepEqual(m.results.winnerIds,[q.id]);assert.equal(m.results.players[1].rank,2);
  m.lobby();assert.equal(p.y,0);assert.equal(p.eliminatedAt,null);assert.equal(p.landedAt,null);assert.equal(p.pushX,0);
  p.landedAt=1;p.y=-18;m.selectTrack(m.snapshot().race.tracks[0].id);assert.equal(p.landedAt,null);assert.equal(p.y,0);
});
test('simultaneous falls and time-limit survivors share ranks; solo can practise until falling',()=>{
  const {m,players}=setup();for(const p of players){p.x=45;p.z=0;}m.tick(.05,1000);for(let i=0;i<80;i++)m.tick(.05,1100+i*50);
  assert.equal(m.phase,'finished');assert.equal(m.results.winnerIds.length,2);assert(m.results.players.every(p=>p.rank===1));
  const timed=setup();timed.m.remaining=.01;timed.m.tick(.05,1000);assert.equal(timed.m.results.winnerIds.length,2);
  const solo=setup(1);solo.m.tick(.05,1000);assert.equal(solo.m.phase,'running');
});
