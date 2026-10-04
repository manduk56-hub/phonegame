import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {CARS,CIRCUIT,nearestTrack} from '../racing.mjs';
import {screenTilt} from '../public/race-sensors.js';
const setup=()=>{const m=new Match();m.selectGame('racing');return m;};
function pilot(m,p,now){const track=nearestTrack(p.x,p.z),target=CIRCUIT.points[(track.index+8)%CIRCUIT.points.length],yaw=Math.atan2(target.x-p.x,target.z-p.z),error=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));m.input(p.id,{steer:Math.max(-1,Math.min(1,-error*1.7)),throttle:p.speed<18?1:0,brake:p.speed>21?1:0},now);}
test('16 drivers may select the same model and receive distinct colors; reconnect retains the chosen car',()=>{
  const m=setup(),players=Array.from({length:16},(_,i)=>m.join('driver'+i));
  for(const p of players)m.chooseCar(p.id,'classic');
  assert.equal(new Set(players.map(p=>p.color)).size,16);
  assert.equal(new Set(players.map(p=>`${p.x},${p.z}`)).size,16);
  const p=players[0];m.disconnect(p.id);assert.equal(m.join('',p.token),p);assert.equal(p.car,'classic');
  assert.throws(()=>m.chooseCar(p.id,'unknown'));m.start();assert.throws(()=>m.chooseCar(p.id,'gt'));assert.throws(()=>m.selectGame('excavator'));
  const snapshot=m.snapshot();assert(!snapshot.players.some(p=>p.token||p.input));assert.equal(snapshot.race.laps,3);assert.equal(snapshot.race.collisions,true);
});
test('countdown blocks movement, right steering turns right, brakes and expired input decelerate',()=>{
  const m=setup(),p=m.join('driver');m.start();let now=1000;
  m.input(p.id,{throttle:1,steer:1,brake:-1},now);assert.equal(p.input.brake,0);
  const before={x:p.x,z:p.z};m.tick(.1,now);assert.equal(p.x,before.x);assert.equal(p.z,before.z);
  m.countdown=0;const yaw=p.yaw;
  for(let i=0;i<15;i++){m.input(p.id,{throttle:1,steer:1},now);m.tick(.05,now);now+=50;}
  assert(p.speed>0);assert(p.yaw<yaw);const speed=p.speed;
  m.input(p.id,{brake:1},now);m.tick(.1,now);assert(p.speed<speed);
  const slow=p.speed;m.tick(.1,now+1000);assert(p.speed<slow);
});
test('every model has equal acceleration and handling for identical starting conditions',()=>{
  const trajectories=CARS.map(car=>{const m=setup(),p=m.join('driver');m.chooseCar(p.id,car.id);m.start();m.countdown=0;let now=1000;for(let step=0;step<120;step++){pilot(m,p,now);m.tick(.05,now);now+=50;}return [p.x,p.z,p.yaw,p.speed];});
  for(const trajectory of trajectories)assert.deepEqual(trajectory,trajectories[0]);
});
test('car collisions separate vehicles, dampen speed and leave finite positions',()=>{
  const m=setup(),p=m.join('one'),q=m.join('two');m.start();m.countdown=0;
  q.x=p.x;q.z=p.z;p.speed=q.speed=10;m.input(p.id,{throttle:1},1000);m.input(q.id,{throttle:1},1000);m.tick(.05,1000);
  assert(Math.hypot(p.x-q.x,p.z-q.z)>=2.09);assert(p.speed<10);assert(Number.isFinite(q.x));
});
test('ordered circuit gates prevent finish-line rocking; three actual laps finish and restart resets progress',()=>{
  const m=setup(),p=m.join('driver');m.chooseCar(p.id,'muscle');m.configure(1,300);m.start();m.countdown=0;
  const point=CIRCUIT.points[0];p.x=point.x;p.z=point.z;
  let now=1000;for(let step=0;step<50;step++){m.input(p.id,{},now);m.tick(.05,now);now+=50;}
  assert.equal(p.lap,0);assert.equal(p.checkpoint,1);
  for(let step=0;step<6000&&m.phase==='running';step++){pilot(m,p,now);m.tick(.05,now);now+=50;}
  assert.equal(m.phase,'finished');assert.equal(p.lap,3);assert(p.finishedAt>30&&p.finishedAt<120);assert.deepEqual(m.results.winnerIds,[p.id]);assert.equal(m.results.players[0].rank,1);
  m.lobby();assert.equal(p.lap,0);assert.equal(p.car,'muscle');assert.equal(p.finishedAt,null);
});
test('temporary disconnection does not finish a race and returning identity preserves progress',()=>{
  const m=setup(),p=m.join('driver');m.start();m.countdown=0;p.lap=1;p.checkpoint=4;m.disconnect(p.id);m.tick(.1,1000);assert.equal(m.phase,'running');m.join('',p.token);assert.equal(p.lap,1);assert.equal(p.checkpoint,4);
});
test('off-road slowdown is gentle and a continuous wall contact does not repeatedly remove impact speed',()=>{
  const m=setup(),p=m.join('driver');m.start();m.countdown=0;const a=CIRCUIT.points[0],t=nearestTrack(a.x,a.z);
  p.x=a.x+Math.cos(t.yaw)*7;p.z=a.z-Math.sin(t.yaw)*7;p.yaw=t.yaw;p.speed=20;
  m.input(p.id,{},1000);m.tick(.1,1000);assert(p.offroad);assert(p.speed>19);
  p.x=a.x+Math.cos(t.yaw)*8.5;p.z=a.z-Math.sin(t.yaw)*8.5;p.yaw=t.yaw+Math.PI/2;p.speed=20;
  m.input(p.id,{},1100);m.tick(.05,1100);const afterImpact=p.speed;
  for(let step=0;step<5;step++){m.input(p.id,{},1150+step*50);m.tick(.05,1150+step*50);}assert(p.speed>afterImpact-2);
  assert.equal(m.snapshot().race.steeringRange,50);
});
test('both landscape orientations yield consistent screen-right roll; flat or invalid samples are ignored',()=>{
  assert(Math.abs(screenTilt(20,90,90)-20)<1e-8);assert(Math.abs(screenTilt(-20,-90,270)-20)<1e-8);
  assert(Math.abs(screenTilt(-20,90,90)+20)<1e-8);assert.equal(screenTilt(0,0,90),null);assert.equal(screenTilt(null,90,90),null);
});
