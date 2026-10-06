import test from 'node:test';
import assert from 'node:assert/strict';
import {updateRaceDirector} from '../race-director.mjs';
import {Match} from '../simulation.mjs';
const player=(id,rank,speed=0)=>({id,rank,speed,connected:true,finishedAt:null,wallContact:false});
function setup(){const a=player('a',1),b=player('b',2),c=player('c',3);return {raceElapsed:0,players:new Map([a,b,c].map(p=>[p.id,p]))};}
function step(m,seconds){for(let i=0;i<seconds*10;i++){m.raceElapsed+=.1;updateRaceDirector(m,.1);}}
test('broadcast holds four seconds, prioritizes overtaking, and rotates after eight seconds',()=>{
  const m=setup();updateRaceDirector(m,.1);assert.equal(m.raceDirector.id,'a');
  m.players.get('b').rank=1;m.players.get('a').rank=2;step(m,1);assert.equal(m.raceDirector.id,'a');
  step(m,3.2);assert.equal(m.raceDirector.id,'b');assert.equal(m.raceDirector.reason,'추월!');
  step(m,8.2);assert.equal(m.raceDirector.id,'c');assert.equal(m.raceDirector.reason,'순환 중계');
});
test('highest speed and prolonged wall stops trigger focus; stopped cars do not win speed focus',()=>{
  const m=setup();m.players.get('c').speed=25;updateRaceDirector(m,.1);assert.equal(m.raceDirector.id,'c');assert.equal(m.raceDirector.reason,'최고 속도');
  m.players.get('b').wallContact=true;step(m,4.2);assert.equal(m.raceDirector.id,'b');assert.equal(m.raceDirector.reason,'벽 충돌 · 탈출 중');
  m.players.get('b').connected=false;step(m,.1);assert.notEqual(m.raceDirector.id,'b');
  for(const p of m.players.values())p.connected=false;step(m,.1);assert.equal(m.raceDirector.id,null);
});
test('finished drivers are excluded and a new round clears director history',()=>{
  const m=setup();updateRaceDirector(m,.1);m.players.get('a').finishedAt=12;step(m,.1);assert.equal(m.raceDirector.id,'b');
  step(m,5);m.raceElapsed=0;updateRaceDirector(m,.1);assert.equal(m.raceDirector.elapsed,0);assert.equal(m.raceDirector.since,0);
  const match=new Match();match.selectGame('racing');match.join('driver');match.raceDirector={id:'old'};match.start();assert.equal(match.raceDirector,null);assert.equal(match.snapshot().race.broadcast,null);
});
