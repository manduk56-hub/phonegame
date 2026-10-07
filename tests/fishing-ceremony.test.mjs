import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {catchPose,CATCH_DURATION,ceremonyPose} from '../public/fishing-effects.js';
const round=n=>{const m=new Match();m.selectGame('fishing');const players=Array.from({length:n},(_,i)=>m.join('낚시꾼'+i));m.start();return {m,players};};
const finish=m=>{m.remaining=.01;m.tick(.05,1000);assert.equal(m.phase,'finished');};
test('simultaneous catches produce unique throws from each hand into the open chest; late viewers see landed fish',()=>{
 const {m,players}=round(16);
 for(const p of players){Object.assign(p.fishing,{stage:'fighting',distance:.9,energy:.01,direction:1,turnTimer:99});m.input(p.id,{tilt:1,reel:1},1000);}
 m.tick(.05,1000);const events=m.fishing.catches;assert.equal(events.length,16);assert.equal(new Set(events.map(e=>e.id)).size,16);
 for(const e of events){const p=players.find(p=>p.id===e.playerId);assert.equal(p.caught,1);assert.equal(e.species,p.fishing.lastCatch);
  const start=catchPose(e,e.at),mid=catchPose(e,e.at+.7),end=catchPose(e,e.at+CATCH_DURATION),late=catchPose(e,e.at+20);
  assert.deepEqual(start.position,e.from);assert(mid.position[1]>start.position[1]+1);assert(!mid.landed);assert(end.landed);assert.deepEqual(end.position,late.position);
  assert(Math.abs(end.position[0])<1.45&&Math.abs(end.position[2])<1.1&&end.position[1]>1.15&&end.position[1]<1.6);
 }
 const snapshot=m.snapshot();assert.equal(snapshot.fishing.catches.length,16);m.tick(.5,1000);assert.equal(events.length,16);
 m.lobby();assert.deepEqual(m.fishing.catches,[]);assert.equal(m.fishing.ceremony,null);m.start();assert.deepEqual(m.fishing.catches,[]);
});
test('only winners can cast, hook then reel the result camera; negative, stale and disconnected input stops it and scores stay fixed',()=>{
 const {m,players:[winner,loser]}=round(2);winner.caught=4;finish(m);const results=JSON.stringify(m.results),c=m.fishing.ceremony;
 assert.equal(c.distance,34);m.action(loser.id,'cast');assert.equal(c.stage,'ready');m.action(winner.id,'hook');assert.equal(c.stage,'ready');
 m.input(winner.id,{reel:1},1000);m.tick(.1,1000);assert.equal(c.distance,34);
 m.action(winner.id,'cast');m.action(winner.id,'hook');assert.equal(c.stage,'casting');m.tick(.7,1000);assert.equal(c.stage,'bite');
 m.action(loser.id,'hook');assert.equal(c.stage,'bite');m.action(winner.id,'hook');assert.equal(c.stage,'reeling');
 m.input(winner.id,{reel:-1},1000);m.tick(.1,1000);assert.equal(c.distance,34);m.input(winner.id,{reel:1},1000);m.tick(.1,2000);assert.equal(c.distance,34);
 m.tick(.1,1000);assert(c.distance<34);const before=c.distance;m.disconnect(winner.id);m.tick(.3,1000);assert.equal(c.distance,before);
 m.join('return',winner.token);for(let i=0;i<70;i++){m.input(winner.id,{reel:1},1000);m.tick(.1,1000);}assert.equal(c.stage,'close');assert.equal(c.distance,1.8);
 const pose=ceremonyPose(winner,c);assert(Math.hypot(pose.eye[0]-winner.x,pose.eye[2]-winner.z)<2);assert.equal(pose.target[1],winner.y+2.22);
 assert.equal(JSON.stringify(m.results),results);assert.equal(winner.caught,4);m.action(winner.id,'cast');assert.equal(c.distance,34);assert.equal(c.stage,'casting');
});
test('tied winners take turns, can recover a disconnected owner, and draws have no ceremony',()=>{
 const {m,players:[a,b]}=round(2);a.caught=b.caught=2;finish(m);m.action(a.id,'cast');m.action(b.id,'cast');assert.equal(m.fishing.ceremony.id,a.id);
 m.disconnect(a.id);m.action(b.id,'cast');assert.equal(m.fishing.ceremony.id,b.id);m.tick(.7,1000);m.action(b.id,'hook');
 for(let i=0;i<60;i++){m.input(b.id,{reel:1},1000);m.tick(.1,1000);}assert.equal(m.fishing.ceremony.stage,'close');
 m.join('return',a.token);m.action(a.id,'cast');assert.equal(m.fishing.ceremony.id,a.id);
 m.lobby();m.start();finish(m);assert.equal(m.fishing.ceremony,null);m.action(a.id,'cast');assert.equal(m.fishing.ceremony,null);
});
test('a catch on the final tick still finishes its flight after results appear',()=>{
 const {m,players:[p]}=round(1);Object.assign(p.fishing,{stage:'fighting',distance:.9,energy:.01,direction:1,turnTimer:99});m.input(p.id,{tilt:1,reel:1},1000);finish(m);
 const event=m.fishing.catches[0];assert(event);assert(!catchPose(event,m.fishing.elapsed).landed);m.tick(1,1000);m.tick(.3,1000);assert(catchPose(event,m.fishing.elapsed).landed);assert.equal(m.results.players[0].score,1);
});
