import test from 'node:test';
import assert from 'node:assert/strict';
import {screenMovement,screenDirection,screenAim,screenControl,FPS_OVERVIEW_POSITION} from '../public/fps-controls.js';
import {Match} from '../simulation.mjs';
test('all screen directions stay fixed across every facing direction in the actual FPS simulation',()=>{
 const [cx,,cz]=FPS_OVERVIEW_POSITION,L=Math.hypot(cx,cz);
 for(const [sx,sy] of [[0,-1],[1,0],[0,1],[-1,0],[.6,-.8]])for(const yaw of [0,.7,Math.PI,4.8]){
  const m=new Match();m.selectGame('fps');const p=m.join('projection');m.start();Object.assign(p,{x:0,z:0,yaw});
  m.input(p.id,screenMovement(sx,sy,yaw));m.tick(.1);
  const horizontal=(cz*p.x-cx*p.z)/L,vertical=(cx*p.x+cz*p.z)/L;
  assert(Math.abs(horizontal-sx*.5)<1e-8);assert(Math.abs(vertical-sy*.5)<1e-8);
 }
});

test('one movement control faces the travel direction; stop preserves heading and cannot aim vertically',()=>{
 for(const [x,y] of [[0,-1],[1,0],[0,1],[-1,0],[.3,-.4]]){
  const m=new Match();m.selectGame('fps');const p=m.join('one pad');m.start();Object.assign(p,{x:0,z:0,yaw:1});
  const input=screenControl(x,y,p.yaw);m.input(p.id,{...input,pitch:1},1000);m.tick(.1,1000);
  const world=screenDirection(x,y),heading=p.yaw;
  assert(Math.abs(p.x-world.x*.5)<1e-8);assert(Math.abs(p.z-world.z*.5)<1e-8);
  assert(Math.abs(Math.atan2(Math.sin(heading-input.yaw),Math.cos(heading-input.yaw)))<1e-8);
  assert.equal(p.pitch,0);
  const position=[p.x,p.z];m.input(p.id,{...screenControl(0,0,heading),yaw:heading+1,pitch:-1},1000);m.tick(.1,1000);
  assert.deepEqual([p.x,p.z],position);assert.equal(p.yaw,heading);assert.equal(p.pitch,0);
 }
});
test('screen aim points along the matching ground direction and releasing movement stops',()=>{
 for(const [x,y] of [[0,-1],[1,0],[0,1],[-1,0]]){
  const world=screenDirection(x,y),yaw=screenAim(x,y);
  assert(Math.abs(Math.sin(yaw)-world.x)<1e-8);assert(Math.abs(Math.cos(yaw)-world.z)<1e-8);
  assert.deepEqual(screenMovement(0,0,yaw),{forward:0,strafe:0});
 }
});
