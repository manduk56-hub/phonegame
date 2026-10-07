import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {BULL_ARENA,BULL_GATES,bullSpawnInterval,bullGatePoint} from '../bull.mjs';
function round(){const m=new Match();m.selectGame('bull');m.selectBullMap('gates');const p=m.join('생존자');m.start();return {m,p};}
function tick(m,seconds){for(let i=0;i<Math.round(seconds*10);i++)m.tick(.1,1000);}
test('continuous random doors cover every direction without snapping to fixed gate positions',t=>{
  const {m,p}=round();let randomValues=[];
  t.mock.method(Math,'random',()=>randomValues.shift());
  const sectors=new Set();
  for(let i=0;i<16;i++){
    randomValues=[(i+.37)/16,.5];p.flight={x:100,z:100,endX:100,endZ:100,start:0,duration:1};
    m.bull.nextSpawn=m.bull.elapsed+.05;m.tick(.1);const b=m.bull.bulls.at(-1);
    sectors.add(Math.floor(b.from/(Math.PI*2)*16));
    assert(Math.abs(b.from-(i+.37)/16*Math.PI*2)<1e-10);
    assert(Math.abs(b.from/(Math.PI*2)*12-Math.round(b.from/(Math.PI*2)*12))>.001);
    assert(Math.abs(Math.hypot(b.start.x,b.start.z)-BULL_ARENA.radius)<1e-8);
    assert(Math.abs(Math.hypot(b.end.x,b.end.z)-BULL_ARENA.radius)<1e-8);
    assert.equal(b.speed,BULL_GATES.speed);assert(b.distance>10);
  }
  assert.equal(sectors.size,16);
});
test('gate map starts with one human, validates selection and resets rematches',()=>{
  const {m,p}=round();assert.equal(p.role,'human');assert.equal(m.bull.bullId,undefined);assert.throws(()=>m.selectBullMap('classic'),/대기실/);
  tick(m,1.1);assert.equal(m.bull.bulls.length,1);m.lobby();assert.equal(m.snapshot().bull.bulls,undefined);m.start();assert.equal(m.bull.spawned,0);assert.deepEqual(m.bull.bulls,[]);
  m.lobby();assert.throws(()=>m.selectBullMap('invalid'),/올바른/);m.selectBullMap('classic');assert.throws(()=>m.start(),/2명/);
});
test('gate warns before release, runs straight at constant speed and exits at a different gate',()=>{
  const {m,p}=round();tick(m,1.1);const b=m.bull.bulls[0];assert.notEqual(b.from,b.to);assert.equal(b.progress,0);assert.deepEqual({x:b.x,z:b.z},bullGatePoint(b.from));
  // Keep this player off the selected chord while verifying a complete crossing.
  const side=-Math.sign(-b.start.x*Math.cos(b.yaw)+b.start.z*Math.sin(b.yaw)||1);
  p.x=-Math.cos(b.yaw)*25*side;p.z=Math.sin(b.yaw)*25*side;m.bull.nextSpawn=1000;
  tick(m,.4);assert.equal(b.progress,0);tick(m,.6);const before={x:b.x,z:b.z,yaw:b.yaw};tick(m,.1);
  assert(Math.abs(Math.hypot(b.x-before.x,b.z-before.z)-BULL_GATES.speed*.1)<1e-8);assert.equal(b.yaw,before.yaw);assert.equal(b.speed,BULL_GATES.speed);
  tick(m,9);assert.equal(m.bull.bulls.length,0);assert.equal(m.phase,'running');
});
test('later waves contain more bulls while every bull retains the same speed',()=>{
  const {m,p}=round();let first=0,last=0;
  for(let i=0;i<600;i++){p.x=100;p.z=100;p.flight={x:100,z:100,endX:100,endZ:100,start:0,duration:1};m.tick(.1);if(i===199)first=m.bull.spawned;if(i===399)last=m.bull.spawned;for(const b of m.bull.bulls)assert.equal(b.speed,BULL_GATES.speed);}
  assert(m.bull.spawned-last>first);assert(bullSpawnInterval(60)<bullSpawnInterval(0));assert.equal(bullSpawnInterval(900),BULL_GATES.minInterval);
});
test('crossing contact ejects a runner once and final flight continues after defeat',()=>{
  const {m,p}=round();tick(m,1.1);const b=m.bull.bulls[0];p.x=b.start.x+Math.sin(b.yaw)*7;p.z=b.start.z+Math.cos(b.yaw)*7;
  tick(m,1.4);assert.equal(p.alive,false);assert.equal(m.results.winner,'bull');const survival=p.survival;m.tick(.1);assert(p.y>0);assert.equal(p.survival,survival);assert.equal(b.speed,BULL_GATES.speed);
});
test('gate map survives to timeout without depending on a participant bull connection',()=>{
  const {m,p}=round();m.bull.nextSpawn=1000;m.bull.elapsed=m.duration-.05;m.tick(.1);assert.equal(m.results.winner,'humans');assert.equal(p.survival,m.duration);
});
