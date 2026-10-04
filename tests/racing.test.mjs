import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {CARS,CIRCUIT,CIRCUITS,nearestTrack} from '../racing.mjs';
import {screenTilt} from '../public/race-sensors.js';
const setup=()=>{const m=new Match();m.selectGame('racing');return m;};
function pilot(m,p,now){const circuit=m.circuit,track=nearestTrack(p.x,p.z,circuit),target=circuit.points[(track.index+8)%circuit.points.length],yaw=Math.atan2(target.x-p.x,target.z-p.z),error=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));m.input(p.id,{steer:Math.max(-1,Math.min(1,-error*1.7)),throttle:p.speed<18?1:0,brake:p.speed>21?1:0},now);}
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
  assert.equal(p.lap,0);assert.equal(p.checkpoint,0);
  for(let step=0;step<6000&&m.phase==='running';step++){pilot(m,p,now);m.tick(.05,now);now+=50;}
  assert.equal(m.phase,'finished');assert.equal(p.lap,3);assert(p.finishedAt>CIRCUIT.length*3/42&&p.finishedAt<300);assert.deepEqual(m.results.winnerIds,[p.id]);assert.equal(m.results.players[0].rank,1);
  m.lobby();assert.equal(p.lap,0);assert.equal(p.car,'muscle');assert.equal(p.finishedAt,null);
});
test('temporary disconnection does not finish a race and returning identity preserves progress',()=>{
  const m=setup(),p=m.join('driver');m.start();m.countdown=0;p.lap=1;p.checkpoint=4;m.disconnect(p.id);m.tick(.1,1000);assert.equal(m.phase,'running');m.join('',p.token);assert.equal(p.lap,1);assert.equal(p.checkpoint,4);
});
test('off-road slowdown is gentle while a head-on wall hit stops forward motion',()=>{
  const m=setup(),p=m.join('driver');m.start();m.countdown=0;const a=CIRCUIT.points[0],t=nearestTrack(a.x,a.z);
  p.x=a.x+Math.cos(t.yaw)*7;p.z=a.z-Math.sin(t.yaw)*7;p.yaw=t.yaw;p.speed=20;
  m.input(p.id,{},1000);m.tick(.1,1000);assert(p.offroad);assert(p.speed>19);
  p.x=a.x+Math.cos(t.yaw)*8.5;p.z=a.z-Math.sin(t.yaw)*8.5;p.yaw=t.yaw+Math.PI/2;p.speed=20;
  m.input(p.id,{},1100);m.tick(.05,1100);assert(p.speed<1);
  assert.equal(m.snapshot().race.steeringRange,50);
});
function straightDrive(){
  const m=setup(),p=m.join('driver');m.start();m.countdown=0;
  m.circuit={...m.circuit,width:12,points:[{x:0,z:0},{x:0,z:1000},{x:1000,z:1000},{x:1000,z:0}]};
  p.x=0;p.z=100;p.yaw=0;let now=1000;
  const step=(input={},count=1)=>{for(let j=0;j<count;j++){m.input(p.id,input,now);m.tick(.05,now);now+=50;}};
  return {m,p,step};
}
test('engine builds acceleration progressively and braking slows more strongly than lift-off',()=>{
  const s=straightDrive();s.step({throttle:1});const first=s.p.speed;s.step({throttle:1});assert(s.p.speed-first>first);
  s.step({throttle:1},60);assert(s.p.speed>10);
  const slow=straightDrive(),fast=straightDrive();slow.p.speed=5;fast.p.speed=30;slow.p.driveThrottle=fast.p.driveThrottle=1;
  slow.step({throttle:1});fast.step({throttle:1});assert(slow.p.speed-5>fast.p.speed-30);
  const coast=straightDrive(),brake=straightDrive();coast.p.speed=brake.p.speed=20;
  coast.step({},10);brake.step({brake:1},10);assert(coast.p.speed<20&&coast.p.speed>15);assert(brake.p.speed<coast.p.speed-8);
});
test('brake stops before delayed reverse; accelerator stops reverse before forward; both pedals prioritize stopping',()=>{
  const s=straightDrive();s.p.speed=2;s.step({brake:1},2);assert.equal(s.p.speed,0);
  s.step({brake:1},6);assert.equal(s.p.speed,0);s.step({brake:1},2);assert(s.p.speed<0);
  const z=s.p.z;s.step({brake:1},60);assert(s.p.z<z);assert(s.p.speed>=-8&&s.p.speed<-5);
  s.step({brake:1,throttle:1},10);assert.equal(s.p.speed,0);
  s.step({brake:1},10);assert(s.p.speed<0);s.step({throttle:1},30);assert(s.p.speed>0);
  s.p.speed=-5;s.m.disconnect(s.p.id);s.step({},20);assert.equal(s.p.speed,0);
});
test('wall scraping continuously dissipates speed and reverse escapes a head-on wall',()=>{
  const scrape=straightDrive(),free=straightDrive();scrape.p.x=7.96;scrape.p.speed=free.p.speed=20;
  scrape.step({},10);free.step({},10);assert(scrape.p.wallContact);assert(scrape.p.speed<free.p.speed-4);
  const s=straightDrive();s.p.x=7.99;s.p.yaw=Math.PI/2;s.p.speed=20;
  s.step({throttle:1},10);assert.equal(s.p.speed,0);assert(s.p.x<=8.000001);
  s.step({brake:1},35);assert(s.p.speed<0);assert(s.p.x<7);assert.equal(s.p.wallContact,false);
  s.p.x=0;s.p.z=.05;s.p.yaw=0;s.p.speed=-2;s.p.checkpoint=0;s.step({brake:1});assert.equal(s.p.checkpoint,0);assert.equal(s.p.lap,0);
});
test('both landscape orientations yield consistent screen-right roll; flat or invalid samples are ignored',()=>{
  assert(Math.abs(screenTilt(20,90,90)-20)<1e-8);assert(Math.abs(screenTilt(-20,-90,270)-20)<1e-8);
  assert(Math.abs(screenTilt(-20,90,90)+20)<1e-8);assert.equal(screenTilt(0,0,90),null);assert.equal(screenTilt(null,90,90),null);
});

test('every large circuit supports sixteen separated grid slots, full laps and selected-track reset',()=>{
  const m=setup();const players=Array.from({length:16},(_,i)=>m.join('driver'+i));
  assert.throws(()=>m.selectTrack('unknown'));
  for(const circuit of CIRCUITS){
    m.selectTrack(circuit.id);assert.equal(m.snapshot().circuit.id,circuit.id);assert(circuit.length>1000);
    for(const p of players){assert(nearestTrack(p.x,p.z,circuit).distance<circuit.width/2);assert.equal(p.lap,0);}
    for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)assert(Math.hypot(players[i].x-players[j].x,players[i].z-players[j].z)>2.1);
    const p=players[0];for(const q of players.slice(1))m.remove(q.id);
    m.configure(1,900);m.start();m.countdown=0;assert.throws(()=>m.selectTrack(CIRCUITS[0].id));
    let now=1000;for(let step=0;step<18000&&m.phase==='running';step++){pilot(m,p,now);m.tick(.05,now);now+=50;}
    assert.equal(p.lap,3,circuit.id+' lap completion');assert(p.finishedAt>circuit.length*3/42);assert.equal(m.results.players[0].time,p.finishedAt);
    m.lobby();assert.equal(m.circuit.id,circuit.id);assert.equal(p.checkpoint,0);
    players.splice(1);while(players.length<16)players.push(m.join('driver'+players.length));
  }
  const other=setup();assert.equal(other.circuit.id,CIRCUITS[0].id);m.selectGame('excavator');assert.throws(()=>m.selectTrack(CIRCUITS[1].id));
});
