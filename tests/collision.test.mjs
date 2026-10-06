import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {CARS,CIRCUITS} from '../racing.mjs';
import {EXCAVATOR_MAPS} from '../waterway.mjs';
import {raceBody,bodyContact,excavatorOverlap} from '../collision.mjs';

function racePair(){
  const m=new Match();m.selectGame('racing');const p=m.join('A'),q=m.join('B');m.start();m.countdown=0;
  m.circuit={...m.circuit,width:30,points:[{x:0,z:0},{x:0,z:1000},{x:1000,z:1000},{x:1000,z:0}]};
  Object.assign(p,{x:0,z:100,yaw:0});Object.assign(q,{x:0,z:104,yaw:0});return {m,p,q};
}
test('every racing model collides at its front/rear beyond the old centre radius',()=>{
  for(const car of CARS){
    const {m,p,q}=racePair();p.car=q.car=car.id;
    assert(bodyContact(raceBody(p),raceBody(q)),car.id);
    m.tick(0,1000);
    assert.equal(bodyContact(raceBody(p),raceBody(q)),null,car.id);
  }
});
test('racing collisions include the side, rotated corners and coincident centres',()=>{
  for(const [x,z,yaw] of [[2.3,100,0],[2.8,101,Math.PI/4],[0,100,Math.PI/2]]){
    const {m,p,q}=racePair();Object.assign(q,{x,z,yaw});
    assert(bodyContact(raceBody(p),raceBody(q)));m.tick(0,1000);
    assert.equal(bodyContact(raceBody(p),raceBody(q)),null);
    assert(Number.isFinite(p.x)&&Number.isFinite(q.z));
  }
});
test('separate parallel cars remain clear and the collisions-off option preserves overlap',()=>{
  const {m,p,q}=racePair();q.x=2.5;q.z=100;
  assert.equal(bodyContact(raceBody(p),raceBody(q)),null);m.tick(0,1000);assert.equal(p.x,0);assert.equal(q.x,2.5);
  q.x=0;q.z=104;m.raceCollisions=false;m.tick(0,1000);assert.equal(p.z,100);assert.equal(q.z,104);
});
test('excavator front/rear and side stop before the whole chassis overlaps',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI/4]){
    const m=new Match(),p=m.join('A'),q=m.join('B');m.start();
    Object.assign(p,{x:0,z:0,yaw});Object.assign(q,{x:Math.sin(yaw)*2.55,z:Math.cos(yaw)*2.55,yaw});
    for(let i=0;i<8;i++){m.input(p.id,{travelL:1,travelR:1},1000+i*100);m.tick(.1,1000+i*100);}
    assert.equal(excavatorOverlap(p,q),0);assert(Math.hypot(p.x,p.z)<.34);
    m.input(p.id,{travelL:-1,travelR:-1},2000);m.tick(.1,2000);
    assert.equal(excavatorOverlap(p,q),0);assert(Math.hypot(p.x,p.z)>.2);
  }
});
test('chassis turning and upper-body swinging cannot pass through another excavator',()=>{
  for(const upper of [false,true]){
    const m=new Match(),p=m.join('A'),q=m.join('B');m.start();
    Object.assign(p,{x:0,z:0,yaw:0,turret:0});Object.assign(q,{x:upper?2:2.1,z:upper?-1.4:0,yaw:0,turret:0});
    for(let i=0;i<20;i++){
      m.input(p.id,upper?{swing:-1}:{travelL:-1,travelR:1},1000+i*100);m.tick(.1,1000+i*100);
      assert.equal(excavatorOverlap(p,q),0);
    }
    assert(Math.abs(upper?p.turret:p.yaw)<1.4,'rotation stops at body contact');
  }
});
test('sixteen full bodies spawn without overlap in all team layouts and tracks',()=>{
  for(const map of EXCAVATOR_MAPS)for(let teams=1;teams<=8;teams++){
    const m=new Match();m.configure(teams);m.selectExcavatorMap(map.id);
    const ps=Array.from({length:16},()=>m.join('A'));
    for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)assert.equal(excavatorOverlap(ps[i],ps[j]),0,`${map.id}: ${teams}`);
  }
  const m=new Match();m.selectGame('racing');const ps=Array.from({length:16},()=>m.join('A'));
  for(const track of CIRCUITS){m.selectTrack(track.id);for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)assert.equal(bodyContact(raceBody(ps[i]),raceBody(ps[j])),null,track.id);}
});
