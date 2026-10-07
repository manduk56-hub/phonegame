import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../simulation.mjs';
import {excavatorOverlap} from '../collision.mjs';
import {waterHeight} from '../waterway.mjs';

function lowerTeeth(m,p,height=-.18){
  let low=-.25,high=1.35;
  for(let step=0;step<50;step++){
    p.boom=(low+high)/2;
    if(m.bucket(p).height<height)low=p.boom;else high=p.boom;
  }
  p.boom=high;
}

test('another player beneath the extended arm does not block articulation or swing',()=>{
  const m=new Match(),p=m.join('A'),q=m.join('B');m.start();
  Object.assign(p,{x:0,z:0,yaw:0,turret:0,boom:.5,stick:-1.4,curl:.1});
  const tip=m.bucket(p);
  Object.assign(q,{x:tip.x,z:tip.z,yaw:0,turret:0});
  assert.equal(excavatorOverlap(p,q),0);
  const old={...p};
  m.input(p.id,{swing:1,boom:1,stick:1,curl:1},1000);m.tick(.1,1000);
  for(const [key,delta] of [['turret',.14],['boom',.07],['stick',.09],['curl',.18]]){
    assert(Math.abs(p[key]-old[key]-delta)<1e-10,`${key} blocked by another player's body`);
  }
  assert.equal(excavatorOverlap(p,q),0);
});

test('blocked lowering does not cancel closing the bucket, and shallow teeth can scoop and drop',()=>{
  const m=new Match(),p=m.join('A');m.start();
  Object.assign(p,{x:0,z:0,yaw:0,turret:0,stick:-1.4,curl:.1});lowerTeeth(m,p);
  const oldBoom=p.boom;
  m.input(p.id,{boom:-1,curl:1},1000);m.tick(.1,1000);
  assert(Math.abs(p.curl-.28)<1e-10,'closing receives the full input despite ground contact');
  assert(p.boom<oldBoom&&p.boom>oldBoom-.07,'only the downward motion is limited');
  assert(m.bucket(p).height>=-.18001&&m.bucket(p).height<0);
  assert.equal(p.cargo,40);assert.equal(m.central,3960);

  p.curl=-.48;lowerTeeth(m,p);
  const tip=m.bucket(p),team=m.teams[p.team];
  p.x+=team.x-tip.x;p.z+=team.z-tip.z;p.cooldown=0;
  m.input(p.id,{boom:1,curl:-1},1100);m.tick(.1,1100);
  assert(p.curl<-.5);assert.equal(p.cargo,0);assert.equal(team.dirt,40);
  assert.equal(m.central+team.dirt,4000);
});

test('a buried bucket can recover by lifting while another downward joint is blocked',()=>{
  const m=new Match(),p=m.join('A');m.start();
  Object.assign(p,{stick:-1.4,curl:-.7});lowerTeeth(m,p,-.3);
  const before=m.bucket(p).height,oldBoom=p.boom;
  m.input(p.id,{boom:1,stick:-1},1000);m.tick(.1,1000);
  assert(Math.abs(p.boom-oldBoom-.07)<1e-10);
  assert(m.bucket(p).height>before,'lifting must recover from changed terrain');
});

test('waterway ground allowance follows the excavated terrain instead of the world floor',()=>{
  const m=new Match();m.selectExcavatorMap('waterfall');const p=m.join('A');m.start();
  const lane=m.water.lanes[p.team];lane.depth.fill(.45);
  Object.assign(p,{x:lane.x,z:0,yaw:0,turret:0,y:.45*-1,stick:-1.4,curl:.1});
  lowerTeeth(m,p,-.6);
  for(let step=0;step<30;step++){
    m.input(p.id,{boom:-1,stick:-1},1000+step*100);m.tick(.1,1000+step*100);
    const tip=m.bucket(p);
    assert(tip.height-waterHeight(m,tip)>=-.18001);
  }
  assert(m.bucket(p).height<-.45,'teeth can enter the already excavated channel');
});
