import test from 'node:test';
import assert from 'node:assert/strict';
import {createRimSteering} from '../public/pointer-pad.js';
test('inner disc retains analog forward/back/strafe, dead center stops movement',()=>{
  const s=createRimSteering();s.set(.3,-.4,1);const m=s.step(1,.05);
  assert.equal(m.yaw,1);assert.equal(m.forward,.4);assert.equal(m.strafe,.3);assert.equal(m.rim,0);
  s.set(0,0,1);assert.deepEqual(s.step(1,.05),{yaw:1,forward:0,strafe:0,rim:0});
});
test('outer ring turns toward the finger rather than strafing and moves at a quarter speed',()=>{
  const s=createRimSteering();s.set(1,0,Math.PI);let yaw=Math.PI;
  for(let i=0;i<30;i++){const m=s.step(yaw,.05);assert(Math.abs(m.yaw-yaw)<=.21+1e-9);assert.equal(m.strafe,0);assert.equal(m.forward,.25);yaw=m.yaw;}
  assert(Math.abs(yaw-Math.PI/2)<1e-9);
});
test('a full outer circle turns continuously across the back direction and release clears the gesture anchor',()=>{
  const s=createRimSteering();let yaw=0;s.set(0,-1,yaw);
  for(let i=0;i<=36;i++){const angle=i*Math.PI/18;s.set(Math.sin(angle),-Math.cos(angle),yaw);for(let frame=0;frame<5;frame++){const next=s.step(yaw,.05);assert(Math.abs(next.yaw-yaw)<=.21+1e-9);yaw=next.yaw;}}
  assert(Math.abs(yaw+Math.PI*2)<1e-9);
  s.set(0,0,yaw);s.set(0,-1,2);assert.equal(s.step(2,.05).yaw,2);
});
test('right-hand aiming shifts the ring heading without fighting the left-hand control',()=>{
  const s=createRimSteering();s.set(0,-1,0);s.rotate(.7);const m=s.step(.7,.05);assert.equal(m.yaw,.7);
});
