import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPad} from '../public/pointer-pad.js';
import {screenControl,FPS_OVERVIEW_POSITION} from '../public/fps-controls.js';
import {FPS_MOVE_SPEED} from '../fps.mjs';
import {Match} from '../simulation.mjs';

test('analog touches preserve arbitrary PC-screen directions and scale movement speed',()=>{
 const [cx,,cz]=FPS_OVERVIEW_POSITION,L=Math.hypot(cx,cz);
 for(const [x,y] of [[116,100],[180,100],[100,84],[100,20],[84,100],[20,100],[100,116],[100,180],[112,88],[180,20],[146,77],[164,95]]){
  const m=new Match();m.selectGame('fps');const p=m.join('direction pad');m.start();Object.assign(p,{x:4,z:4,yaw:.7});
  const captured=new Set(),el={dataset:{},querySelector:()=>({style:{}}),getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
  bindPad(el,(sx,sy)=>m.input(p.id,screenControl(sx,sy,p.yaw),1000),{deadZone:.08,radius:.4,knobTravel:.3});
  el.onpointerdown({pointerId:1,clientX:x,clientY:y});m.tick(.05,1000);
  const dx=p.x-4,dz=p.z-4,horizontal=(cz*dx-cx*dz)/L,vertical=(cx*dx+cz*dz)/L;
  assert(Math.abs(Math.hypot(dx,dz)-Math.max(0,(Math.min(1,Math.hypot(x-100,y-100)/80)-.08)/.92)*FPS_MOVE_SPEED*.05)<1e-8);
  if(x===100){assert(Math.abs(horizontal)<1e-8);assert(Math.sign(vertical)===Math.sign(y-100));}
  else if(y===100){assert(Math.abs(vertical)<1e-8);assert(Math.sign(horizontal)===Math.sign(x-100));}
  else{assert(horizontal>0&&vertical<0);assert(Math.abs(horizontal/vertical-(x-100)/(y-100))<1e-8);}
  const position=[p.x,p.z],yaw=p.yaw;el.onpointerup({pointerId:1});m.tick(.05,1000);
  assert.deepEqual([p.x,p.z],position);assert.equal(p.yaw,yaw);
 }
});
