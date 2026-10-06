import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {FISHING,BOAT_PERIMETER,fishingSeat,SPECIES} from '../fishing.mjs';
import {landscapeFrame,createHookDetector,reelDelta} from '../public/fishing-controls.js';
const round=(n=1)=>{const m=new Match();m.selectGame('fishing');const players=Array.from({length:n},(_,i)=>m.join('낚시꾼'+i));m.start();return {m,p:players[0],players};};
const advance=(m,seconds,control)=>{for(let i=0;i<Math.ceil(seconds/.05);i++){control?.();m.tick(.05,1000);}};
function bite(m,p){m.action(p.id,'cast');advance(m,.7);p.fishing.timer=.01;m.tick(.05,1000);assert.equal(p.fishing.stage,'bite');}
test('16 anglers are evenly placed on one boat; only connected players fish, identities survive game changes',()=>{
 const {m,players}=round(16);assert.equal(new Set(players.map(p=>p.color)).size,16);
 for(let i=0;i<16;i++){const p=players[i],seat=fishingSeat(i,16);assert.equal(p.x,seat.x);assert.equal(p.z,seat.z);assert(Math.abs(p.seatDistance-i/16*BOAT_PERIMETER)<1e-8);assert(Math.abs(p.yaw-Math.atan2(p.x,p.z))<1e-8);for(const q of players)if(p!==q)assert(Math.hypot(p.x-q.x,p.z-q.z)>1.5);}
 m.lobby();m.disconnect(players[3].id);m.start();const active=players.filter(p=>p.participating);assert.equal(active.length,15);active.forEach((p,i)=>assert.equal(p.seatDistance,fishingSeat(i,15).seatDistance));
 m.lobby();const token=players[0].token;m.selectGame('bull');m.selectGame('fishing');assert.equal(m.join('reuse',token).id,players[0].id);
});
test('cast has travel time; only the large bite can be hooked; misses and early strikes release',()=>{
 const {m,p}=round();m.action(p.id,'hook');assert.equal(p.fishing.stage,'ready');m.action(p.id,'cast');assert.equal(p.fishing.stage,'casting');advance(m,.7);assert.equal(p.fishing.stage,'waiting');m.action(p.id,'hook');assert.equal(p.fishing.stage,'cooldown');advance(m,1.3);bite(m,p);assert(p.fishing.timer>0);advance(m,2);assert.equal(p.fishing.stage,'cooldown');advance(m,1.3);bite(m,p);m.action(p.id,'hook');assert.equal(p.fishing.stage,'fighting');
});
test('following runs and clockwise reeling lands one fish; wrong direction breaks the line',()=>{
 const {m,p}=round();bite(m,p);m.action(p.id,'hook');advance(m,16,()=>m.input(p.id,{tilt:p.fishing.direction,reel:1},1000));assert.equal(p.caught,1);assert(['cooldown','ready'].includes(p.fishing.stage));advance(m,2);bite(m,p);m.action(p.id,'hook');advance(m,5,()=>m.input(p.id,{tilt:-p.fishing.direction,reel:1},1000));assert.equal(p.caught,1);assert.notEqual(p.fishing.stage,'fighting');
});
test('negative reel, stale/disconnected input cannot wind; duplicate hook and cast cannot reset a fight',()=>{
 const {m,p}=round();bite(m,p);m.action(p.id,'hook');p.fishing.turnTimer=50;m.input(p.id,{tilt:p.fishing.direction,reel:-1},1000);const d=p.fishing.distance;m.tick(.1,1000);assert.equal(p.fishing.distance,d);m.action(p.id,'cast');m.action(p.id,'hook');assert.equal(p.fishing.stage,'fighting');m.input(p.id,{tilt:p.fishing.direction,reel:1},1000);m.tick(.1,2000);assert(p.fishing.distance>=d);m.disconnect(p.id);m.tick(.1,1000);assert(p.fishing.distance>=d);assert.equal(m.snapshot().players[0].token,undefined);
});
test('individual count determines rank and tied winners; zero catches is a draw and round resets scores',()=>{
 const {m,players}=round(3);players[0].caught=3;players[1].caught=3;players[2].caught=1;m.remaining=.01;m.tick(.1,1000);assert.equal(m.phase,'finished');assert.deepEqual(m.results.players.map(p=>p.rank),[1,1,3]);assert.deepEqual(m.results.winnerIds,players.slice(0,2).map(p=>p.id));m.action(players[2].id,'cast');assert.equal(players[2].fishing.stage,'ready');m.lobby();m.start();assert(players.every(p=>p.caught===0));m.remaining=.01;m.tick(.1,1000);assert.deepEqual(m.results.winnerIds,[]);
});
test('screen roll and inward top pitch agree in both landscape orientations; slow movement and outward flicks do not hook',()=>{
 for(const r of [90,-90]){const a=landscapeFrame(0,0,r),inward=landscapeFrame(0,r===90?10:-10,r);assert(Math.abs(a.roll)<1e-8);assert(inward.pitch>9);const d=createHookDetector();assert.equal(d.sample(a,1000),false);assert.equal(d.sample(inward,1030),true);assert.equal(d.sample(landscapeFrame(0,r===90?20:-20,r),1060),false);d.reset();d.sample(inward,2000);assert.equal(d.sample(a,2030),false);d.reset();d.sample(a,3000);assert.equal(d.sample(inward,3200),false);}
 assert.equal(landscapeFrame(null,0,90),null);
});
test('circular reel only counts clockwise arcs, wraps correctly, and rejects pointer jumps',()=>{assert(reelDelta(3.1,-3.1)>0);assert.equal(reelDelta(0,-.3),0);assert.equal(reelDelta(0,2),0);assert(reelDelta(0,.3)>0);});
test('left/right fish runs follow PC screen X for all 16 fishing positions',()=>{
 const {m,players}=round(16);players.forEach(p=>m.action(p.id,'cast'));advance(m,.7);players.forEach(p=>p.fishing.timer=.01);m.tick(.05,1000);for(const p of players){m.action(p.id,'hook');p.fishing.direction=1;p.fishing.turnTimer=99;p.fishing.offset=0;}
 m.tick(.05,1000);const xs=players.map(p=>p.fishing.fishX);m.tick(.05,1000);players.forEach((p,i)=>assert(p.fishing.fishX>xs[i]));
 players.forEach(p=>p.fishing.direction=-1);const next=players.map(p=>p.fishing.fishX);m.tick(.05,1000);players.forEach((p,i)=>assert(p.fishing.fishX<next[i]));
});
test('all eight reference fish may be caught and species collections reset without changing count-based victory',()=>{
 const {m,p}=round();assert.equal(SPECIES.length,8);for(const species of SPECIES){advance(m,1.3);bite(m,p);p.fishing.species=species.id;m.action(p.id,'hook');p.fishing.distance=1.01;p.fishing.energy=.01;m.input(p.id,{tilt:p.fishing.direction,reel:1},1000);m.tick(.05,1000);assert.equal(p.collection[species.id],1);assert.equal(p.fishing.lastCatch,species.id);}
 assert.equal(p.caught,8);m.remaining=.01;m.tick(.05,1000);assert.equal(m.results.players[0].score,8);assert(Object.values(m.results.players[0].collection).every(n=>n===1));m.lobby();m.start();assert(Object.values(p.collection).every(n=>n===0));
});
