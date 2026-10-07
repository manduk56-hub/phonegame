import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
function round(n=4){const m=new Match();m.selectGame('bull');const b=m.join('황소'),humans=Array.from({length:n},(_,i)=>m.join('사람'+i));m.chooseBull(b.id);m.start();return {m,b,humans};}
function stage(m){for(let i=0;i<16;i++)m.tick(.1,1000);assert(m.bull.celebration.ready);}
function defeat(m,humans){for(const p of humans)Object.assign(p,{x:0,z:2});m.tick(.05,1000);assert.equal(m.results.winner,'bull');}
test('bull victory stages every participant after the final flight and preserves results during controllable horn launches',()=>{
 const {m,b,humans}=round(3);defeat(m,humans);const results=JSON.stringify(m.results);m.tick(.1,1000);assert(humans.every(p=>p.y>0));assert(!m.bull.celebration.ready);stage(m);
 assert(humans.every(p=>p.celebrationPose==='tremble'&&!p.flight&&p.y===0&&!p.alive));assert.equal(b.z,-14);assert.equal(b.speed,0);
 const first=humans[0];b.x=first.x;b.z=first.z-3.5;m.input(b.id,{forward:1},1000);m.tick(.1,1000);assert(first.celebrationHit);assert(first.flight);assert.equal(first.celebrationPose,'launched');
 const hits=m.bull.celebration.hits;for(let i=0;i<4;i++)m.tick(.1,1000);assert.equal(m.bull.celebration.hits,hits);assert(first.y>0);assert.equal(JSON.stringify(m.results),results);assert.equal(m.phase,'finished');
 const x=b.x,z=b.z;m.tick(.1,2000);assert.equal(b.x,x);assert.equal(b.z,z);assert.equal(b.speed,0);
 m.lobby();assert.equal(first.celebrationPose,null);assert.equal(first.flight,null);m.start();assert.equal(m.bull.celebration,undefined);
});
test('human winners hold capes and only their fresh wave inputs animate them; movement cannot change the staged result',()=>{
 const {m,b,humans}=round(2);humans[1].alive=false;humans[0].x=20;m.bull.elapsed=m.duration-.05;m.tick(.1,1000);const result=JSON.stringify(m.results);stage(m);
 assert.equal(humans[0].celebrationPose,'cape');assert.equal(humans[1].celebrationPose,'idle');const x=humans[0].x,z=humans[0].z;
 for(const p of [b,...humans])m.input(p.id,{wave:1,forward:1,steer:1},1000);m.tick(.1,1000);
 assert.equal(humans[0].capeWave,1);assert.equal(humans[1].capeWave,0);assert.equal(humans[0].x,x);assert.equal(humans[0].z,z);assert.equal(b.z,-14);m.tick(.1,2000);assert.equal(humans[0].capeWave,0);assert.equal(JSON.stringify(m.results),result);
});
test('full roster fits the stage; late joiners cannot join the celebration',()=>{
 const {m,b,humans}=round(15);defeat(m,humans);stage(m);assert.throws(()=>m.join('늦은 참가자'),/신규 참가/);
 assert(humans.every(p=>Math.abs(p.x)<=6.8&&p.z<=8));assert.equal(new Set(humans.map(p=>p.x+','+p.z)).size,15);
 m.disconnect(b.id);const z=b.z;m.tick(.1,1000);assert.equal(b.z,z);assert.equal(m.results.winner,'bull');
});
test('gate-map survivors can wave capes without creating a playable bull',()=>{
 const m=new Match();m.selectGame('bull');m.selectBullMap('gates');const p=m.join('생존자');m.start();m.bull.nextSpawn=1000;m.bull.elapsed=m.duration-.05;m.tick(.1,1000);stage(m);m.input(p.id,{wave:1},1000);m.tick(.1,1000);assert.equal(p.capeWave,1);assert.equal(m.bull.bullId,undefined);
});

