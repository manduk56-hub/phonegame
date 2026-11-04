import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
function setup(){const m=new Match();m.selectGame('clover');const a=m.join('봄'),b=m.join('여름');m.start();return {m,a,b};}
function select(m,p,id=m.clover.target){const plant=m.clover.plants[id];Object.assign(p,{x:plant.x,z:plant.z,crouching:true});m.action(p.id,'clover-select',{round:m.clover.round,plant:id});}
test('clover validates crouch, distance, wrong leaves and single winner during simultaneous pulls',()=>{
 const {m,a,b}=setup(),s=m.clover;m.action(a.id,'clover-select',{round:s.round,plant:s.target});assert.equal(a.selected,null);
 a.crouching=true;a.x=s.plants[s.target].x+3;a.z=s.plants[s.target].z;m.action(a.id,'clover-select',{round:s.round,plant:s.target});assert.equal(a.selected,null);
 select(m,a,(s.target+1)%s.plants.length);m.action(a.id,'pull',{round:s.round});assert.equal(a.clovers,0);assert.equal(s.reset,0);
 select(m,a);select(m,b);m.action(a.id,'pull',{round:s.round});m.action(b.id,'pull',{round:s.round});assert.equal(a.clovers,1);assert.equal(b.clovers,0);assert.equal(s.winner.id,a.id);
 for(let i=0;i<25;i++)m.tick(.1);assert.equal(m.clover.round,2);assert.notEqual(m.clover.target,s.target);assert.equal(a.clovers,1);assert.equal(a.crouching,false);assert.equal(a.selected,null);
 select(m,b);m.action(b.id,'pull',{round:1});assert.equal(b.clovers,0);m.action(b.id,'pull',{round:2});assert.equal(b.clovers,1);
});
test('clover movement is bounded, diagonal speed normalized, stale/disconnected input stops, selection invalidates',()=>{
 const {m,a,b}=setup();Object.assign(a,{x:0,z:0});m.input(a.id,{moveX:1,moveY:1,turn:1},1000);m.tick(.1,1000);assert(Math.abs(Math.hypot(a.x,a.z)-.34)<1e-8);const x=a.x;m.tick(.1,1400);assert.equal(a.x,x);
 select(m,a);m.input(a.id,{moveX:1},2000);m.tick(.1,2000);assert.equal(a.selected,null);m.disconnect(a.id);m.action(a.id,'crouch');assert(a.crouching);const old=a.x;m.tick(.1,2000);assert.equal(a.x,old);const again=m.join('ignored',a.token);assert.equal(again,a);assert(a.connected);assert.equal(a.clovers,0);
 Object.assign(b,{x:11.7,z:-8.7});m.input(b.id,{moveX:1,moveY:1},3000);m.tick(.1,3000);assert.equal(b.x,11.7);assert.equal(b.z,-8.7);
});
test('clover finish preserves scores, ties and no-score draw; lobby and restart reset',()=>{
 const {m,a,b}=setup();a.clovers=b.clovers=2;m.remaining=.05;m.tick(.1);assert.equal(m.phase,'finished');assert.deepEqual(m.results.winnerIds,[a.id,b.id]);m.action(a.id,'pull',{round:m.clover.round});assert.equal(a.clovers,2);m.lobby();m.start();assert.equal(a.clovers,0);m.remaining=.05;m.tick(.1);assert.deepEqual(m.results.winnerIds,[]);
});
