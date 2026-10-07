import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
function setup(count=2){const m=new Match();m.selectGame('krill');for(let i=0;i<count;i++)m.join('크릴 '+i);m.start();return m;}
test('krill input moves on both axes and stale input stops',()=>{const m=setup(),p=[...m.players.values()][0];m.input(p.id,{moveX:1,moveY:1},1000);const x=p.x,y=p.y;m.tick(.1,1000);assert(p.x>x&&p.y>y);assert(Math.abs(Math.hypot(p.x-x,p.y-y)-.66)<1e-9);const next=p.x;m.tick(.1,1500);assert.equal(p.x,next);assert.equal(p.alive,true);});
test('whale repeats warning and suction with a decreasing interval',()=>{
 const solo=setup(1),a=[...solo.players.values()][0];solo.duration=900;a.x=0;a.y=0;const stages=new Set(),intervals=[];let last=0;for(let i=0;i<600;i++){solo.krill.obstacles=[];solo.krill.spawnTimer=10;a.x=solo.krill.safe.x;a.y=solo.krill.safe.y;solo.tick(.1,0);stages.add(solo.krill.stage);if(solo.krill.cycle!==last){last=solo.krill.cycle;intervals.push(solo.krill.interval);}}
 assert(stages.has('warning')&&stages.has('suction')&&stages.has('rest'));assert(intervals.length>8);assert(intervals.at(-1)<intervals[0]);assert(intervals.every((v,i)=>i===0||v<=intervals[i-1]));});
test('warning does not kill; suction eliminates outside the safe zone and crowns the survivor',()=>{const m=setup(),[a,b]=[...m.players.values()];a.x=-9;a.y=-5;b.x=0;b.y=0;m.krill.cycleTime=3.5;m.tick(.1,0);assert.equal(m.krill.stage,'warning');assert.equal(a.suction,0);m.krill.cycleTime=4.6;for(let i=0;i<13;i++)m.tick(.1,0);assert.equal(a.alive,false);assert.equal(m.phase,'finished');assert.deepEqual(m.results.winnerIds,[b.id]);m.input(b.id,{moveX:1,moveY:0},1000);m.tick(.1,1000);assert(m.krill.ride.x>0);});
test('tail strongly pushes nearby krill, preserves range and prevents cooldown spam',()=>{const m=setup(3),[a,b,c]=[...m.players.values()];a.x=0;a.y=0;b.x=1;b.y=0;c.x=5;c.y=0;m.action(a.id,'tail');assert(b.vx>0);assert.equal(c.vx,0);const vx=b.vx;m.action(a.id,'tail');assert.equal(b.vx,vx);const before=b.x;for(let i=0;i<6;i++)m.tick(.1,0);assert(b.x-before>1.4);assert(b.x-before<2);assert.equal(c.x,5);});
test('obstacles hit each player once per invulnerability period and eliminate after three hits',()=>{const m=setup(),[a,b]=[...m.players.values()];b.x=-10;b.y=-5;for(let i=0;i<3;i++){a.invulnerable=0;m.krill.obstacles=[{id:i,x:a.x,y:a.y,z:-.8,r:.8,kind:'rock'}];m.tick(.1,0);assert.equal(a.hits,i+1);}assert.equal(a.alive,false);assert.deepEqual(m.results.winnerIds,[b.id]);});
test('multiplayer continues into sudden death, solo survival has a time limit, empty field has no winner',()=>{const m=setup();m.remaining=.01;m.krill.elapsed=m.duration-.01;m.tick(.1,0);assert.equal(m.phase,'running');const solo=setup(1);solo.krill.elapsed=solo.duration-.01;solo.tick(.1,0);assert.equal(solo.phase,'finished');assert.equal(solo.results.winnerIds.length,1);const empty=setup();for(const p of empty.players.values())empty.disconnect(p.id);empty.tick(.1,0);assert.equal(empty.phase,'finished');assert.deepEqual(empty.results.winnerIds,[]);});
test('game switching and restarting clears elimination and input',()=>{const m=setup();const p=[...m.players.values()][0];p.alive=false;p.suction=1;m.lobby();assert.equal(p.alive,true);assert.equal(p.suction,0);m.selectGame('fishing');m.selectGame('krill');m.start();assert.equal(m.krill.elapsed,0);assert.deepEqual(p.input,{moveX:0,moveY:0});});

test('safe circle covers a small area, protects its edge and stays fixed during an attack',()=>{
 const m=setup(3),[a,b,c]=[...m.players.values()],safe={...m.krill.safe};
 assert(Math.PI*safe.r**2/(20*11.6)<.12);
 a.x=safe.x+safe.r;a.y=safe.y;b.x=-9;b.y=-5;c.x=0;c.y=0;
 m.krill.cycleTime=3;m.tick(.1,0);assert.equal(a.suction,0);assert.equal(b.suction,0);assert.deepEqual(m.krill.safe,safe);
 m.krill.cycleTime=4.6;m.tick(.1,0);assert.equal(a.suction,0);assert(b.suction>0);assert.equal(c.suction,0);assert.deepEqual(m.krill.safe,safe);
 m.krill.cycleTime=5.95;m.tick(.1,0);assert.notDeepEqual(m.krill.safe,safe);assert(Math.abs(m.krill.safe.x)+m.krill.safe.r<=10);assert(Math.abs(m.krill.safe.y)+m.krill.safe.r<=5.8);
});
test('movement tilt follows direction, relaxes after stopping and resets for a new round',()=>{
 const m=setup(),p=[...m.players.values()][0];
 m.input(p.id,{moveX:1,moveY:-1},1000);m.tick(.1,1000);assert(p.swimX>0);assert(p.swimY<0);
 const first=p.swimX;m.input(p.id,{moveX:0,moveY:0},1100);for(let i=0;i<6;i++)m.tick(.1,1100);assert(Math.abs(p.swimX)<first*.02);assert(Math.abs(p.swimY)<.02);
 m.input(p.id,{moveX:-1,moveY:1},1200);m.tick(.1,1200);assert(p.swimX<0);assert(p.swimY>0);
 const snapshot=m.snapshot().players.find(v=>v.id===p.id);assert.equal(snapshot.swimX,p.swimX);assert.equal(snapshot.swimY,p.swimY);
 m.lobby();m.start();assert.equal(p.swimX,0);assert.equal(p.swimY,0);
});
